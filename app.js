(function () {
  "use strict";

  // ============================================================
  // SUPABASE
  // ============================================================

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = CFG.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  function isSupabaseReady() {
    return (
      typeof window.supabase !== "undefined" &&
      SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes("YOUR-PROJECT") &&
      !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE")
    );
  }

  if (isSupabaseReady()) {
    // إنشاء Client واحد فقط
    if (!window.__DEBTBOOK_SUPABASE_CLIENT__) {
      window.__DEBTBOOK_SUPABASE_CLIENT__ =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY
        );
    }

    supabaseClient =
      window.__DEBTBOOK_SUPABASE_CLIENT__;
  }


  // ============================================================
  // STATE
  // ============================================================

  const state = {
    role: null,

    offices: [],

    currentOffice: null,

    people: [],

    transactions: [],

    currentPerson: null,

    search: "",

    officeSearch: ""
  };


  // ============================================================
  // DOM
  // ============================================================

  const $ = (id) =>
    document.getElementById(id);


  // ============================================================
  // INIT
  // ============================================================

  document.addEventListener(
    "DOMContentLoaded",
    init
  );


  async function init() {

    setupEvents();

    checkConnection();

    if (!supabaseClient) {

      showLogin();

      showLoginMessage(
        "لم يتم إعداد Supabase بشكل صحيح.",
        "error"
      );

      hideLoading();

      return;
    }

    try {

      const {
        data: {
          session
        }
      } = await supabaseClient.auth.getSession();

      if (session && session.user) {

        state.role = "admin";

        await showAdmin();

      } else {

        showLogin();

      }

    } catch (error) {

      console.error(
        "Supabase session error:",
        error
      );

      showLogin();

    }

    hideLoading();
  }


  // ============================================================
  // EVENTS
  // ============================================================

  function setupEvents() {

    // Login
    $("loginForm")?.addEventListener(
      "submit",
      handleLogin
    );


    // Admin logout
    $("adminLogoutBtn")?.addEventListener(
      "click",
      logout
    );


    // Office logout
    $("logoutBtn")?.addEventListener(
      "click",
      logout
    );


    // Add office
    $("addOfficeBtn")?.addEventListener(
      "click",
      () => openOfficeModal()
    );


    // Search offices
    $("officeSearch")?.addEventListener(
      "input",
      function () {

        state.officeSearch =
          this.value.trim().toLowerCase();

        renderOffices();

      }
    );


    // Search people
    $("searchInput")?.addEventListener(
      "input",
      function () {

        state.search =
          this.value.trim().toLowerCase();

        renderPeople();

      }
    );


    // Add person
    $("addPersonBtn")?.addEventListener(
      "click",
      () => openPersonModal()
    );


    // Back person
    $("backBtn")?.addEventListener(
      "click",
      showPeople
    );


    // Back admin
    $("backToAdminBtn")?.addEventListener(
      "click",
      async function () {

        if (state.role !== "admin") {
          return;
        }

        state.currentOffice = null;

        await showAdmin();

      }
    );


    // Payment
    $("payBtn")?.addEventListener(
      "click",
      () => openTransactionModal("payment")
    );


    // Purchase
    $("purchaseBtn")?.addEventListener(
      "click",
      () => openTransactionModal("purchase")
    );


    // Edit person
    $("editPersonBtn")?.addEventListener(
      "click",
      () => openPersonModal(state.currentPerson)
    );


    // Modal close
    $("modalClose")?.addEventListener(
      "click",
      closeModal
    );


    $("modal")?.addEventListener(
      "click",
      function (event) {

        if (event.target === $("modal")) {
          closeModal();
        }

      }
    );

  }


  // ============================================================
  // CONNECTION
  // ============================================================

  async function checkConnection() {

    const dot = $("connDot");
    const text = $("connText");

    if (!supabaseClient) {

      if (dot) {
        dot.style.background = "#dc2626";
      }

      if (text) {
        text.textContent =
          "Supabase غير متصل";
      }

      return;
    }

    try {

      const {
        error
      } = await supabaseClient
        .from("offices")
        .select("id")
        .limit(1);

      if (error) {

        console.error(
          "Supabase connection:",
          error
        );

        if (dot) {
          dot.style.background =
            "#dc2626";
        }

        if (text) {
          text.textContent =
            "يوجد خطأ في الاتصال";
        }

      } else {

        if (dot) {
          dot.style.background =
            "#16a34a";
        }

        if (text) {
          text.textContent =
            "متصل بـ Supabase";
        }

      }

    } catch (error) {

      console.error(error);

    }

  }


  // ============================================================
  // LOGIN
  // ============================================================

  async function handleLogin(event) {

    event.preventDefault();

    if (!supabaseClient) {

      showLoginMessage(
        "Supabase غير مهيأ. تأكد من supabase-config.js",
        "error"
      );

      return;
    }

    const emailOrUsername =
      $("loginEmail").value.trim();

    const password =
      $("loginPassword").value;

    if (!emailOrUsername || !password) {

      showLoginMessage(
        "اكتب اسم المستخدم وكلمة المرور.",
        "error"
      );

      return;
    }

    setLoginLoading(true);

    clearLoginMessage();


    // ========================================================
    // أولاً: تجربة Supabase Auth
    // للأدمن
    // ========================================================

    if (emailOrUsername.includes("@")) {

      try {

        const {
          data,
          error
        } = await supabaseClient.auth.signInWithPassword({
          email: emailOrUsername,
          password: password
        });

        if (!error && data.user) {

          state.role = "admin";

          await showAdmin();

          setLoginLoading(false);

          return;
        }

        if (error) {

          console.warn(
            "Auth login:",
            error.message
          );

        }

      } catch (error) {

        console.error(error);

      }

    }


    // ========================================================
    // تسجيل دخول المكتب
    // ========================================================

    try {

      const {
        data,
        error
      } = await supabaseClient
        .from("offices")
        .select("*")
        .eq("username", emailOrUsername)
        .eq("password", password)
        .eq("active", true)
        .maybeSingle();

      if (error) {

        console.error(
          "Office login:",
          error
        );

        showLoginMessage(
          "تعذر تسجيل الدخول للمكتب. تأكد من سياسات RLS في Supabase.",
          "error"
        );

        setLoginLoading(false);

        return;
      }

      if (!data) {

        showLoginMessage(
          "اسم المستخدم أو كلمة المرور غير صحيحة.",
          "error"
        );

        setLoginLoading(false);

        return;
      }


      // مهم:
      // المكتب هنا دخول مخصص من جدول offices.
      // لا يتم تخزين كلمة المرور في الجهاز.

      state.role = "office";

      state.currentOffice = data;

      await showOffice(data);

    } catch (error) {

      console.error(error);

      showLoginMessage(
        "حدث خطأ أثناء تسجيل الدخول.",
        "error"
      );

    }

    setLoginLoading(false);

  }


  // ============================================================
  // LOGOUT
  // ============================================================

  async function logout() {

    try {

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }

    } catch (error) {

      console.error(error);

    }

    state.role = null;
    state.currentOffice = null;
    state.people = [];
    state.transactions = [];
    state.currentPerson = null;

    hideAllViews();

    showLogin();

    $("loginPassword").value = "";

  }


  // ============================================================
  // ADMIN
  // ============================================================

  async function showAdmin() {

    hideAllViews();

    $("adminView")?.classList.remove("hidden");

    await loadOffices();

  }


  async function loadOffices() {

    if (!supabaseClient) {
      return;
    }

    const {
      data,
      error
    } = await supabaseClient
      .from("offices")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {

      console.error(
        "Load offices:",
        error
      );

      showGlobalError(
        "تعذر تحميل المكاتب: " +
        error.message
      );

      return;
    }

    state.offices = data || [];

    renderOffices();

  }


  // ============================================================
  // RENDER OFFICES
  // ============================================================

  function renderOffices() {

    const list = $("officesList");
    const empty = $("officesEmpty");

    if (!list) {
      return;
    }

    list.innerHTML = "";

    let offices =
      [...state.offices];

    if (state.officeSearch) {

      offices = offices.filter(
        office =>
          String(
            office.name || ""
          )
            .toLowerCase()
            .includes(state.officeSearch)
          ||
          String(
            office.username || ""
          )
            .toLowerCase()
            .includes(state.officeSearch)
      );

    }


    $("officesCount").textContent =
      state.offices.length;


    if (!offices.length) {

      empty?.classList.remove(
        "hidden"
      );

      return;

    }

    empty?.classList.add(
      "hidden"
    );


    offices.forEach(
      office => {

        const card =
          document.createElement("div");

        card.className =
          "person-item office-card";


        const contract =
          getContractStatus(office);


        card.innerHTML = `

          <div class="person-main">

            <div class="person-avatar">
              🏢
            </div>

            <div class="person-info">

              <h3>
                ${escapeHtml(
                  office.name
                )}
              </h3>

              <div class="office-info">

                <div>
                  👤 اسم المستخدم:
                  <strong>
                    ${escapeHtml(
                      office.username
                    )}
                  </strong>
                </div>

                <div>
                  📞 الهاتف:
                  ${escapeHtml(
                    office.phone || "-"
                  )}
                </div>

                <div>
                  ${
                    office.active
                      ? "🟢 المكتب فعال"
                      : "🔴 المكتب متوقف"
                  }
                </div>

              </div>

              <div class="
                contract-box
                ${contract.className}
              ">

                📅
                <strong>
                  مدة العقد
                </strong>

                <br>

                من:
                ${formatDate(
                  office.contract_start
                )}

                &nbsp;&nbsp;

                إلى:
                ${formatDate(
                  office.contract_end
                )}

                <br>

                <small>
                  ${contract.text}
                </small>

              </div>

            </div>

          </div>


          <div class="office-actions">

            <button
              class="btn btn-primary"
              data-action="open"
              data-id="${office.id}"
            >
              فتح المكتب
            </button>

            <button
              class="btn btn-edit"
              data-action="edit"
              data-id="${office.id}"
            >
              تعديل
            </button>

            <button
              class="btn btn-danger"
              data-action="delete"
              data-id="${office.id}"
            >
              حذف
            </button>

          </div>

        `;


        list.appendChild(card);

      }
    );


    list
      .querySelectorAll(
        "[data-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async function () {

              const id =
                this.dataset.id;

              const action =
                this.dataset.action;

              const office =
                state.offices.find(
                  x => x.id === id
                );

              if (!office) {
                return;
              }

              if (action === "open") {

                await showOffice(
                  office
                );

              }

              if (action === "edit") {

                openOfficeModal(
                  office
                );

              }

              if (action === "delete") {

                await deleteOffice(
                  office
                );

              }

            }
          );

        }
      );

  }


  // ============================================================
  // CONTRACT
  // ============================================================

  function getContractStatus(
    office
  ) {

    if (
      !office.contract_start &&
      !office.contract_end
    ) {

      return {
        text: "لا توجد مدة عقد محددة",
        className: ""
      };

    }


    if (!office.contract_end) {

      return {
        text: "لا توجد نهاية للعقد",
        className: "success"
      };

    }


    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );


    const end =
      new Date(
        office.contract_end +
        "T00:00:00"
      );


    const diff =
      Math.ceil(
        (
          end - today
        ) /
        (
          1000 *
          60 *
          60 *
          24
        )
      );


    if (diff < 0) {

      return {
        text:
          "العقد منتهي منذ " +
          Math.abs(diff) +
          " يوم",
        className: "danger"
      };

    }


    if (diff <= 7) {

      return {
        text:
          "تنبيه: ينتهي العقد خلال " +
          diff +
          " يوم",
        className: "danger"
      };

    }


    if (diff <= 30) {

      return {
        text:
          "ينتهي العقد خلال " +
          diff +
          " يوم",
        className: "warning"
      };

    }


    return {
      text:
        "العقد ساري",
      className: "success"
    };

  }


  // ============================================================
  // ADD / EDIT OFFICE
  // ============================================================

  function openOfficeModal(
    office = null
  ) {

    const isEdit =
      !!office;

    openModal(
      isEdit
        ? "تعديل المكتب"
        : "إضافة مكتب"
    );


    $("modalBody").innerHTML = `

      <form id="officeForm">

        <div class="form-group">

          <label>
            اسم المكتب
          </label>

          <input
            type="text"
            id="officeName"
            required
            value="${escapeAttr(
              office?.name || ""
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            اسم المستخدم
          </label>

          <input
            type="text"
            id="officeUsername"
            required
            value="${escapeAttr(
              office?.username || ""
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            كلمة المرور
          </label>

          <input
            type="password"
            id="officePassword"
            ${
              isEdit
                ? ""
                : "required"
            }
            placeholder="${
              isEdit
                ? "اتركها فارغة إذا لا تريد تغييرها"
                : ""
            }"
          >

        </div>


        <div class="form-group">

          <label>
            رقم الهاتف
          </label>

          <input
            type="text"
            id="officePhone"
            value="${escapeAttr(
              office?.phone || ""
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            تفاصيل المكتب
          </label>

          <textarea
            id="officeDetails"
            rows="3"
          >${escapeHtml(
            office?.details || ""
          )}</textarea>

        </div>


        <div class="form-row">

          <div class="form-group">

            <label>
              بداية العقد
            </label>

            <input
              type="date"
              id="contractStart"
              value="${
                office?.contract_start || ""
              }"
            >

          </div>


          <div class="form-group">

            <label>
              نهاية العقد
            </label>

            <input
              type="date"
              id="contractEnd"
              value="${
                office?.contract_end || ""
              }"
            >

          </div>

        </div>


        <div class="form-group">

          <label>
            حالة المكتب
          </label>

          <select id="officeActive">

            <option
              value="true"
              ${
                office?.active !== false
                  ? "selected"
                  : ""
              }
            >
              فعال
            </option>

            <option
              value="false"
              ${
                office?.active === false
                  ? "selected"
                  : ""
              }
            >
              متوقف
            </option>

          </select>

        </div>


        <button
          type="submit"
          class="btn btn-primary"
          id="saveOfficeBtn"
        >
          ${
            isEdit
              ? "حفظ التعديلات"
              : "إضافة المكتب"
          }
        </button>

      </form>

    `;


    $("officeForm").addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        await saveOffice(
          office
        );

      }
    );

  }


  async function saveOffice(
    oldOffice
  ) {

    const name =
      $("officeName")
        .value
        .trim();

    const username =
      $("officeUsername")
        .value
        .trim();

    const password =
      $("officePassword")
        .value;

    const phone =
      $("officePhone")
        .value
        .trim();

    const details =
      $("officeDetails")
        .value
        .trim();

    const contractStart =
      $("contractStart")
        .value || null;

    const contractEnd =
      $("contractEnd")
        .value || null;

    const active =
      $("officeActive")
        .value === "true";


    if (!name || !username) {

      alert(
        "اسم المكتب واسم المستخدم مطلوبان."
      );

      return;
    }


    if (
      contractStart &&
      contractEnd &&
      contractEnd < contractStart
    ) {

      alert(
        "تاريخ نهاية العقد لا يمكن أن يكون قبل بداية العقد."
      );

      return;
    }


    const button =
      $("saveOfficeBtn");

    button.disabled = true;

    button.textContent =
      "جارٍ الحفظ...";


    try {

      if (!oldOffice) {

        if (!password) {

          alert(
            "كلمة المرور مطلوبة."
          );

          button.disabled = false;
          button.textContent =
            "إضافة المكتب";

          return;

        }


        const {
          data,
          error
        } = await supabaseClient
          .from("offices")
          .insert({

            name,

            username,

            password,

            phone,

            details,

            active,

            contract_start:
              contractStart,

            contract_end:
              contractEnd

          })
          .select()
          .single();


        if (error) {
          throw error;
        }

        console.log(
          "Office created:",
          data
        );


      } else {

        const updateData = {

          name,

          username,

          phone,

          details,

          active,

          contract_start:
            contractStart,

          contract_end:
            contractEnd

        };


        if (password) {

          updateData.password =
            password;

        }


        const {
          data,
          error
        } = await supabaseClient
          .from("offices")
          .update(updateData)
          .eq("id", oldOffice.id)
          .select()
          .single();


        if (error) {
          throw error;
        }

        console.log(
          "Office updated:",
          data
        );

      }


      closeModal();

      await loadOffices();

      alert(
        "تم الحفظ بنجاح ✅"
      );

    } catch (error) {

      console.error(
        "Save office:",
        error
      );

      alert(
        "حدث خطأ أثناء الحفظ:\n" +
        error.message
      );

    }


    button.disabled = false;

  }


  // ============================================================
  // DELETE OFFICE
  // ============================================================

  async function deleteOffice(
    office
  ) {

    const ok =
      confirm(
        "هل أنت متأكد من حذف المكتب؟\n\n" +
        office.name +
        "\n\n" +
        "سيتم حذف الأشخاص والحركات التابعة له."
      );

    if (!ok) {
      return;
    }


    try {

      const {
        error
      } = await supabaseClient
        .from("offices")
        .delete()
        .eq("id", office.id);


      if (error) {
        throw error;
      }


      await loadOffices();

      alert(
        "تم حذف المكتب."
      );

    } catch (error) {

      console.error(
        error
      );

      alert(
        "تعذر حذف المكتب:\n" +
        error.message
      );

    }

  }


  // ============================================================
  // OFFICE APP
  // ============================================================

  async function showOffice(
    office
  ) {

    state.currentOffice =
      office;

    hideAllViews();

    $("appView")
      ?.classList
      .remove("hidden");


    $("appTitle").textContent =
      office.name ||
      "دفتر الديون";


    $("appSubtitle").textContent =
      office.phone
        ? "📞 " + office.phone
        : "إدارة الديون بسهولة";


    renderContractBanner(
      office
    );


    if (state.role === "admin") {

      $("backToAdminBtn")
        ?.classList
        .remove("hidden");

    } else {

      $("backToAdminBtn")
        ?.classList
        .add("hidden");

    }


    showPeople();

    await loadPeople();

  }


  function renderContractBanner(
    office
  ) {

    const banner =
      $("contractBanner");

    if (!banner) {
      return;
    }


    if (
      !office.contract_start &&
      !office.contract_end
    ) {

      banner.className =
        "contract-banner hidden";

      banner.innerHTML = "";

      return;

    }


    const status =
      getContractStatus(
        office
      );


    banner.className =
      "contract-banner " +
      status.className;


    banner.innerHTML = `

      📅

      <strong>
        مدة العقد:
      </strong>

      من
      ${formatDate(
        office.contract_start
      )}

      إلى
      ${formatDate(
        office.contract_end
      )}

      &nbsp; — &nbsp;

      ${escapeHtml(
        status.text
      )}

    `;

  }


  // ============================================================
  // PEOPLE
  // ============================================================

  async function loadPeople() {

    if (
      !state.currentOffice ||
      !supabaseClient
    ) {
      return;
    }


    const {
      data,
      error
    } = await supabaseClient
      .from("people")
      .select("*")
      .eq(
        "office_id",
        state.currentOffice.id
      )
      .order("created_at", {
        ascending: false
      });


    if (error) {

      console.error(
        "Load people:",
        error
      );

      showGlobalError(
        "تعذر تحميل الأشخاص:\n" +
        error.message
      );

      return;
    }


    state.people =
      data || [];


    await calculatePeopleBalances();

    renderPeople();

  }


  async function calculatePeopleBalances() {

    if (
      !state.currentOffice
    ) {
      return;
    }


    const {
      data,
      error
    } = await supabaseClient
      .from("transactions")
      .select(
        "person_id,type,amount"
      )
      .eq(
        "office_id",
        state.currentOffice.id
      );


    if (error) {

      console.error(
        error
      );

      return;

    }


    const balances = {};


    (data || []).forEach(
      txn => {

        if (
          !balances[txn.person_id]
        ) {

          balances[
            txn.person_id
          ] = 0;

        }


        if (
          txn.type === "purchase"
        ) {

          balances[
            txn.person_id
          ] += Number(
            txn.amount
          );

        } else {

          balances[
            txn.person_id
          ] -= Number(
            txn.amount
          );

        }

      }
    );


    state.people =
      state.people.map(
        person => ({

          ...person,

          balance:
            Math.max(
              0,
              Number(
                balances[
                  person.id
                ] || 0
              )
            )

        })
      );

  }


  function renderPeople() {

    const list =
      $("peopleList");

    const empty =
      $("emptyState");


    if (!list) {
      return;
    }


    list.innerHTML = "";


    let people =
      [...state.people];


    if (state.search) {

      people =
        people.filter(
          person => {

            const name =
              String(
                person.name || ""
              )
                .toLowerCase();

            const phone =
              String(
                person.phone || ""
              )
                .toLowerCase();

            return (
              name.includes(
                state.search
              ) ||
              phone.includes(
                state.search
              )
            );

          }
        );

    }


    const total =
      state.people.reduce(
        (
          sum,
          person
        ) =>
          sum +
          Number(
            person.balance || 0
          ),
        0
      );


    $("totalDebt").textContent =
      formatMoney(total);


    $("peopleCount").textContent =
      state.people.length;


    if (!people.length) {

      empty?.classList
        .remove("hidden");

      return;

    }


    empty?.classList
      .add("hidden");


    people.forEach(
      person => {

        const card =
          document.createElement(
            "div"
          );

        card.className =
          "person-item";


        const balance =
          Number(
            person.balance || 0
          );


        card.innerHTML = `

          <div class="person-main">

            <div class="person-avatar">
              👤
            </div>

            <div class="person-info">

              <h3>
                ${escapeHtml(
                  person.name
                )}
              </h3>

              <p>
                📞
                ${escapeHtml(
                  person.phone || "-"
                )}
              </p>

              <p>
                💰
                المستحق:

                <strong
                  class="${
                    balance > 0
                      ? "debt-positive"
                      : "debt-zero"
                  }"
                >
                  ${formatMoney(
                    balance
                  )}
                </strong>
              </p>

            </div>

          </div>

          <button
            class="btn btn-primary"
            data-person-id="${person.id}"
          >
            فتح
          </button>

        `;


        card
          .querySelector(
            "[data-person-id]"
          )
          .addEventListener(
            "click",
            () =>
              openPerson(
                person.id
              )
          );


        list.appendChild(card);

      }
    );

  }


  // ============================================================
  // PERSON
  // ============================================================

  async function openPerson(
    personId
  ) {

    const person =
      state.people.find(
        x => x.id === personId
      );


    if (!person) {
      return;
    }


    state.currentPerson =
      person;


    $("peopleView")
      ?.classList
      .add("hidden");


    $("personView")
      ?.classList
      .remove("hidden");


    await loadPersonTransactions();

  }


  async function loadPersonTransactions() {

    if (
      !state.currentPerson ||
      !state.currentOffice
    ) {
      return;
    }


    const {
      data,
      error
    } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq(
        "office_id",
        state.currentOffice.id
      )
      .eq(
        "person_id",
        state.currentPerson.id
      )
      .order("date", {
        ascending: false
      });


    if (error) {

      console.error(
        error
      );

      alert(
        "تعذر تحميل سجل الحركات:\n" +
        error.message
      );

      return;
    }


    state.transactions =
      data || [];


    renderPerson();

  }


  function renderPerson() {

    const person =
      state.currentPerson;


    if (!person) {
      return;
    }


    let balance = 0;


    state.transactions.forEach(
      txn => {

        if (
          txn.type === "purchase"
        ) {

          balance +=
            Number(
              txn.amount
            );

        } else {

          balance -=
            Number(
              txn.amount
            );

        }

      }
    );


    balance =
      Math.max(
        0,
        balance
      );


    $("personCard").innerHTML = `

      <div class="person-profile">

        <div class="person-avatar large">
          👤
        </div>

        <div>

          <h2>
            ${escapeHtml(
              person.name
            )}
          </h2>

          <p>
            📞
            ${escapeHtml(
              person.phone || "-"
            )}
          </p>

          <p>
            ${
              person.details
                ? escapeHtml(
                    person.details
                  )
                : ""
            }
          </p>

          <div>

            💰 المستحق:

            <strong
              class="${
                balance > 0
                  ? "debt-positive"
                  : "debt-zero"
              }"
            >
              ${formatMoney(
                balance
              )}
            </strong>

          </div>

        </div>

      </div>

    `;


    $("txnCount").textContent =
      state.transactions.length;


    renderTransactions();

  }


  function renderTransactions() {

    const list =
      $("transactionsList");


    if (!list) {
      return;
    }


    list.innerHTML = "";


    if (
      !state.transactions.length
    ) {

      list.innerHTML = `

        <div class="empty-state">

          <p>
            لا توجد حركات لهذا الشخص.
          </p>

        </div>

      `;

      return;

    }


    state.transactions.forEach(
      txn => {

        const item =
          document.createElement(
            "div"
          );


        item.className =
          "transaction-item";


        const isPurchase =
          txn.type ===
          "purchase";


        item.innerHTML = `

          <div>

            <strong
              class="${
                isPurchase
                  ? "txn-purchase"
                  : "txn-payment"
              }"
            >
              ${
                isPurchase
                  ? "🛒 شراء"
                  : "💵 تسديد"
              }
            </strong>

            <div>
              ${escapeHtml(
                txn.details || ""
              )}
            </div>

            <small>
              ${formatDateTime(
                txn.date
              )}
            </small>

          </div>


          <strong
            class="${
              isPurchase
                ? "txn-purchase"
                : "txn-payment"
            }"
          >
            ${
              isPurchase
                ? "+"
                : "-"
            }

            ${formatMoney(
              txn.amount
            )}

          </strong>

        `;


        list.appendChild(item);

      }
    );

  }


  // ============================================================
  // ADD / EDIT PERSON
  // ============================================================

  function openPersonModal(
    person = null
  ) {

    const isEdit =
      !!person;


    openModal(
      isEdit
        ? "تعديل بيانات الشخص"
        : "إضافة شخص"
    );


    $("modalBody").innerHTML = `

      <form id="personForm">

        <div class="form-group">

          <label>
            اسم الشخص
          </label>

          <input
            type="text"
            id="personName"
            required
            value="${escapeAttr(
              person?.name || ""
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            رقم الهاتف
          </label>

          <input
            type="text"
            id="personPhone"
            value="${escapeAttr(
              person?.phone || ""
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            التفاصيل
          </label>

          <textarea
            id="personDetails"
            rows="4"
          >${escapeHtml(
            person?.details || ""
          )}</textarea>

        </div>


        <button
          type="submit"
          class="btn btn-primary"
        >
          ${
            isEdit
              ? "حفظ التعديلات"
              : "إضافة الشخص"
          }
        </button>

      </form>

    `;


    $("personForm").addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        await savePerson(
          person
        );

      }
    );

  }


  async function savePerson(
    oldPerson
  ) {

    if (
      !state.currentOffice
    ) {
      return;
    }


    const name =
      $("personName")
        .value
        .trim();

    const phone =
      $("personPhone")
        .value
        .trim();

    const details =
      $("personDetails")
        .value
        .trim();


    if (!name) {

      alert(
        "اسم الشخص مطلوب."
      );

      return;

    }


    try {

      if (!oldPerson) {

        const {
          error
        } = await supabaseClient
          .from("people")
          .insert({

            office_id:
              state.currentOffice.id,

            name,

            phone,

            details

          });


        if (error) {
          throw error;
        }


      } else {

        const {
          error
        } = await supabaseClient
          .from("people")
          .update({

            name,

            phone,

            details,

            updated_at:
              new Date()
                .toISOString()

          })
          .eq(
            "id",
            oldPerson.id
          );


        if (error) {
          throw error;
        }

      }


      closeModal();

      await loadPeople();


      if (
        state.currentPerson &&
        oldPerson &&
        state.currentPerson.id ===
        oldPerson.id
      ) {

        state.currentPerson =
          state.people.find(
            x =>
              x.id ===
              oldPerson.id
          );

        await loadPersonTransactions();

      }


      alert(
        "تم الحفظ بنجاح ✅"
      );


    } catch (error) {

      console.error(
        error
      );

      alert(
        "تعذر حفظ الشخص:\n" +
        error.message
      );

    }

  }


  // ============================================================
  // TRANSACTION
  // ============================================================

  function openTransactionModal(
    type
  ) {

    if (!state.currentPerson) {
      return;
    }


    const isPayment =
      type === "payment";


    openModal(
      isPayment
        ? "تسجيل تسديد"
        : "تسجيل شراء"
    );


    $("modalBody").innerHTML = `

      <form id="transactionForm">

        <div class="form-group">

          <label>
            المبلغ
          </label>

          <input
            type="number"
            id="transactionAmount"
            min="0.01"
            step="0.01"
            required
            placeholder="0"
          >

        </div>


        <div class="form-group">

          <label>
            التفاصيل
          </label>

          <textarea
            id="transactionDetails"
            rows="3"
            placeholder="${
              isPayment
                ? "مثلاً: تسديد نقدي"
                : "مثلاً: مواد غذائية"
            }"
          ></textarea>

        </div>


        <button
          type="submit"
          class="btn ${
            isPayment
              ? "btn-success"
              : "btn-danger"
          }"
        >
          ${
            isPayment
              ? "تسجيل التسديد"
              : "تسجيل الشراء"
          }
        </button>

      </form>

    `;


    $("transactionForm")
      .addEventListener(
        "submit",
        async function (event) {

          event.preventDefault();

          await saveTransaction(
            type
          );

        }
      );

  }


  async function saveTransaction(
    type
  ) {

    if (
      !state.currentPerson ||
      !state.currentOffice
    ) {
      return;
    }


    const amount =
      Number(
        $("transactionAmount")
          .value
      );


    const details =
      $("transactionDetails")
        .value
        .trim();


    if (
      !amount ||
      amount <= 0
    ) {

      alert(
        "اكتب مبلغاً صحيحاً."
      );

      return;

    }


    // منع تسديد أكبر من الدين
    if (type === "payment") {

      const currentDebt =
        calculateCurrentDebt();


      if (amount > currentDebt) {

        const ok =
          confirm(
            "المبلغ أكبر من الدين الحالي.\n\n" +
            "الدين الحالي: " +
            formatMoney(
              currentDebt
            ) +
            "\n\nهل تريد المتابعة؟"
          );

        if (!ok) {
          return;
        }

      }

    }


    try {

      const {
        error
      } = await supabaseClient
        .from("transactions")
        .insert({

          office_id:
            state.currentOffice.id,

          person_id:
            state.currentPerson.id,

          type,

          amount,

          details,

          date:
            new Date()
              .toISOString()

        });


      if (error) {
        throw error;
      }


      closeModal();

      await loadPersonTransactions();

      await loadPeople();


      // إعادة تحديد الشخص
      state.currentPerson =
        state.people.find(
          x =>
            x.id ===
            state.currentPerson.id
        ) ||
        state.currentPerson;


      await loadPersonTransactions();


      alert(
        type === "payment"
          ? "تم تسجيل التسديد ✅"
          : "تم تسجيل الشراء ✅"
      );


    } catch (error) {

      console.error(
        error
      );

      alert(
        "تعذر حفظ الحركة:\n" +
        error.message
      );

    }

  }


  function calculateCurrentDebt() {

    let debt = 0;


    state.transactions.forEach(
      txn => {

        if (
          txn.type ===
          "purchase"
        ) {

          debt +=
            Number(
              txn.amount
            );

        } else {

          debt -=
            Number(
              txn.amount
            );

        }

      }
    );


    return Math.max(
      0,
      debt
    );

  }


  // ============================================================
  // VIEWS
  // ============================================================

  function showPeople() {

    $("personView")
      ?.classList
      .add("hidden");

    $("peopleView")
      ?.classList
      .remove("hidden");

  }


  function showLogin() {

    hideAllViews();

    $("loginView")
      ?.classList
      .remove("hidden");

    setTimeout(
      () => {
        $("loginEmail")?.focus();
      },
      100
    );

  }


  function hideAllViews() {

    $("loginView")
      ?.classList
      .add("hidden");

    $("adminView")
      ?.classList
      .add("hidden");

    $("appView")
      ?.classList
      .add("hidden");

  }


  // ============================================================
  // MODAL
  // ============================================================

  function openModal(
    title
  ) {

    $("modalTitle").textContent =
      title;

    $("modal")
      .classList
      .remove("hidden");

  }


  function closeModal() {

    $("modal")
      ?.classList
      .add("hidden");

    if ($("modalBody")) {
      $("modalBody").innerHTML = "";
    }

  }


  // ============================================================
  // LOGIN UI
  // ============================================================

  function showLoginMessage(
    message,
    type
  ) {

    const element =
      $("loginMessage");


    if (!element) {
      return;
    }


    element.textContent =
      message;


    element.className =
      "login-message";


    if (type === "error") {

      element.classList.add(
        "login-error"
      );

    } else {

      element.classList.add(
        "login-success"
      );

    }

  }


  function clearLoginMessage() {

    const element =
      $("loginMessage");


    if (!element) {
      return;
    }


    element.textContent = "";

    element.className =
      "login-message hidden";

  }


  function setLoginLoading(
    loading
  ) {

    const button =
      $("loginBtn");


    if (!button) {
      return;
    }


    button.disabled =
      loading;


    button.textContent =
      loading
        ? "جارٍ الدخول..."
        : "دخول";

  }


  // ============================================================
  // LOADING
  // ============================================================

  function hideLoading() {

    $("loadingScreen")
      ?.classList
      .add("hidden");

  }


  // ============================================================
  // ERRORS
  // ============================================================

  function showGlobalError(
    message
  ) {

    console.error(
      message
    );

    alert(
      message
    );

  }


  // ============================================================
  // HELPERS
  // ============================================================

  function formatMoney(
    amount
  ) {

    const number =
      Number(
        amount || 0
      );


    return (
      new Intl.NumberFormat(
        "ar-IQ",
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      ).format(number) +
      " د.ع"
    );

  }


  function formatDate(
    value
  ) {

    if (!value) {
      return "غير محدد";
    }


    try {

      const date =
        new Date(
          value +
          "T00:00:00"
        );


      return new Intl.DateTimeFormat(
        "ar-IQ",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(date);

    } catch {

      return value;

    }

  }


  function formatDateTime(
    value
  ) {

    if (!value) {
      return "";
    }


    try {

      return new Intl.DateTimeFormat(
        "ar-IQ",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }
      ).format(
        new Date(value)
      );

    } catch {

      return value;

    }

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  function escapeAttr(
    value
  ) {

    return escapeHtml(
      value
    );

  }


  // ============================================================
  // منع الزوم على iPhone / iPad
  // ============================================================

  document.addEventListener(
    "gesturestart",
    function (event) {
      event.preventDefault();
    },
    {
      passive: false
    }
  );


  document.addEventListener(
    "gesturechange",
    function (event) {
      event.preventDefault();
    },
    {
      passive: false
    }
  );


  document.addEventListener(
    "gestureend",
    function (event) {
      event.preventDefault();
    },
    {
      passive: false
    }
  );


  // منع double tap zoom
  let lastTouchEnd = 0;


  document.addEventListener(
    "touchend",
    function (event) {

      const now =
        Date.now();


      if (
        now -
        lastTouchEnd <=
        300
      ) {

        event.preventDefault();

      }


      lastTouchEnd =
        now;

    },
    {
      passive: false
    }
  );

})();