(function () {
  "use strict";

  // =========================================================
  // SUPABASE
  // =========================================================

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL =
    CFG.SUPABASE_URL || "";

  const SUPABASE_ANON_KEY =
    CFG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  const isConfigured =
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR-PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE");

  if (isConfigured) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    console.log("Supabase connected");
    window.supabaseClient = supabaseClient
  } else {
    console.error("Supabase is not configured correctly");
  }


  // =========================================================
  // STATE
  // =========================================================

  const state = {
    role: null,
    user: null,
    office: null,

    offices: [],
    people: [],
    transactions: [],

    currentPersonId: null,

    searchQuery: "",

    loading: false
  };


  // =========================================================
  // DOM HELPERS
  // =========================================================

  const $ = (id) =>
    document.getElementById(id);


  function show(id) {
    const el = $(id);
    if (el) el.classList.remove("hidden");
  }


  function hide(id) {
    const el = $(id);
    if (el) el.classList.add("hidden");
  }


  function text(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function money(value) {
    const number = Number(value || 0);

    return number.toLocaleString("ar-IQ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }


  function formatDate(value) {
    if (!value) return "-";

    try {
      return new Date(value).toLocaleDateString(
        "ar-IQ"
      );
    } catch {
      return value;
    }
  }


  function formatDateTime(value) {
    if (!value) return "-";

    try {
      return new Date(value).toLocaleString(
        "ar-IQ"
      );
    } catch {
      return value;
    }
  }


  // =========================================================
  // LOGIN MESSAGE
  // =========================================================

  function showLoginMessage(message, type) {
    const el = $("loginMessage");

    if (!el) return;

    el.textContent = message;
    el.className =
      "login-message " +
      (type || "error");

    el.classList.remove("hidden");
  }


  function clearLoginMessage() {
    const el = $("loginMessage");

    if (!el) return;

    el.textContent = "";
    el.classList.add("hidden");
  }


  function setLoginLoading(value) {
    const btn = $("loginBtn");

    if (!btn) return;

    btn.disabled = value;

    btn.textContent =
      value ? "جارٍ الدخول..." : "دخول";
  }


  // =========================================================
  // VIEWS
  // =========================================================

  function showLoginView() {
    hide("adminView");
    hide("appView");
    show("loginView");
  }


  function showAdminView() {
    hide("loginView");
    hide("appView");
    show("adminView");
  }


  function showAppView() {
    hide("loginView");
    hide("adminView");
    show("appView");
  }


  // =========================================================
  // AUTH
  // =========================================================

  async function getCurrentUser() {
    if (!supabaseClient) return null;

    const {
      data,
      error
    } = await supabaseClient.auth.getUser();

    if (error) {
      console.error(
        "getCurrentUser:",
        error
      );

      return null;
    }

    return data?.user || null;
  }


  async function checkAdmin(userId) {
    if (!userId) return false;

    const {
      data,
      error
    } = await supabaseClient
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "Check admin:",
        error
      );

      return false;
    }

    return !!data;
  }


  async function getOfficeForUser(userId) {
    if (!userId) return null;

    const {
      data,
      error
    } = await supabaseClient
      .from("offices")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "Get office:",
        error
      );

      return null;
    }

    return data || null;
  }


  // =========================================================
  // CONTRACT
  // =========================================================

  function getContractStatus(office) {
    if (!office) {
      return {
        valid: false,
        text: "لا يوجد مكتب"
      };
    }

    if (!office.active) {
      return {
        valid: false,
        text: "الحساب معطل"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (office.contract_start) {
      const start =
        new Date(
          office.contract_start +
          "T00:00:00"
        );

      if (today < start) {
        return {
          valid: false,
          text:
            "العقد لم يبدأ بعد"
        };
      }
    }

    if (office.contract_end) {
      const end =
        new Date(
          office.contract_end +
          "T23:59:59"
        );

      if (today > end) {
        return {
          valid: false,
          text:
            "انتهت مدة العقد"
        };
      }
    }

    return {
      valid: true,
      text: "العقد فعال"
    };
  }


  function renderContractBanner() {
    const banner =
      $("contractBanner");

    if (!banner || !state.office) {
      return;
    }

    const status =
      getContractStatus(
        state.office
      );

    const start =
      state.office.contract_start
        ? formatDate(
            state.office.contract_start
          )
        : "غير محدد";

    const end =
      state.office.contract_end
        ? formatDate(
            state.office.contract_end
          )
        : "غير محدد";

    banner.className =
      "contract-banner";

    if (!status.valid) {
      banner.classList.add("expired");
    }

    banner.innerHTML = `
      <strong>
        حالة العقد: ${escapeHtml(status.text)}
      </strong>

      <span>
        البداية: ${escapeHtml(start)}
      </span>

      <span>
        النهاية: ${escapeHtml(end)}
      </span>
    `;

    banner.classList.remove(
      "hidden"
    );
  }


  // =========================================================
  // LOGIN
  // =========================================================

  async function handleLogin(event) {
    event.preventDefault();

    clearLoginMessage();

    if (!supabaseClient) {
      showLoginMessage(
        "Supabase غير مربوط بشكل صحيح.",
        "error"
      );

      return;
    }

    const input =
      $("loginEmail")?.value
        ?.trim()
        ?.toLowerCase();

    const password =
      $("loginPassword")?.value || "";

    if (!input || !password) {
      showLoginMessage(
        "أدخل اسم المستخدم وكلمة المرور.",
        "error"
      );

      return;
    }

    setLoginLoading(true);

    try {

      /*
       * إذا كتب المكتب:
       *
       * ahmed
       *
       * نحوله إلى:
       *
       * ahmed@dayoon.local
       *
       * أما إذا كتب إيميل كامل فنستخدمه كما هو.
       */

      let authEmail = input;

      if (!authEmail.includes("@")) {
        authEmail =
          `${authEmail}@dayoon.local`;
      }


      const {
        data,
        error
      } =
        await supabaseClient.auth.signInWithPassword({
          email: authEmail,
          password
        });


      if (error) {
        console.error(
          "Auth login failed:",
          error
        );

        showLoginMessage(
          "بيانات الدخول غير صحيحة.",
          "error"
        );

        return;
      }


      const user =
        data?.user;

      if (!user) {
        showLoginMessage(
          "تعذر الحصول على حساب المستخدم.",
          "error"
        );

        return;
      }


      state.user = user;


      // =====================================================
      // ADMIN
      // =====================================================

      const isAdmin =
        await checkAdmin(
          user.id
        );

      if (isAdmin) {

        state.role = "admin";

        await loadAdminData();

        showAdminView();

        return;
      }


      // =====================================================
      // OFFICE
      // =====================================================

      const office =
        await getOfficeForUser(
          user.id
        );


      if (!office) {

        await supabaseClient.auth.signOut();

        state.user = null;
        state.role = null;

        showLoginMessage(
          "هذا الحساب غير مرتبط بمكتب.",
          "error"
        );

        return;
      }


      state.office = office;
      state.role = "office";


      const contract =
        getContractStatus(
          office
        );


      if (!contract.valid) {

        await supabaseClient.auth.signOut();

        state.user = null;
        state.office = null;
        state.role = null;

        showLoginMessage(
          contract.text,
          "error"
        );

        return;
      }


      await loadOfficeData();

      showAppView();


    } catch (error) {

      console.error(
        "Login:",
        error
      );

      showLoginMessage(
        "حدث خطأ أثناء تسجيل الدخول.",
        "error"
      );

    } finally {

      setLoginLoading(false);
    }
  }


  // =========================================================
  // LOGOUT
  // =========================================================

  async function logout() {

    try {

      if (supabaseClient) {
        const {
          error
        } =
          await supabaseClient.auth.signOut({
            scope: "local"
          });

        if (error) {
          console.warn(
            "Logout:",
            error
          );
        }
      }

    } catch (error) {
      console.warn(
        "Logout exception:",
        error
      );
    }


    state.role = null;
    state.user = null;
    state.office = null;
    state.offices = [];
    state.people = [];
    state.transactions = [];
    state.currentPersonId = null;

    showLoginView();

    clearLoginMessage();

    if ($("loginEmail")) {
      $("loginEmail").value = "";
    }

    if ($("loginPassword")) {
      $("loginPassword").value = "";
    }
  }


  // =========================================================
  // ADMIN
  // =========================================================

  async function loadAdminData() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("offices")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Load offices:",
        error
      );

      alert(
        "تعذر تحميل المكاتب."
      );

      return;
    }


    state.offices =
      data || [];

    renderOffices();
  }


  function renderOffices() {

    const list =
      $("officesList");

    if (!list) return;


    const query =
      (
        $("officeSearch")
          ?.value ||
        ""
      )
        .trim()
        .toLowerCase();


    const filtered =
      state.offices.filter(
        office => {

          const name =
            String(
              office.name || ""
            ).toLowerCase();

          const username =
            String(
              office.username || ""
            ).toLowerCase();

          return (
            !query ||
            name.includes(query) ||
            username.includes(query)
          );
        }
      );


    text(
      "officesCount",
      state.offices.length
    );


    if (!filtered.length) {

      list.innerHTML = "";

      show("officesEmpty");

      return;
    }


    hide("officesEmpty");


    list.innerHTML =
      filtered
        .map(
          office =>
            renderOfficeCard(
              office
            )
        )
        .join("");
  }


  function renderOfficeCard(
    office
  ) {

    const status =
      getContractStatus(
        office
      );


    const activeClass =
      office.active
        ? "active"
        : "inactive";


    return `
      <div
        class="person-item office-item"
        data-office-id="${escapeHtml(office.id)}"
      >

        <div class="person-main">

          <div class="person-avatar">
            ${escapeHtml(
              (office.name || "م")
                .charAt(0)
            )}
          </div>

          <div class="person-info">

            <h3>
              ${escapeHtml(
                office.name
              )}
            </h3>

            <p>
              اسم الدخول:
              ${escapeHtml(
                office.username
              )}
            </p>

            <p>
              العقد:
              ${escapeHtml(
                office.contract_start
                  ? formatDate(
                      office.contract_start
                    )
                  : "-"
              )}
              -
              ${escapeHtml(
                office.contract_end
                  ? formatDate(
                      office.contract_end
                    )
                  : "-"
              )}
            </p>

          </div>

        </div>


        <div class="person-side">

          <span
            class="status-badge ${activeClass}"
          >
            ${
              office.active
                ? "فعال"
                : "معطل"
            }
          </span>

          <span
            class="status-badge ${
              status.valid
                ? "active"
                : "inactive"
            }"
          >
            ${escapeHtml(
              status.text
            )}
          </span>

          <div class="item-actions">

            <button
              class="btn btn-edit"
              onclick="window.editOffice('${office.id}')"
            >
              تعديل
            </button>

            <button
              class="btn ${
                office.active
                  ? "btn-danger"
                  : "btn-success"
              }"
              onclick="window.toggleOffice('${office.id}')"
            >
              ${
                office.active
                  ? "تعطيل"
                  : "تفعيل"
              }
            </button>

          </div>

        </div>

      </div>
    `;
  }


  // =========================================================
  // CREATE OFFICE
  // =========================================================

  function openAddOfficeModal() {

    openModal(
      "إضافة مكتب",
      `
        <form id="officeForm">

          <div class="form-group">
            <label>اسم المكتب</label>
            <input
              type="text"
              id="officeName"
              required
              placeholder="مثال: مكتب أحمد"
            >
          </div>

          <div class="form-group">
            <label>اسم المستخدم / الإيميل</label>
            <input
              type="text"
              id="officeUsername"
              required
              placeholder="ahmed"
            >
            <small>
              إذا كتبت ahmed سيتم إنشاء:
              ahmed@dayoon.local
            </small>
          </div>

          <div class="form-group">
            <label>كلمة المرور</label>
            <input
              type="password"
              id="officePassword"
              minlength="6"
              required
              placeholder="كلمة مرور المكتب"
            >
          </div>

          <div class="form-group">
            <label>بداية العقد</label>
            <input
              type="date"
              id="contractStart"
            >
          </div>

          <div class="form-group">
            <label>نهاية العقد</label>
            <input
              type="date"
              id="contractEnd"
            >
          </div>

          <button
            type="submit"
            class="btn btn-primary"
          >
            إنشاء المكتب
          </button>

        </form>
      `
    );


    $("officeForm")
      ?.addEventListener(
        "submit",
        saveOffice
      );
  }


  async function saveOffice(event) {

    event.preventDefault();


    const name =
      $("officeName")
        ?.value
        ?.trim();

    const username =
      $("officeUsername")
        ?.value
        ?.trim()
        ?.toLowerCase();

    const password =
      $("officePassword")
        ?.value || "";

    const contractStart =
      $("contractStart")
        ?.value || null;

    const contractEnd =
      $("contractEnd")
        ?.value || null;


    if (!name) {
      alert(
        "أدخل اسم المكتب."
      );
      return;
    }


    if (!username) {
      alert(
        "أدخل اسم المستخدم."
      );
      return;
    }


    if (password.length < 6) {
      alert(
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
      );
      return;
    }


    if (
      contractStart &&
      contractEnd &&
      contractEnd < contractStart
    ) {
      alert(
        "تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية."
      );

      return;
    }


    try {

      const {
        data,
        error
      } =
        await supabaseClient.functions.invoke(
          "create-office",
          {
            body: {
              name,
              username,
              password,

              contract_start:
                contractStart,

              contract_end:
                contractEnd
            }
          }
        );


      if (error) {

        console.error(
          "Create office:",
          error
        );

        throw new Error(
          error.message ||
          "تعذر إنشاء المكتب."
        );
      }


      if (
        !data ||
        !data.success
      ) {

        throw new Error(
          data?.error ||
          "تعذر إنشاء المكتب."
        );
      }


      closeModal();


      alert(
        "تم إنشاء المكتب بنجاح.\n\n" +
        "اسم الدخول: " +
        data.login_email
      );


      await loadAdminData();


    } catch (error) {

      console.error(
        "Save office:",
        error
      );

      alert(
        error.message ||
        "حدث خطأ أثناء إنشاء المكتب."
      );
    }
  }


  // =========================================================
  // EDIT OFFICE
  // =========================================================

  window.editOffice =
    async function (officeId) {

      const office =
        state.offices.find(
          item =>
            item.id === officeId
        );

      if (!office) return;


      openModal(
        "تعديل المكتب",
        `
          <form id="editOfficeForm">

            <div class="form-group">
              <label>اسم المكتب</label>

              <input
                type="text"
                id="editOfficeName"
                value="${escapeHtml(
                  office.name
                )}"
                required
              >
            </div>


            <div class="form-group">
              <label>اسم المستخدم</label>

              <input
                type="text"
                value="${escapeHtml(
                  office.username
                )}"
                disabled
              >
            </div>


            <div class="form-group">
              <label>بداية العقد</label>

              <input
                type="date"
                id="editContractStart"
                value="${
                  office.contract_start || ""
                }"
              >
            </div>


            <div class="form-group">
              <label>نهاية العقد</label>

              <input
                type="date"
                id="editContractEnd"
                value="${
                  office.contract_end || ""
                }"
              >
            </div>


            <button
              type="submit"
              class="btn btn-primary"
            >
              حفظ التعديلات
            </button>

          </form>
        `
      );


      $("editOfficeForm")
        ?.addEventListener(
          "submit",
          async function (event) {

            event.preventDefault();


            const name =
              $("editOfficeName")
                .value
                .trim();

            const start =
              $("editContractStart")
                .value || null;

            const end =
              $("editContractEnd")
                .value || null;


            if (
              start &&
              end &&
              end < start
            ) {

              alert(
                "تاريخ نهاية العقد غير صحيح."
              );

              return;
            }


            const {
              error
            } =
              await supabaseClient
                .from("offices")
                .update({
                  name,
                  contract_start:
                    start,
                  contract_end:
                    end,
                  updated_at:
                    new Date().toISOString()
                })
                .eq(
                  "id",
                  officeId
                );


            if (error) {

              console.error(
                "Update office:",
                error
              );

              alert(
                "تعذر تعديل المكتب."
              );

              return;
            }


            closeModal();

            await loadAdminData();
          }
        );
    };


  // =========================================================
  // TOGGLE OFFICE
  // =========================================================

  window.toggleOffice =
    async function (officeId) {

      const office =
        state.offices.find(
          item =>
            item.id === officeId
        );

      if (!office) return;


      const newValue =
        !office.active;


      const {
        error
      } =
        await supabaseClient
          .from("offices")
          .update({
            active: newValue,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            officeId
          );


      if (error) {

        console.error(
          "Toggle office:",
          error
        );

        alert(
          "تعذر تغيير حالة المكتب."
        );

        return;
      }


      await loadAdminData();
    };


  // =========================================================
  // OFFICE DATA
  // =========================================================

  async function loadOfficeData() {

    if (!state.office) {
      return;
    }


    text(
      "appTitle",
      state.office.name
    );

    text(
      "appSubtitle",
      "إدارة الديون بسهولة"
    );


    renderContractBanner();


    const {
      data,
      error
    } =
      await supabaseClient
        .from("people")
        .select("*")
        .eq(
          "office_id",
          state.office.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Load people:",
        error
      );

      alert(
        "تعذر تحميل بيانات الأشخاص."
      );

      return;
    }


    state.people =
      data || [];


    await calculateBalances();

    renderPeople();
  }


  async function calculateBalances() {

    if (!state.office) {
      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("transactions")
        .select("*")
        .eq(
          "office_id",
          state.office.id
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        );


    if (error) {

      console.error(
        "Load transactions:",
        error
      );

      return;
    }


    state.transactions =
      data || [];


    const balances = {};


    state.people.forEach(
      person => {
        balances[person.id] = 0;
      }
    );


    state.transactions.forEach(
      transaction => {

        if (
          balances[
            transaction.person_id
          ] === undefined
        ) {
          balances[
            transaction.person_id
          ] = 0;
        }


        if (
          transaction.type ===
          "purchase"
        ) {

          balances[
            transaction.person_id
          ] += Number(
            transaction.amount
          );

        } else if (
          transaction.type ===
          "payment"
        ) {

          balances[
            transaction.person_id
          ] -= Number(
            transaction.amount
          );
        }
      }
    );


    state.people =
      state.people.map(
        person => ({
          ...person,

          balance:
            balances[
              person.id
            ] || 0
        })
      );


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


    text(
      "totalDebt",
      money(total)
    );

    text(
      "peopleCount",
      state.people.length
    );
  }


  // =========================================================
  // PEOPLE LIST
  // =========================================================

  function renderPeople() {

    const list =
      $("peopleList");

    if (!list) return;


    const query =
      (
        $("searchInput")
          ?.value ||
        ""
      )
        .trim()
        .toLowerCase();


    const filtered =
      state.people.filter(
        person => {

          const name =
            String(
              person.name || ""
            ).toLowerCase();

          const phone =
            String(
              person.phone || ""
            ).toLowerCase();

          return (
            !query ||
            name.includes(query) ||
            phone.includes(query)
          );
        }
      );


    text(
      "peopleCount",
      state.people.length
    );


    if (!filtered.length) {

      list.innerHTML = "";

      show("emptyState");

      return;
    }


    hide("emptyState");


    list.innerHTML =
      filtered
        .map(
          person =>
            renderPersonItem(
              person
            )
        )
        .join("");
  }


  function renderPersonItem(
    person
  ) {

    const balance =
      Number(
        person.balance || 0
      );


    const balanceClass =
      balance > 0
        ? "debt"
        : balance < 0
          ? "credit"
          : "zero";


    return `
      <div
        class="person-item"
        onclick="window.openPerson('${person.id}')"
      >

        <div class="person-main">

          <div class="person-avatar">
            ${escapeHtml(
              (person.name || "ش")
                .charAt(0)
            )}
          </div>

          <div class="person-info">

            <h3>
              ${escapeHtml(
                person.name
              )}
            </h3>

            <p>
              ${
                person.phone
                  ? escapeHtml(
                      person.phone
                    )
                  : "لا يوجد رقم"
              }
            </p>

          </div>

        </div>


        <div class="person-side">

          <span
            class="balance ${balanceClass}"
          >
            ${money(balance)}
          </span>

          <small>
            ${
              balance > 0
                ? "عليه"
                : balance < 0
                  ? "له"
                  : "متسدد"
            }
          </small>

        </div>

      </div>
    `;
  }


  // =========================================================
  // ADD PERSON
  // =========================================================

  function openAddPersonModal() {

    openModal(
      "إضافة شخص",
      `
        <form id="personForm">

          <div class="form-group">
            <label>الاسم</label>

            <input
              type="text"
              id="personName"
              required
              placeholder="اسم الشخص"
            >
          </div>


          <div class="form-group">
            <label>رقم الهاتف</label>

            <input
              type="text"
              id="personPhone"
              placeholder="رقم الهاتف"
            >
          </div>


          <div class="form-group">
            <label>ملاحظات</label>

            <textarea
              id="personNotes"
              rows="3"
            ></textarea>
          </div>


          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ الشخص
          </button>

        </form>
      `
    );


    $("personForm")
      ?.addEventListener(
        "submit",
        savePerson
      );
  }


  async function savePerson(
    event
  ) {

    event.preventDefault();


    if (!state.office) {
      return;
    }


    const name =
      $("personName")
        ?.value
        ?.trim();

    const phone =
      $("personPhone")
        ?.value
        ?.trim() || null;

    const notes =
      $("personNotes")
        ?.value
        ?.trim() || null;


    if (!name) {
      alert(
        "أدخل اسم الشخص."
      );

      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("people")
        .insert({
          office_id:
            state.office.id,

          name,
          phone,
          notes
        })
        .select()
        .single();


    if (error) {

      console.error(
        "Save person:",
        error
      );

      alert(
        "تعذر حفظ الشخص."
      );

      return;
    }


    state.people.unshift(
      {
        ...data,
        balance: 0
      }
    );


    closeModal();

    renderPeople();

    text(
      "peopleCount",
      state.people.length
    );
  }


  // =========================================================
  // OPEN PERSON
  // =========================================================

  window.openPerson =
    async function (personId) {

      state.currentPersonId =
        personId;


      const person =
        state.people.find(
          item =>
            item.id === personId
        );


      if (!person) return;


      hide("peopleView");
      show("personView");


      renderPersonCard(
        person
      );


      await loadPersonTransactions(
        personId
      );
    };


  function renderPersonCard(
    person
  ) {

    const card =
      $("personCard");

    if (!card) return;


    const balance =
      Number(
        person.balance || 0
      );


    card.innerHTML = `

      <div class="person-card-inner">

        <div class="person-avatar large">
          ${escapeHtml(
            (person.name || "ش")
              .charAt(0)
          )}
        </div>

        <div class="person-details">

          <h2>
            ${escapeHtml(
              person.name
            )}
          </h2>

          <p>
            الهاتف:
            ${
              person.phone
                ? escapeHtml(
                    person.phone
                  )
                : "-"
            }
          </p>

          ${
            person.notes
              ? `
                <p>
                  ${escapeHtml(
                    person.notes
                  )}
                </p>
              `
              : ""
          }

        </div>


        <div class="person-balance">

          <span>
            الرصيد
          </span>

          <strong>
            ${money(balance)}
          </strong>

        </div>

      </div>
    `;
  }


  // =========================================================
  // LOAD PERSON TRANSACTIONS
  // =========================================================

  async function loadPersonTransactions(
    personId
  ) {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("transactions")
        .select("*")
        .eq(
          "office_id",
          state.office.id
        )
        .eq(
          "person_id",
          personId
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        "Load transactions:",
        error
      );

      return;
    }


    const transactions =
      data || [];


    text(
      "txnCount",
      transactions.length
    );


    const list =
      $("transactionsList");

    if (!list) return;


    if (!transactions.length) {

      list.innerHTML = `
        <div class="empty-state">
          لا توجد حركات لهذا الشخص.
        </div>
      `;

      return;
    }


    list.innerHTML =
      transactions
        .map(
          transaction =>
            renderTransaction(
              transaction
            )
        )
        .join("");
  }


  function renderTransaction(
    transaction
  ) {

    const isPurchase =
      transaction.type ===
      "purchase";


    return `
      <div class="transaction-item">

        <div>

          <strong>
            ${
              isPurchase
                ? "شراء"
                : "تسديد"
            }
          </strong>

          <p>
            ${
              transaction.description
                ? escapeHtml(
                    transaction.description
                  )
                : ""
            }
          </p>

          <small>
            ${formatDateTime(
              transaction.created_at
            )}
          </small>

        </div>


        <strong
          class="${
            isPurchase
              ? "transaction-debt"
              : "transaction-payment"
          }"
        >
          ${
            isPurchase
              ? "+"
              : "-"
          }
          ${money(
            transaction.amount
          )}
        </strong>

      </div>
    `;
  }


  // =========================================================
  // ADD TRANSACTION
  // =========================================================

  async function addTransaction(
    type
  ) {

    if (!state.office) {
      return;
    }


    if (!state.currentPersonId) {
      return;
    }


    const person =
      state.people.find(
        item =>
          item.id ===
          state.currentPersonId
      );


    if (!person) return;


    const title =
      type === "purchase"
        ? "شراء مباشر"
        : "تسديد";


    openModal(
      title,
      `
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
              الوصف / الملاحظات
            </label>

            <textarea
              id="transactionDescription"
              rows="3"
              placeholder="${
                type === "purchase"
                  ? "مثال: مواد غذائية"
                  : "مثال: تسديد نقدي"
              }"
            ></textarea>

          </div>


          <button
            type="submit"
            class="btn ${
              type === "purchase"
                ? "btn-danger"
                : "btn-success"
            }"
          >
            ${title}
          </button>

        </form>
      `
    );


    $("transactionForm")
      ?.addEventListener(
        "submit",
        async function (event) {

          event.preventDefault();


          const amount =
            Number(
              $("transactionAmount")
                .value
            );


          const description =
            $("transactionDescription")
              .value
              .trim() || null;


          if (
            !amount ||
            amount <= 0
          ) {

            alert(
              "أدخل مبلغًا صحيحًا."
            );

            return;
          }


          const {
            error
          } =
            await supabaseClient
              .from("transactions")
              .insert({

                office_id:
                  state.office.id,

                person_id:
                  state.currentPersonId,

                type,

                amount,

                description
              });


          if (error) {

            console.error(
              "Save transaction:",
              error
            );

            alert(
              "تعذر حفظ الحركة."
            );

            return;
          }


          closeModal();


          await loadOfficeData();


          const updatedPerson =
            state.people.find(
              item =>
                item.id ===
                state.currentPersonId
            );


          if (updatedPerson) {

            renderPersonCard(
              updatedPerson
            );
          }


          await loadPersonTransactions(
            state.currentPersonId
          );
        }
      );
  }


  // =========================================================
  // EDIT PERSON
  // =========================================================

  async function editCurrentPerson() {

    const person =
      state.people.find(
        item =>
          item.id ===
          state.currentPersonId
      );


    if (!person) return;


    openModal(
      "تعديل بيانات الشخص",
      `
        <form id="editPersonForm">

          <div class="form-group">

            <label>
              الاسم
            </label>

            <input
              type="text"
              id="editPersonName"
              value="${escapeHtml(
                person.name
              )}"
              required
            >

          </div>


          <div class="form-group">

            <label>
              الهاتف
            </label>

            <input
              type="text"
              id="editPersonPhone"
              value="${escapeHtml(
                person.phone || ""
              )}"
            >

          </div>


          <div class="form-group">

            <label>
              ملاحظات
            </label>

            <textarea
              id="editPersonNotes"
              rows="3"
            >${escapeHtml(
              person.notes || ""
            )}</textarea>

          </div>


          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ التعديل
          </button>

        </form>
      `
    );


    $("editPersonForm")
      ?.addEventListener(
        "submit",
        async function (event) {

          event.preventDefault();


          const name =
            $("editPersonName")
              .value
              .trim();

          const phone =
            $("editPersonPhone")
              .value
              .trim() || null;

          const notes =
            $("editPersonNotes")
              .value
              .trim() || null;


          const {
            error
          } =
            await supabaseClient
              .from("people")
              .update({

                name,
                phone,
                notes,

                updated_at:
                  new Date().toISOString()
              })
              .eq(
                "id",
                person.id
              )
              .eq(
                "office_id",
                state.office.id
              );


          if (error) {

            console.error(
              "Edit person:",
              error
            );

            alert(
              "تعذر تعديل البيانات."
            );

            return;
          }


          closeModal();

          await loadOfficeData();


          const updated =
            state.people.find(
              item =>
                item.id ===
                person.id
            );


          if (updated) {
            renderPersonCard(
              updated
            );
          }
        }
      );
  }


  // =========================================================
  // DELETE PERSON
  // =========================================================

  async function deleteCurrentPerson() {

    const person =
      state.people.find(
        item =>
          item.id ===
          state.currentPersonId
      );


    if (!person) return;


    const ok =
      confirm(
        `هل تريد حذف ${person.name}؟\n\nسيتم حذف سجل حركاته أيضًا.`
      );


    if (!ok) return;


    const {
      error
    } =
      await supabaseClient
        .from("people")
        .delete()
        .eq(
          "id",
          person.id
        )
        .eq(
          "office_id",
          state.office.id
        );


    if (error) {

      console.error(
        "Delete person:",
        error
      );

      alert(
        "تعذر حذف الشخص."
      );

      return;
    }


    state.currentPersonId =
      null;


    await loadOfficeData();

    showPeopleView();
  }


  // =========================================================
  // BACK
  // =========================================================

  function showPeopleView() {

    show("peopleView");
    hide("personView");

    state.currentPersonId =
      null;

    renderPeople();
  }


  // =========================================================
  // EXPORT
  // =========================================================

  async function exportData() {

    if (!state.office) {
      return;
    }


    const {
      data: people,
      error: peopleError
    } =
      await supabaseClient
        .from("people")
        .select("*")
        .eq(
          "office_id",
          state.office.id
        );


    if (peopleError) {

      alert(
        "تعذر تصدير الأشخاص."
      );

      return;
    }


    const {
      data: transactions,
      error: transactionError
    } =
      await supabaseClient
        .from("transactions")
        .select("*")
        .eq(
          "office_id",
          state.office.id
        );


    if (transactionError) {

      alert(
        "تعذر تصدير الحركات."
      );

      return;
    }


    const backup = {

      version: 1,

      exported_at:
        new Date().toISOString(),

      office: {
        id:
          state.office.id,

        name:
          state.office.name
      },

      people:
        people || [],

      transactions:
        transactions || []
    };


    const blob =
      new Blob(
        [
          JSON.stringify(
            backup,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download =
      `debt-book-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  }


  // =========================================================
  // IMPORT
  // =========================================================

  async function importData(
    event
  ) {

    if (!state.office) {
      return;
    }


    const file =
      event.target.files?.[0];


    if (!file) return;


    try {

      const textData =
        await file.text();


      const backup =
        JSON.parse(
          textData
        );


      if (
        !backup ||
        !Array.isArray(
          backup.people
        ) ||
        !Array.isArray(
          backup.transactions
        )
      ) {

        throw new Error(
          "ملف النسخة الاحتياطية غير صحيح."
        );
      }


      const ok =
        confirm(
          "استيراد النسخة سيضيف البيانات إلى المكتب الحالي.\n\nهل تريد المتابعة؟"
        );


      if (!ok) return;


      const peopleMap =
        {};


      for (
        const oldPerson
        of backup.people
      ) {

        const {
          data: person,
          error
        } =
          await supabaseClient
            .from("people")
            .insert({

              office_id:
                state.office.id,

              name:
                oldPerson.name ||
                "بدون اسم",

              phone:
                oldPerson.phone ||
                null,

              notes:
                oldPerson.notes ||
                null
            })
            .select()
            .single();


        if (error) {
          throw error;
        }


        peopleMap[
          oldPerson.id
        ] =
          person.id;
      }


      for (
        const oldTransaction
        of backup.transactions
      ) {

        const newPersonId =
          peopleMap[
            oldTransaction.person_id
          ];


        if (!newPersonId) {
          continue;
        }


        const {
          error
        } =
          await supabaseClient
            .from("transactions")
            .insert({

              office_id:
                state.office.id,

              person_id:
                newPersonId,

              type:
                oldTransaction.type,

              amount:
                Number(
                  oldTransaction.amount
                ),

              description:
                oldTransaction.description ||
                null
            });


        if (error) {
          throw error;
        }
      }


      alert(
        "تم استيراد النسخة بنجاح."
      );


      await loadOfficeData();


    } catch (error) {

      console.error(
        "Import:",
        error
      );

      alert(
        "تعذر استيراد النسخة.\n\n" +
        (
          error.message ||
          "الملف غير صحيح."
        )
      );

    } finally {

      event.target.value = "";
    }
  }


  // =========================================================
  // MODAL
  // =========================================================

  function openModal(
    title,
    body
  ) {

    text(
      "modalTitle",
      title
    );


    const modalBody =
      $("modalBody");

    if (modalBody) {
      modalBody.innerHTML =
        body;
    }


    show("modal");
  }


  function closeModal() {

    hide("modal");

    const body =
      $("modalBody");

    if (body) {
      body.innerHTML = "";
    }
  }


  // =========================================================
  // EVENT LISTENERS
  // =========================================================

  function setupEvents() {

    $("loginForm")
      ?.addEventListener(
        "submit",
        handleLogin
      );


    $("logoutBtn")
      ?.addEventListener(
        "click",
        logout
      );


    $("adminLogoutBtn")
      ?.addEventListener(
        "click",
        logout
      );


    $("addOfficeBtn")
      ?.addEventListener(
        "click",
        openAddOfficeModal
      );


    $("officeSearch")
      ?.addEventListener(
        "input",
        renderOffices
      );


    $("searchInput")
      ?.addEventListener(
        "input",
        renderPeople
      );


    $("addPersonBtn")
      ?.addEventListener(
        "click",
        openAddPersonModal
      );


    $("backBtn")
      ?.addEventListener(
        "click",
        showPeopleView
      );


    $("payBtn")
      ?.addEventListener(
        "click",
        () =>
          addTransaction(
            "payment"
          )
      );


    $("purchaseBtn")
      ?.addEventListener(
        "click",
        () =>
          addTransaction(
            "purchase"
          )
      );


    $("editPersonBtn")
      ?.addEventListener(
        "click",
        editCurrentPerson
      );


    $("exportBtn")
      ?.addEventListener(
        "click",
        exportData
      );


    $("importBtn")
      ?.addEventListener(
        "click",
        () =>
          $("importFile")?.click()
      );


    $("importFile")
      ?.addEventListener(
        "change",
        importData
      );


    $("modalClose")
      ?.addEventListener(
        "click",
        closeModal
      );


    $("modal")
      ?.addEventListener(
        "click",
        function (event) {

          if (
            event.target ===
            $("modal")
          ) {
            closeModal();
          }

        }
      );


    $("backToAdminBtn")
      ?.addEventListener(
        "click",
        async function () {

          if (
            state.role !==
            "admin"
          ) {
            return;
          }

          await loadAdminData();

          showAdminView();
        }
      );
  }


  // =========================================================
  // AUTH STATE
  // =========================================================

  function setupAuthListener() {

    if (!supabaseClient) {
      return;
    }


    supabaseClient.auth.onAuthStateChange(
      async (
        event,
        session
      ) => {

        console.log(
          "Supabase Auth:",
          event
        );


        if (
          event ===
          "SIGNED_OUT"
        ) {

          state.user = null;
          state.role = null;
          state.office = null;

          showLoginView();

          return;
        }


        if (
          event ===
            "SIGNED_IN" &&
          session?.user
        ) {

          state.user =
            session.user;
        }

      }
    );
  }


  // =========================================================
  // STARTUP
  // =========================================================

  async function startApp() {

    console.log(
      "Starting Debt Book..."
    );


    setupEvents();

    setupAuthListener();


    if (!supabaseClient) {

      showLoginView();

      showLoginMessage(
        "تعذر الاتصال بـ Supabase. تحقق من supabase-config.js",
        "error"
      );

      return;
    }


    try {

      const {
        data,
        error
      } =
        await supabaseClient.auth.getSession();


      if (error) {

        console.error(
          "Get session:",
          error
        );

        showLoginView();

        return;
      }


      const session =
        data?.session;


      if (!session?.user) {

        console.log(
          "No Supabase session"
        );

        showLoginView();

        return;
      }


      console.log(
        "Existing Supabase session"
      );


      state.user =
        session.user;


      const isAdmin =
        await checkAdmin(
          session.user.id
        );


      if (isAdmin) {

        state.role =
          "admin";

        await loadAdminData();

        showAdminView();

        return;
      }


      const office =
        await getOfficeForUser(
          session.user.id
        );


      if (!office) {

        await supabaseClient.auth.signOut({
          scope: "local"
        });

        showLoginView();

        showLoginMessage(
          "الحساب غير مرتبط بأي مكتب.",
          "error"
        );

        return;
      }


      state.role =
        "office";

      state.office =
        office;


      const contract =
        getContractStatus(
          office
        );


      if (!contract.valid) {

        await supabaseClient.auth.signOut({
          scope: "local"
        });

        state.role = null;
        state.office = null;

        showLoginView();

        showLoginMessage(
          contract.text,
          "error"
        );

        return;
      }


      await loadOfficeData();

      showAppView();


    } catch (error) {

      console.error(
        "Startup:",
        error
      );

      showLoginView();

      showLoginMessage(
        "حدث خطأ أثناء تشغيل التطبيق.",
        "error"
      );
    }
  }


  // =========================================================
  // GLOBAL FUNCTIONS
  // =========================================================

  window.openAddOffice =
    openAddOfficeModal;

  window.openAddPerson =
    openAddPersonModal;

  window.logout =
    logout;


  // =========================================================
  // START
  // =========================================================

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      startApp
    );

  } else {

    startApp();

  }

})();