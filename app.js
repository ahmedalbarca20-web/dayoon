(function () {
  "use strict";

  // =========================================================
  // DEBT BOOK - APP.JS
  // =========================================================

  console.log("Starting Debt Book...");

  // =========================================================
  // SUPABASE CONFIG
  // =========================================================

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL =
    CFG.SUPABASE_URL || "";

  const SUPABASE_ANON_KEY =
    CFG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  if (
    !window.supabase ||
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    console.error(
      "Supabase configuration missing"
    );

    document.addEventListener(
      "DOMContentLoaded",
      function () {
        const loading =
          document.getElementById(
            "loadingScreen"
          );

        if (loading) {
          loading.classList.add("hidden");
        }

        const msg =
          document.getElementById(
            "loginMessage"
          );

        if (msg) {
          msg.textContent =
            "خطأ في إعدادات Supabase. تأكد من ملف supabase-config.js";
          msg.className =
            "login-message error";
        }
      }
    );

    return;
  }

  try {
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
  } catch (error) {
    console.error(
      "Supabase client error:",
      error
    );
    return;
  }

  // =========================================================
  // STATE
  // =========================================================

  const state = {
    user: null,

    role: null,

    office: null,

    offices: [],

    people: [],

    transactions: [],

    currentPersonId: null,

    searchQuery: "",

    initialized: false
  };

  // =========================================================
  // DOM HELPERS
  // =========================================================

  function $(id) {
    return document.getElementById(id);
  }

  function show(id) {
    const el = $(id);

    if (el) {
      el.classList.remove("hidden");
    }
  }

  function hide(id) {
    const el = $(id);

    if (el) {
      el.classList.add("hidden");
    }
  }

  function text(id, value) {
    const el = $(id);

    if (el) {
      el.textContent =
        value == null ? "" : value;
    }
  }

  function value(id) {
    const el = $(id);

    return el
      ? String(el.value || "").trim()
      : "";
  }

  function setValue(id, val) {
    const el = $(id);

    if (el) {
      el.value =
        val == null ? "" : val;
    }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notify(message, type) {
    console.log(
      `[${type || "info"}]`,
      message
    );

    alert(message);
  }

  // =========================================================
  // LOADING
  // =========================================================

  function finishLoading() {
    const loading =
      $("loadingScreen");

    if (loading) {
      loading.classList.add(
        "hidden"
      );
    }
  }

  // =========================================================
  // AUTH
  // =========================================================

  async function getSession() {
    try {
      const {
        data,
        error
      } =
        await supabaseClient.auth
          .getSession();

      if (error) {
        console.error(
          "Get session:",
          error
        );

        return null;
      }

      return data.session || null;

    } catch (error) {
      console.error(
        "Session error:",
        error
      );

      return null;
    }
  }

  // =========================================================
  // CHECK ADMIN
  // =========================================================

  async function checkAdmin(userId) {
    if (!userId) {
      return false;
    }

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
        "Check admin exception:",
        error
      );

      return false;
    }
  }

  // =========================================================
  // GET OFFICE
  // =========================================================

  async function getOffice(userId) {
    if (!userId) {
      return null;
    }

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

      return data || null;

    } catch (error) {
      console.error(
        "Get office exception:",
        error
      );

      return null;
    }
  }

  // =========================================================
  // LOGIN
  // =========================================================

  async function handleLogin(
    email,
    password
  ) {
    email =
      String(email || "")
        .trim()
        .toLowerCase();

    password =
      String(password || "");

    if (!email || !password) {
      notify(
        "أدخل البريد الإلكتروني وكلمة المرور.",
        "error"
      );

      return;
    }

    try {
      console.log(
        "Trying login:",
        email
      );

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {
        console.error(
          "Auth login failed:",
          error
        );

        notify(
          "بيانات الدخول غير صحيحة.",
          "error"
        );

        return;
      }

      if (!data || !data.user) {
        notify(
          "تعذر إنشاء جلسة الدخول.",
          "error"
        );

        return;
      }

      state.user =
        data.user;

      console.log(
        "SIGNED_IN:",
        state.user.email
      );

      await loadUserProfile();

    } catch (error) {
      console.error(
        "Login:",
        error
      );

      notify(
        "حدث خطأ أثناء تسجيل الدخول.",
        "error"
      );
    }
  }

  // =========================================================
  // LOAD USER PROFILE
  // =========================================================

  async function loadUserProfile() {
    if (!state.user) {
      return;
    }

    // -------------------------
    // ADMIN
    // -------------------------

    const isAdmin =
      await checkAdmin(
        state.user.id
      );

    if (isAdmin) {

      state.role =
        "admin";

      state.office =
        null;

      console.log(
        "Logged as ADMIN"
      );

      await loadAdminPage();

      return;
    }

    // -------------------------
    // OFFICE
    // -------------------------

    const office =
      await getOffice(
        state.user.id
      );

    if (!office) {

      console.error(
        "No office profile found."
      );

      await supabaseClient.auth
        .signOut();

      notify(
        "هذا الحساب غير مرتبط بمكتب.",
        "error"
      );

      return;
    }

    // -------------------------
    // CHECK ACTIVE
    // -------------------------

    if (
      office.active === false
    ) {

      await supabaseClient.auth
        .signOut();

      notify(
        "هذا المكتب معطل من قبل الأدمن.",
        "error"
      );

      return;
    }

    // -------------------------
    // CHECK CONTRACT
    // -------------------------

    if (
      office.contract_end
    ) {

      const end =
        new Date(
          office.contract_end
        );

      const now =
        new Date();

      if (
        !Number.isNaN(
          end.getTime()
        ) &&
        end < now
      ) {

        await supabaseClient.auth
          .signOut();

        notify(
          "مدة عقد هذا المكتب انتهت.",
          "error"
        );

        return;
      }
    }

    state.role =
      "office";

    state.office =
      office;

    console.log(
      "Logged as OFFICE:",
      office.id
    );

    await loadOfficePage();
  }

  // =========================================================
  // ADMIN PAGE
  // =========================================================

  async function loadAdminPage() {

    hide("loginPage");
    hide("loginScreen");

    show("adminPage");
    show("adminDashboard");
    hide("officePage");
    hide("officeDashboard");

    text(
      "currentUser",
      state.user?.email || "Admin"
    );

    await loadOffices();
  }

  // =========================================================
  // OFFICE PAGE
  // =========================================================

  async function loadOfficePage() {

    hide("loginPage");
    hide("loginScreen");

    hide("adminPage");
    hide("adminDashboard");

    show("officePage");
    show("officeDashboard");

    text(
      "officeName",
      state.office?.name ||
      state.office?.office_name ||
      "المكتب"
    );

    text(
      "currentOfficeName",
      state.office?.name ||
      state.office?.office_name ||
      "المكتب"
    );

    await loadPeople();
  }

  // =========================================================
  // LOAD OFFICES - ADMIN ONLY
  // =========================================================

  async function loadOffices() {

    if (
      state.role !== "admin"
    ) {
      return;
    }

    try {

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

        return;
      }

      state.offices =
        data || [];

      renderOffices();

    } catch (error) {

      console.error(
        "Load offices exception:",
        error
      );
    }
  }

  // =========================================================
  // RENDER OFFICES
  // =========================================================

  function renderOffices() {

    const container =
      $("officesList");

    if (!container) {
      return;
    }

    if (
      !state.offices.length
    ) {

      container.innerHTML =
        `
        <div class="empty-state">
          لا توجد مكاتب حالياً
        </div>
        `;

      return;
    }

    container.innerHTML =
      state.offices
        .map(
          office => {

            const active =
              office.active !== false;

            let contractText =
              "بدون مدة";

            if (
              office.contract_end
            ) {

              const date =
                new Date(
                  office.contract_end
                );

              if (
                !Number.isNaN(
                  date.getTime()
                )
              ) {
                contractText =
                  date.toLocaleDateString(
                    "ar-IQ"
                  );
              }
            }

            return `
              <div class="office-card">

                <div class="office-card-header">
                  <h3>
                    ${escapeHtml(
                      office.name ||
                      office.office_name ||
                      "مكتب"
                    )}
                  </h3>

                  <span class="${
                    active
                      ? "status-active"
                      : "status-disabled"
                  }">
                    ${
                      active
                        ? "فعال"
                        : "معطل"
                    }
                  </span>
                </div>

                <div class="office-info">

                  <p>
                    <strong>البريد:</strong>
                    ${escapeHtml(
                      office.email || "-"
                    )}
                  </p>

                  <p>
                    <strong>نهاية العقد:</strong>
                    ${escapeHtml(
                      contractText
                    )}
                  </p>

                </div>

                <div class="office-actions">

                  <button
                    type="button"
                    onclick="DebtBook.toggleOffice('${office.id}', ${active})"
                  >
                    ${
                      active
                        ? "تعطيل"
                        : "تفعيل"
                    }
                  </button>

                  <button
                    type="button"
                    onclick="DebtBook.editOffice('${office.id}')"
                  >
                    تعديل
                  </button>

                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  // =========================================================
  // CREATE OFFICE ACCOUNT
  // =========================================================

  /*
    مهم:

    إنشاء مستخدم Auth من المتصفح مباشرة غير آمن
    إذا استخدمنا service_role.

    لذلك هذا الكود يستدعي Edge Function
    اسمها:

        create-office

    والـ Edge Function هي التي تنشئ Auth User
    ثم تحفظ المكتب في جدول offices.

    لا تضع service_role داخل app.js.
  */

  async function createOffice(data) {

    if (
      state.role !== "admin"
    ) {

      notify(
        "فقط الأدمن يستطيع إنشاء مكتب.",
        "error"
      );

      return null;
    }

    try {

      const {
        data: result,
        error
      } =
        await supabaseClient.functions
          .invoke(
            "create-office",
            {
              body: {
                name:
                  data.name,

                email:
                  data.email,

                password:
                  data.password,

                contract_end:
                  data.contract_end,

                active:
                  true
              }
            }
          );

      if (error) {

        console.error(
          "Create office:",
          error
        );

        notify(
          "تعذر إنشاء حساب المكتب.",
          "error"
        );

        return null;
      }

      notify(
        "تم إنشاء حساب المكتب بنجاح.",
        "success"
      );

      await loadOffices();

      return result;

    } catch (error) {

      console.error(
        "Create office exception:",
        error
      );

      notify(
        "حدث خطأ أثناء إنشاء المكتب.",
        "error"
      );

      return null;
    }
  }

  // =========================================================
  // TOGGLE OFFICE
  // =========================================================

  async function toggleOffice(
    officeId,
    currentStatus
  ) {

    if (
      state.role !== "admin"
    ) {
      return;
    }

    try {

      const {
        error
      } =
        await supabaseClient
          .from("offices")
          .update({
            active:
              !currentStatus
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

        notify(
          "تعذر تغيير حالة المكتب.",
          "error"
        );

        return;
      }

      await loadOffices();

    } catch (error) {

      console.error(
        error
      );
    }
  }

  // =========================================================
  // EDIT OFFICE
  // =========================================================

  async function editOffice(
    officeId
  ) {

    const office =
      state.offices.find(
        item =>
          String(item.id) ===
          String(officeId)
      );

    if (!office) {
      return;
    }

    const newName =
      prompt(
        "اسم المكتب:",
        office.name ||
        office.office_name ||
        ""
      );

    if (
      newName === null
    ) {
      return;
    }

    const newContract =
      prompt(
        "تاريخ انتهاء العقد YYYY-MM-DD:",
        office.contract_end ||
        ""
      );

    if (
      newContract === null
    ) {
      return;
    }

    try {

      const {
        error
      } =
        await supabaseClient
          .from("offices")
          .update({
            name:
              newName.trim(),

            contract_end:
              newContract.trim() ||
              null
          })
          .eq(
            "id",
            officeId
          );

      if (error) {

        console.error(
          "Edit office:",
          error
        );

        notify(
          "تعذر تعديل المكتب.",
          "error"
        );

        return;
      }

      notify(
        "تم تعديل المكتب.",
        "success"
      );

      await loadOffices();

    } catch (error) {

      console.error(
        error
      );
    }
  }

  // =========================================================
  // PEOPLE
  // =========================================================

  async function loadPeople() {

    if (
      state.role !== "office" ||
      !state.office
    ) {
      return;
    }

    try {

      /*
        مهم:

        يتم استخدام office_id حتى لا يستطيع
        المكتب تحميل بيانات مكتب آخر.

        وRLS في Supabase يجب أن يمنع الوصول
        أيضاً على مستوى قاعدة البيانات.
      */

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

        return;
      }

      state.people =
        data || [];

      renderPeople();

    } catch (error) {

      console.error(
        "Load people exception:",
        error
      );
    }
  }

  // =========================================================
  // RENDER PEOPLE
  // =========================================================

  function renderPeople() {

    const container =
      $("peopleList");

    if (!container) {
      return;
    }

    let people =
      [...state.people];

    const search =
      state.searchQuery
        .trim()
        .toLowerCase();

    if (search) {

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
              name.includes(search) ||
              phone.includes(search)
            );
          }
        );
    }

    if (!people.length) {

      container.innerHTML =
        `
        <div class="empty-state">
          لا توجد بيانات
        </div>
        `;

      return;
    }

    container.innerHTML =
      people
        .map(
          person => `
            <div class="person-card">

              <h3>
                ${escapeHtml(
                  person.name ||
                  "بدون اسم"
                )}
              </h3>

              <p>
                الهاتف:
                ${escapeHtml(
                  person.phone || "-"
                )}
              </p>

              <p>
                المبلغ:
                ${escapeHtml(
                  person.amount || 0
                )}
              </p>

              <button
                type="button"
                onclick="DebtBook.openPerson('${person.id}')"
              >
                فتح الدفتر
              </button>

            </div>
          `
        )
        .join("");
  }

  // =========================================================
  // OPEN PERSON
  // =========================================================

  function openPerson(
    personId
  ) {

    const person =
      state.people.find(
        item =>
          String(item.id) ===
          String(personId)
      );

    if (!person) {
      return;
    }

    state.currentPersonId =
      person.id;

    console.log(
      "Current person:",
      person
    );

    window.dispatchEvent(
      new CustomEvent(
        "debtbook:person",
        {
          detail: person
        }
      )
    );
  }

  // =========================================================
  // CREATE PERSON
  // =========================================================

  async function createPerson(
    data
  ) {

    if (
      state.role !== "office" ||
      !state.office
    ) {
      return;
    }

    try {

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
              data.name,

            phone:
              data.phone || null,

            amount:
              data.amount || 0,

            notes:
              data.notes || null
          })
          .select()
          .single();

      if (error) {

        console.error(
          "Create person:",
          error
        );

        notify(
          "تعذر إضافة الشخص.",
          "error"
        );

        return null;
      }

      await loadPeople();

      notify(
        "تمت إضافة الشخص.",
        "success"
      );

      return person;

    } catch (error) {

      console.error(
        "Create person exception:",
        error
      );

      return null;
    }
  }

  // =========================================================
  // SEARCH
  // =========================================================

  function setupSearch() {

    const input =
      $("searchInput");

    if (!input) {
      return;
    }

    input.addEventListener(
      "input",
      function () {

        state.searchQuery =
          input.value || "";

        renderPeople();
      }
    );
  }

  // =========================================================
  // LOGIN FORM
  // =========================================================

  function setupLoginForm() {

    const form =
      $("loginForm");

    if (!form) {

      console.warn(
        "loginForm not found"
      );

      return;
    }

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        const emailInput =
          $("email") ||
          $("loginEmail") ||
          form.querySelector(
            'input[type="email"]'
          );

        const passwordInput =
          $("password") ||
          $("loginPassword") ||
          form.querySelector(
            'input[type="password"]'
          );

        const email =
          emailInput
            ? emailInput.value
            : "";

        const password =
          passwordInput
            ? passwordInput.value
            : "";

        await handleLogin(
          email,
          password
        );
      }
    );
  }

  // =========================================================
  // LOGOUT BUTTONS
  // =========================================================

  function setupLogout() {

    document
      .querySelectorAll(
        "[data-action='logout']"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async function () {

              await logout();
            }
          );
        }
      );
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async function logout() {

    try {

      const {
        error
      } =
        await supabaseClient.auth
          .signOut();

      if (error) {

        console.error(
          "Logout:",
          error
        );
      }

    } catch (error) {

      console.error(
        "Logout exception:",
        error
      );
    }

    state.user =
      null;

    state.role =
      null;

    state.office =
      null;

    state.people =
      [];

    state.offices =
      [];

    location.reload();
  }

  // =========================================================
  // ADMIN CREATE FORM
  // =========================================================

  function setupCreateOfficeForm() {

    const form =
      $("createOfficeForm");

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        if (
          state.role !== "admin"
        ) {

          notify(
            "فقط الأدمن يستطيع إنشاء الحسابات.",
            "error"
          );

          return;
        }

        const name =
          value("officeNameInput");

        const email =
          value("officeEmailInput")
            .toLowerCase();

        const password =
          value("officePasswordInput");

        const contractEnd =
          value("officeContractEnd");

        if (
          !name ||
          !email ||
          !password
        ) {

          notify(
            "أكمل معلومات المكتب.",
            "error"
          );

          return;
        }

        if (
          password.length < 6
        ) {

          notify(
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
            "error"
          );

          return;
        }

        await createOffice({

          name,

          email,

          password,

          contract_end:
            contractEnd || null

        });

        form.reset();
      }
    );
  }

  // =========================================================
  // AUTH LISTENER
  // =========================================================

  supabaseClient.auth.onAuthStateChange(
    function (event, session) {

      console.log(
        "Supabase Auth:",
        event
      );

      if (session) {

        state.user =
          session.user;

      } else {

        state.user =
          null;

        state.role =
          null;

        state.office =
          null;
      }
    }
  );

  // =========================================================
  // INITIALIZE
  // =========================================================

  async function start() {

    console.log(
      "Starting Debt Book..."
    );

    setupLoginForm();

    setupLogout();

    setupSearch();

    setupCreateOfficeForm();

    const session =
      await getSession();

    if (session) {

      console.log(
        "Existing Supabase session"
      );

      state.user =
        session.user;

      await loadUserProfile();

    } else {

      console.log(
        "No Supabase session"
      );

      hide("adminPage");
      hide("officePage");

      show("loginPage");
      show("loginScreen");
    }

    state.initialized =
      true;

    finishLoading();

    console.log(
      "Debt Book ready."
    );
  }

  // =========================================================
  // PUBLIC API
  // =========================================================

  window.DebtBook = {

    supabase:
      supabaseClient,

    state:
      state,

    login:
      handleLogin,

    logout:
      logout,

    loadUserProfile:
      loadUserProfile,

    loadOffices:
      loadOffices,

    loadPeople:
      loadPeople,

    createOffice:
      createOffice,

    toggleOffice:
      toggleOffice,

    editOffice:
      editOffice,

    createPerson:
      createPerson,

    openPerson:
      openPerson

  };

  // =========================================================
  // START
  // =========================================================

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();
  }

})();