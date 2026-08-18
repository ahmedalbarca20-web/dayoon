(function () {

  "use strict";


  // =====================================================
  // SUPABASE CONFIG
  // =====================================================

  const CFG =
    window.SUPABASE_CONFIG || {};

  const SUPABASE_URL =
    CFG.SUPABASE_URL || "";

  const SUPABASE_ANON_KEY =
    CFG.SUPABASE_ANON_KEY || "";


  let supabaseClient = null;


  if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY
  ) {

    supabaseClient =
      window.supabase.createClient(
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

    console.log(
      "Supabase connected"
    );

  } else {

    console.error(
      "Supabase configuration missing"
    );

  }


  // =====================================================
  // STATE
  // =====================================================

  const state = {

    user: null,

    isAdmin: false,

    office: null,

    people: [],

    offices: [],

    editingPersonId: null,

    search: ""

  };


  // =====================================================
  // HELPERS
  // =====================================================

  const $ = id =>
    document.getElementById(id);


  function show(id) {

    const el = $(id);

    if (el)
      el.classList.remove("hidden");

  }


  function hide(id) {

    const el = $(id);

    if (el)
      el.classList.add("hidden");

  }


  function message(
    id,
    text,
    type = "error"
  ) {

    const el = $(id);

    if (!el) return;

    el.className =
      "message " + type;

    el.textContent = text;

  }


  function clearMessage(id) {

    const el = $(id);

    if (!el) return;

    el.className = "";

    el.textContent = "";

  }


  function today() {

    const d = new Date();

    const month =
      String(
        d.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        d.getDate()
      ).padStart(2, "0");

    return (
      d.getFullYear() +
      "-" +
      month +
      "-" +
      day
    );

  }


  function money(value) {

    return Number(
      value || 0
    ).toLocaleString(
      "ar-IQ"
    );

  }


  // =====================================================
  // LOADING
  // =====================================================

  function finishLoading() {

    hide("loadingScreen");

  }


  // =====================================================
  // INITIALIZATION
  // =====================================================

  async function start() {

    console.log(
      "Starting Debt Book..."
    );


    if (!supabaseClient) {

      finishLoading();

      show("loginPage");

      message(
        "loginMessage",
        "خطأ: إعدادات Supabase غير موجودة. تأكد من config.js."
      );

      return;

    }


    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .auth
          .getSession();


      if (error)
        throw error;


      if (
        data &&
        data.session
      ) {

        console.log(
          "Existing Supabase session"
        );

        state.user =
          data.session.user;

        await routeUser();

      } else {

        show("loginPage");

      }

    } catch (error) {

      console.error(
        "Startup:",
        error
      );

      show("loginPage");

    }


    finishLoading();

  }


  // =====================================================
  // AUTH STATE
  // =====================================================

  if (window.supabase) {

    /*
      لا نستخدم SIGNED_IN لإعادة تحميل الصفحة.
      فقط نحدّث الحالة.
    */

    setTimeout(() => {

      if (!supabaseClient)
        return;

      supabaseClient
        .auth
        .onAuthStateChange(
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
              state.office = null;
              state.isAdmin = false;

              hide("adminPage");
              hide("officePage");

              show("loginPage");

            }

          }
        );

    }, 0);

  }


  // =====================================================
  // ROUTE USER
  // =====================================================

  async function routeUser() {

    if (!state.user) {

      show("loginPage");

      return;

    }


    const admin =
      await checkAdmin(
        state.user.id
      );


    if (admin) {

      state.isAdmin = true;

      hide("loginPage");

      hide("officePage");

      show("adminPage");

      if ($("adminEmail"))
        $("adminEmail").textContent =
          state.user.email || "";

      await loadOffices();

      return;

    }


    const office =
      await getOffice(
        state.user.id
      );


    if (!office) {

      await supabaseClient
        .auth
        .signOut();

      show("loginPage");

      message(
        "loginMessage",
        "هذا الحساب غير مرتبط بأي مكتب."
      );

      return;

    }


    state.office = office;


    if (!office.active) {

      await supabaseClient
        .auth
        .signOut();

      show("loginPage");

      message(
        "loginMessage",
        "هذا المكتب غير فعال حالياً."
      );

      return;

    }


    if (
      office.contract_end &&
      office.contract_end <
      today()
    ) {

      await supabaseClient
        .auth
        .signOut();

      show("loginPage");

      message(
        "loginMessage",
        "انتهت مدة عقد هذا المكتب."
      );

      return;

    }


    hide("loginPage");

    hide("adminPage");

    show("officePage");


    $("officeName").textContent =
      office.name;


    updateContractStatus(
      office
    );


    await loadPeople();

  }


  // =====================================================
  // CHECK ADMIN
  // =====================================================

  async function checkAdmin(
    userId
  ) {

    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("admins")
          .select("user_id")
          .eq(
            "user_id",
            userId
          )
          .maybeSingle();


      if (error) {

        console.error(
          "Check admin:",
          error
        );

        return false;

      }


      return !!data;

    } catch (error) {

      console.error(
        error
      );

      return false;

    }

  }


  // =====================================================
  // GET OFFICE
  // =====================================================

  async function getOffice(
    userId
  ) {

    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("offices")
          .select("*")
          .eq(
            "user_id",
            userId
          )
          .maybeSingle();


      if (error) {

        console.error(
          "Get office:",
          error
        );

        return null;

      }


      return data;

    } catch (error) {

      console.error(
        error
      );

      return null;

    }

  }


  // =====================================================
  // LOGIN
  // =====================================================

  async function handleLogin(
    event
  ) {

    event.preventDefault();


    if (!supabaseClient) {

      message(
        "loginMessage",
        "Supabase غير متصل."
      );

      return;

    }


    const email =
      $("loginEmail")
        .value
        .trim();

    const password =
      $("loginPassword")
        .value;


    if (!email || !password) {

      message(
        "loginMessage",
        "أدخل البريد وكلمة المرور."
      );

      return;

    }


    const btn =
      $("loginBtn");

    btn.disabled = true;

    btn.textContent =
      "جارٍ الدخول...";


    clearMessage(
      "loginMessage"
    );


    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .auth
          .signInWithPassword({
            email,
            password
          });


      if (error)
        throw error;


      if (!data.session) {

        throw new Error(
          "لم يتم إنشاء جلسة."
        );

      }


      state.user =
        data.user;


      await routeUser();


    } catch (error) {

      console.error(
        "Login:",
        error
      );


      message(
        "loginMessage",
        "بيانات الدخول غير صحيحة أو الحساب غير موجود."
      );

    } finally {

      btn.disabled = false;

      btn.textContent =
        "تسجيل الدخول";

    }

  }


  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {

    try {

      await supabaseClient
        .auth
        .signOut();

    } catch (error) {

      console.error(
        "Logout:",
        error
      );

    }

  }


  // =====================================================
  // LOAD OFFICES
  // =====================================================

  async function loadOffices() {

    const box =
      $("officesList");

    box.innerHTML =
      "<div class='empty'>جارٍ تحميل المكاتب...</div>";


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

      box.innerHTML =
        "<div class='empty'>تعذر تحميل المكاتب.</div>";

      return;

    }


    state.offices =
      data || [];


    renderOffices();

  }


  // =====================================================
  // RENDER OFFICES
  // =====================================================

  function renderOffices() {

    const box =
      $("officesList");


    if (!state.offices.length) {

      box.innerHTML =
        "<div class='empty'>لا توجد مكاتب حتى الآن.</div>";

      return;

    }


    box.innerHTML =
      state.offices
        .map(
          office => {

            const active =
              office.active;

            const end =
              office.contract_end
              || "غير محدد";


            return `

              <div class="office-card">

                <h3>
                  ${escapeHtml(
                    office.name
                  )}
                </h3>

                <p class="muted">
                  ${escapeHtml(
                    office.phone || ""
                  )}
                </p>

                <p>
                  <span class="badge ${
                    active
                    ? "active"
                    : "inactive"
                  }">
                    ${
                      active
                      ? "فعال"
                      : "متوقف"
                    }
                  </span>
                </p>

                <p class="muted">
                  نهاية العقد:
                  ${end}
                </p>

                <div class="card-actions">

                  <button
                    class="btn ${
                      active
                      ? "danger"
                      : "success"
                    }"
                    onclick="window.toggleOffice(
                      '${office.id}',
                      ${!active}
                    )"
                  >
                    ${
                      active
                      ? "تعطيل"
                      : "تفعيل"
                    }
                  </button>

                </div>

              </div>

            `;

          }
        )
        .join("");

  }


  // =====================================================
  // TOGGLE OFFICE
  // =====================================================

  window.toggleOffice =
    async function (
      officeId,
      active
    ) {

      const {
        error
      } =
        await supabaseClient
          .from("offices")
          .update({
            active
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
          "تعذر تعديل حالة المكتب."
        );

        return;

      }


      await loadOffices();

    };


  // =====================================================
  // OPEN OFFICE MODAL
  // =====================================================

  function openOfficeModal() {

    clearMessage(
      "officeMessage"
    );

    $("officeForm").reset();

    $("officeActiveInput")
      .checked = true;

    show("officeModal");

  }


  // =====================================================
  // CREATE OFFICE
  // =====================================================

  /*
    مهم:

    إنشاء مستخدم Auth من المتصفح باستخدام
    signUp لا يعطيك إنشاء إداري مضمون
    بدون تغيير جلسة المستخدم.

    لذلك هنا نستخدم Edge Function:

    create-office

    وتكون هي التي تستعمل service_role
    داخل Supabase.

    لا تضع service_role داخل app.js.
  */

  async function saveOffice(
    event
  ) {

    event.preventDefault();


    const name =
      $("officeNameInput")
        .value
        .trim();

    const email =
      $("officeEmailInput")
        .value
        .trim();

    const password =
      $("officePasswordInput")
        .value;

    const phone =
      $("officePhoneInput")
        .value
        .trim();

    const contractStart =
      $("contractStartInput")
        .value || null;

    const contractEnd =
      $("contractEndInput")
        .value || null;

    const active =
      $("officeActiveInput")
        .checked;


    if (
      !name ||
      !email ||
      !password
    ) {

      message(
        "officeMessage",
        "أكمل البيانات المطلوبة."
      );

      return;

    }


    const btn =
      $("saveOfficeBtn");

    btn.disabled = true;

    btn.textContent =
      "جارٍ الإنشاء...";


    try {

      const {
        data: sessionData
      } =
        await supabaseClient
          .auth
          .getSession();


      const token =
        sessionData
          ?.session
          ?.access_token;


      if (!token) {

        throw new Error(
          "لا توجد جلسة Admin."
        );

      }


      const response =
        await fetch(
          SUPABASE_URL +
          "/functions/v1/create-office",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Authorization":
                "Bearer " + token,

              "apikey":
                SUPABASE_ANON_KEY
            },

            body: JSON.stringify({
              name,
              email,
              password,
              phone,
              contract_start:
                contractStart,
              contract_end:
                contractEnd,
              active
            })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "فشل إنشاء المكتب"
        );

      }


      message(
        "officeMessage",
        "تم إنشاء المكتب بنجاح.",
        "success"
      );


      $("officeForm").reset();

      $("officeActiveInput")
        .checked = true;


      await loadOffices();


      setTimeout(
        () => {
          hide("officeModal");
        },
        800
      );


    } catch (error) {

      console.error(
        "Create office:",
        error
      );


      message(
        "officeMessage",
        error.message ||
        "تعذر إنشاء المكتب."
      );

    } finally {

      btn.disabled = false;

      btn.textContent =
        "إنشاء المكتب";

    }

  }


  // =====================================================
  // LOAD PEOPLE
  // =====================================================

  async function loadPeople() {

    if (!state.office)
      return;


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

      $("peopleList").innerHTML =
        "<div class='empty'>تعذر تحميل الأشخاص.</div>";

      return;

    }


    state.people =
      data || [];


    renderPeople();

    updateStats();

  }


  // =====================================================
  // RENDER PEOPLE
  // =====================================================

  function renderPeople() {

    const box =
      $("peopleList");


    let people =
      state.people;


    if (state.search) {

      const q =
        state.search
          .toLowerCase();

      people =
        people.filter(
          person =>
            (
              person.name || ""
            )
              .toLowerCase()
              .includes(q)
        );

    }


    if (!people.length) {

      box.innerHTML =
        "<div class='empty'>لا يوجد أشخاص.</div>";

      return;

    }


    box.innerHTML =
      people
        .map(
          person => {

            const isDebt =
              person.type ===
              "debt";


            return `

              <div class="person-card">

                <h3>
                  ${escapeHtml(
                    person.name
                  )}
                </h3>

                <span class="badge ${
                  isDebt
                  ? "debt"
                  : "credit"
                }">
                  ${
                    isDebt
                    ? "مديون لنا"
                    : "نحن مديونون له"
                  }
                </span>

                <div class="person-amount ${
                  isDebt
                  ? "debt"
                  : "credit"
                }">

                  ${money(
                    person.amount
                  )}

                </div>

                <p class="muted">

                  التاريخ:
                  ${
                    person.debt_date ||
                    "غير محدد"
                  }

                </p>

                ${
                  person.phone
                  ? `
                    <p class="muted">
                      📞
                      ${escapeHtml(
                        person.phone
                      )}
                    </p>
                  `
                  : ""
                }


                <div class="card-actions">

                  <button
                    class="btn secondary"
                    onclick="window.editPerson(
                      '${person.id}'
                    )"
                  >
                    تعديل
                  </button>

                  <button
                    class="btn danger"
                    onclick="window.deletePerson(
                      '${person.id}'
                    )"
                  >
                    حذف
                  </button>

                </div>

              </div>

            `;

          }
        )
        .join("");

  }


  // =====================================================
  // STATS
  // =====================================================

  function updateStats() {

    $("peopleCount")
      .textContent =
      state.people.length;


    const debt =
      state.people
        .filter(
          p =>
            p.type === "debt"
        )
        .reduce(
          (
            total,
            p
          ) =>
            total +
            Number(
              p.amount || 0
            ),
          0
        );


    const credit =
      state.people
        .filter(
          p =>
            p.type === "credit"
        )
        .reduce(
          (
            total,
            p
          ) =>
            total +
            Number(
              p.amount || 0
            ),
          0
        );


    $("totalDebt")
      .textContent =
      money(debt);


    $("totalCredit")
      .textContent =
      money(credit);

  }


  // =====================================================
  // OPEN PERSON MODAL
  // =====================================================

  function openPersonModal() {

    state.editingPersonId =
      null;


    $("personModalTitle")
      .textContent =
      "إضافة شخص";


    $("personForm").reset();


    $("personId")
      .value = "";


    $("personDate")
      .value =
      today();


    setPersonType(
      "debt"
    );


    clearMessage(
      "personMessage"
    );


    show("personModal");

  }


  // =====================================================
  // TYPE
  // =====================================================

  function setPersonType(
    type
  ) {

    $("personType")
      .value = type;


    document
      .querySelectorAll(
        ".type-btn"
      )
      .forEach(
        btn => {

          btn.classList
            .remove(
              "active"
            );

        }
      );


    const target =
      document.querySelector(
        `.type-btn[data-type="${type}"]`
      );


    if (target)
      target.classList
        .add("active");

  }


  // =====================================================
  // SAVE PERSON
  // =====================================================

  async function savePerson(
    event
  ) {

    event.preventDefault();


    if (!state.office) {

      message(
        "personMessage",
        "لا يوجد مكتب مسجل."
      );

      return;

    }


    const id =
      $("personId")
        .value;


    const payload = {

      office_id:
        state.office.id,

      name:
        $("personName")
          .value
          .trim(),

      phone:
        $("personPhone")
          .value
          .trim(),

      type:
        $("personType")
          .value,

      amount:
        Number(
          $("personAmount")
            .value || 0
        ),

      debt_date:
        $("personDate")
          .value,

      notes:
        $("personNotes")
          .value
          .trim()

    };


    if (!payload.name) {

      message(
        "personMessage",
        "اكتب اسم الشخص."
      );

      return;

    }


    try {

      let result;


      if (id) {

        result =
          await supabaseClient
            .from("people")
            .update(
              payload
            )
            .eq(
              "id",
              id
            )
            .eq(
              "office_id",
              state.office.id
            );

      } else {

        result =
          await supabaseClient
            .from("people")
            .insert(
              payload
            );

      }


      if (result.error)
        throw result.error;


      message(
        "personMessage",
        id
          ? "تم تعديل الشخص."
          : "تمت إضافة الشخص.",
        "success"
      );


      await loadPeople();


      setTimeout(
        () => {
          hide("personModal");
        },
        500
      );


    } catch (error) {

      console.error(
        "Save person:",
        error
      );


      message(
        "personMessage",
        "تعذر حفظ الشخص: " +
        (
          error.message ||
          ""
        )
      );

    }

  }


  // =====================================================
  // EDIT PERSON
  // =====================================================

  window.editPerson =
    function (id) {

      const person =
        state.people.find(
          p =>
            p.id === id
        );


      if (!person)
        return;


      state.editingPersonId =
        id;


      $("personModalTitle")
        .textContent =
        "تعديل الشخص";


      $("personId")
        .value =
        person.id;


      $("personName")
        .value =
        person.name || "";


      $("personPhone")
        .value =
        person.phone || "";


      $("personAmount")
        .value =
        person.amount || 0;


      $("personDate")
        .value =
        person.debt_date ||
        today();


      $("personNotes")
        .value =
        person.notes || "";


      setPersonType(
        person.type || "debt"
      );


      clearMessage(
        "personMessage"
      );


      show("personModal");

    };


  // =====================================================
  // DELETE PERSON
  // =====================================================

  window.deletePerson =
    async function (id) {

      const person =
        state.people.find(
          p =>
            p.id === id
        );


      if (!person)
        return;


      const yes =
        confirm(
          `هل تريد حذف "${person.name}"؟`
        );


      if (!yes)
        return;


      const {
        error
      } =
        await supabaseClient
          .from("people")
          .delete()
          .eq(
            "id",
            id
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


      await loadPeople();

    };


  // =====================================================
  // CONTRACT
  // =====================================================

  function updateContractStatus(
    office
  ) {

    const el =
      $("contractStatus");


    if (!office.contract_end) {

      el.textContent =
        "العقد: غير محدد";

      return;

    }


    const end =
      new Date(
        office.contract_end
      );


    const now =
      new Date();


    const diff =
      Math.ceil(
        (
          end - now
        ) /
        (
          1000 *
          60 *
          60 *
          24
        )
      );


    if (diff < 0) {

      el.textContent =
        "العقد منتهي";

    } else {

      el.textContent =
        `متبقي ${diff} يوم`;

    }

  }


  // =====================================================
  // ESCAPE HTML
  // =====================================================

  function escapeHtml(
    value
  ) {

    return String(
      value || ""
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


  // =====================================================
  // CLOSE MODALS
  // =====================================================

  document.addEventListener(
    "click",
    event => {

      const close =
        event.target.closest(
          "[data-close]"
        );


      if (!close)
        return;


      hide(
        close.dataset.close
      );

    }
  );


  // =====================================================
  // EVENTS
  // =====================================================

  document.addEventListener(
    "DOMContentLoaded",
    () => {


      $("loginForm")
        ?.addEventListener(
          "submit",
          handleLogin
        );


      $("adminLogoutBtn")
        ?.addEventListener(
          "click",
          logout
        );


      $("officeLogoutBtn")
        ?.addEventListener(
          "click",
          logout
        );


      $("openOfficeModalBtn")
        ?.addEventListener(
          "click",
          openOfficeModal
        );


      $("officeForm")
        ?.addEventListener(
          "submit",
          saveOffice
        );


      $("openPersonModalBtn")
        ?.addEventListener(
          "click",
          openPersonModal
        );


      $("personForm")
        ?.addEventListener(
          "submit",
          savePerson
        );


      $("searchPeople")
        ?.addEventListener(
          "input",
          event => {

            state.search =
              event.target.value
                .trim();

            renderPeople();

          }
        );


      document
        .querySelectorAll(
          ".type-btn"
        )
        .forEach(
          button => {

            button.addEventListener(
              "click",
              () => {

                setPersonType(
                  button.dataset.type
                );

              }
            );

          }
        );


      start();

    }
  );

})();