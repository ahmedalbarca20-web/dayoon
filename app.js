(function () {
  "use strict";

  console.log("Starting Debt Book...");

  // =========================================================
  // SUPABASE CONFIG
  // =========================================================

  if (!window.supabase) {
    console.error("Supabase JS library is missing.");

    alert(
      "خطأ: مكتبة Supabase غير محملة.\n" +
      "تأكد من وجود supabase-js@2 في index.html."
    );

    return;
  }

  if (!window.SUPABASE_CONFIG) {
    console.error("Supabase configuration missing.");

    alert(
      "خطأ: إعدادات Supabase غير موجودة.\n" +
      "تأكد من ملف supabase-config.js."
    );

    return;
  }

  const SUPABASE_URL =
    window.SUPABASE_CONFIG.SUPABASE_URL || "";

  const SUPABASE_ANON_KEY =
    window.SUPABASE_CONFIG.SUPABASE_ANON_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL or key is missing.");

    alert(
      "خطأ: Supabase URL أو المفتاح غير موجود."
    );

    return;
  }

  // =========================================================
  // CREATE ONE SUPABASE CLIENT
  // =========================================================

  const supabaseClient =
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

  console.log("Supabase connected");

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
  // DOM
  // =========================================================

  const $ = (id) =>
    document.getElementById(id);

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

  // =========================================================
  // SUPABASE TEST
  // =========================================================

  async function testSupabase() {
    try {
      const {
        data: {
          session
        },
        error
      } =
        await supabaseClient.auth.getSession();

      if (error) {
        console.error(
          "Supabase session error:",
          error
        );

        return false;
      }

      console.log(
        "Supabase session:",
        session
          ? "FOUND"
          : "NONE"
      );

      return true;

    } catch (error) {

      console.error(
        "Supabase connection error:",
        error
      );

      return false;
    }
  }

  // =========================================================
  // AUTH STATE
  // =========================================================

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

      console.log(
        "Supabase Auth:",
        event
      );

      if (session) {

        state.user =
          session.user;

        console.log(
          "Logged user:",
          state.user.email
        );

      } else {

        state.user = null;
        state.role = null;
        state.office = null;

      }
    }
  );

  // =========================================================
  // LOGIN
  // =========================================================

  async function login(email, password) {

    email =
      String(email || "")
        .trim()
        .toLowerCase();

    password =
      String(password || "");

    if (!email || !password) {

      alert(
        "أدخل البريد الإلكتروني وكلمة المرور."
      );

      return {
        success: false
      };
    }

    console.log(
      "Trying Supabase login:",
      email
    );

    try {

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .signInWithPassword({
            email: email,
            password: password
          });

      if (error) {

        console.error(
          "Auth login failed:",
          error
        );

        alert(
          "فشل تسجيل الدخول:\n" +
          error.message
        );

        return {
          success: false,
          error
        };
      }

      if (!data || !data.user) {

        alert(
          "لم يتم إنشاء جلسة تسجيل الدخول."
        );

        return {
          success: false
        };
      }

      state.user =
        data.user;

      console.log(
        "Login successful:",
        state.user.email
      );

      return {
        success: true,
        user: data.user,
        session: data.session
      };

    } catch (error) {

      console.error(
        "Login exception:",
        error
      );

      alert(
        "حدث خطأ أثناء تسجيل الدخول."
      );

      return {
        success: false,
        error
      };
    }
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
          "Logout error:",
          error
        );

      }

    } catch (error) {

      console.error(
        "Logout exception:",
        error
      );

    }

    state.user = null;
    state.role = null;
    state.office = null;

    location.reload();
  }

  // =========================================================
  // LOGIN FORM
  // =========================================================

  function setupLogin() {

    const form =
      document.getElementById(
        "loginForm"
      );

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
          document.getElementById(
            "email"
          ) ||
          document.getElementById(
            "loginEmail"
          ) ||
          document.querySelector(
            'input[type="email"]'
          );

        const passwordInput =
          document.getElementById(
            "password"
          ) ||
          document.getElementById(
            "loginPassword"
          ) ||
          document.querySelector(
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

        const result =
          await login(
            email,
            password
          );

        if (!result.success) {
          return;
        }

        console.log(
          "User logged in successfully."
        );

        // إذا عندك واجهة dashboard
        hide("loginPage");
        hide("loginScreen");

        show("appPage");
        show("dashboard");

        // أخفي شاشة التحميل
        hide("loadingScreen");

        // حدث مخصص لباقي التطبيق
        window.dispatchEvent(
          new CustomEvent(
            "debtbook:login",
            {
              detail: result
            }
          )
        );
      }
    );
  }

  // =========================================================
  // INIT
  // =========================================================

  async function start() {

    console.log(
      "Starting Debt Book..."
    );

    hide("loadingScreen");

    await testSupabase();

    setupLogin();

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth
        .getSession();

    if (session) {

      state.user =
        session.user;

      console.log(
        "Existing Supabase session:",
        state.user.email
      );

    } else {

      console.log(
        "No existing Supabase session"
      );
    }

    hide("loadingScreen");

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
      login,

    logout:
      logout,

    testSupabase:
      testSupabase
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

  /* =====================================================
     STATE
  ===================================================== */

  const state = {

    user: null,

    role: null,

    office: null,

    offices: [],

    people: []

  };


  /* =====================================================
     HELPERS
  ===================================================== */

  const $ = (id) =>
    document.getElementById(id);


  function show(id) {

    const el = $(id);

    if (el)
      el.classList.remove(
        "hidden"
      );

  }


  function hide(id) {

    const el = $(id);

    if (el)
      el.classList.add(
        "hidden"
      );

  }


  function message(
    id,
    text,
    type = "error"
  ) {

    const el = $(id);

    if (!el)
      return;

    if (!text) {

      el.innerHTML = "";

      return;

    }

    el.innerHTML =
      `<div class="message ${type}">
        ${escapeHtml(text)}
      </div>`;

  }


  function escapeHtml(value) {

    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );

  }


  function formatMoney(value) {

    return Number(
      value || 0
    ).toLocaleString(
      "ar-IQ",
      {
        maximumFractionDigits: 2
      }
    );

  }


  function formatDate(value) {

    if (!value)
      return "-";

    return new Date(
      value + "T00:00:00"
    ).toLocaleDateString(
      "ar-IQ"
    );

  }


  function contractIsValid(
    office
  ) {

    if (!office.active)
      return false;

    const today =
      new Date();

    today.setHours(
      0, 0, 0, 0
    );


    if (
      office.contract_start
    ) {

      const start =
        new Date(
          office.contract_start +
          "T00:00:00"
        );

      if (today < start)
        return false;

    }


    if (
      office.contract_end
    ) {

      const end =
        new Date(
          office.contract_end +
          "T23:59:59"
        );

      if (today > end)
        return false;

    }


    return true;

  }


  /* =====================================================
     SCREENS
  ===================================================== */

  function showLogin() {

    hide("adminScreen");
    hide("officeScreen");

    show("loginScreen");

  }


  function showAdmin() {

    hide("loginScreen");
    hide("officeScreen");

    show("adminScreen");

  }


  function showOffice() {

    hide("loginScreen");
    hide("adminScreen");

    show("officeScreen");

  }


  /* =====================================================
     START
  ===================================================== */

  async function startApp() {

    console.log(
      "Starting Debt Book..."
    );


    if (!supabaseClient) {

      hide(
        "loadingScreen"
      );

      showLogin();

      message(
        "loginMessage",
        "Supabase غير مهيأ بشكل صحيح"
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
          "getSession:",
          error
        );

      }


      const session =
        data?.session;


      if (session?.user) {

        console.log(
          "Existing Supabase session"
        );

        await loadUser(
          session.user
        );

      } else {

        showLogin();

      }

    } catch (error) {

      console.error(
        "Start app:",
        error
      );

      showLogin();

    }


    hide(
      "loadingScreen"
    );

  }


  /* =====================================================
     AUTH LISTENER
  ===================================================== */

  if (supabaseClient) {

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
          event === "SIGNED_OUT"
        ) {

          state.user = null;
          state.role = null;
          state.office = null;

          showLogin();

          return;

        }


        if (
          event === "SIGNED_IN" &&
          session?.user
        ) {

          /*
           * لا نسوي signOut هنا.
           * نترك loadUser يحدد نوع الحساب.
           */

          await loadUser(
            session.user
          );

        }

      }
    );

  }


  /* =====================================================
     LOAD USER
  ===================================================== */

  async function loadUser(
    user
  ) {

    if (!user)
      return;


    state.user = user;


    /*
     * أولاً: هل هو أدمن؟
     */

    const {
      data: admin,
      error: adminError
    } =
      await supabaseClient
        .from("admins")
        .select("user_id")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


    if (adminError) {

      console.error(
        "Check admin:",
        adminError
      );

    }


    if (admin) {

      state.role =
        "admin";

      state.office =
        null;

      $("adminEmail").textContent =
        user.email || "";

      showAdmin();

      await loadOffices();

      return;

    }


    /*
     * ثانيًا: هل هو مكتب؟
     */

    const {
      data: office,
      error: officeError
    } =
      await supabaseClient
        .from("offices")
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


    if (officeError) {

      console.error(
        "Get office:",
        officeError
      );

      await supabaseClient.auth.signOut();

      message(
        "loginMessage",
        "تعذر تحميل حساب المكتب"
      );

      return;

    }


    if (!office) {

      await supabaseClient.auth.signOut();

      message(
        "loginMessage",
        "هذا الحساب غير مرتبط بأي مكتب"
      );

      return;

    }


    if (
      !contractIsValid(
        office
      )
    ) {

      await supabaseClient.auth.signOut();

      message(
        "loginMessage",
        "حساب المكتب غير فعال أو انتهت مدة العقد"
      );

      return;

    }


    state.role =
      "office";

    state.office =
      office;


    $("officeTitle").textContent =
      office.name ||
      "دفتر الديون";

    $("officeEmail").textContent =
      office.username ||
      user.email ||
      "";

    $("contractStatus").textContent =
      `العقد: ${
        formatDate(
          office.contract_start
        )
      } — ${
        formatDate(
          office.contract_end
        )
      }`;


    showOffice();

    await loadPeople();

  }


  /* =====================================================
     LOGIN
  ===================================================== */

  $("loginForm")
    ?.addEventListener(
      "submit",
      handleLogin
    );


  async function handleLogin(
    event
  ) {

    event.preventDefault();


    message(
      "loginMessage",
      ""
    );


    const email =
      $("loginEmail")
        .value
        .trim()
        .toLowerCase();


    const password =
      $("loginPassword")
        .value;


    if (
      !email ||
      !password
    ) {

      message(
        "loginMessage",
        "أدخل الإيميل وكلمة المرور"
      );

      return;

    }


    const button =
      $("loginButton");


    button.disabled = true;

    button.textContent =
      "جارٍ تسجيل الدخول...";


    try {

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

        message(
          "loginMessage",
          "بيانات الدخول غير صحيحة"
        );

        return;

      }


      console.log(
        "Login successful:",
        data.user?.id
      );


      /*
       * لا نستدعي signOut هنا.
       * onAuthStateChange سيشغل loadUser.
       */

    } catch (error) {

      console.error(
        "Login:",
        error
      );

      message(
        "loginMessage",
        "حدث خطأ أثناء تسجيل الدخول"
      );

    } finally {

      button.disabled =
        false;

      button.textContent =
        "تسجيل الدخول";

    }

  }


  /* =====================================================
     LOGOUT
  ===================================================== */

  $("adminLogout")
    ?.addEventListener(
      "click",
      logout
    );


  $("officeLogout")
    ?.addEventListener(
      "click",
      logout
    );


  async function logout() {

    try {

      await supabaseClient.auth.signOut();

    } catch (error) {

      console.error(
        "Logout:",
        error
      );

    }

  }


  /* =====================================================
     ADMIN - LOAD OFFICES
  ===================================================== */

  async function loadOffices() {

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

      message(
        "adminMessage",
        "تعذر تحميل المكاتب"
      );

      return;

    }


    state.offices =
      data || [];


    renderOffices();

  }


  /* =====================================================
     ADMIN - RENDER
  ===================================================== */

  function renderOffices() {

    const tbody =
      $("officesTable");


    tbody.innerHTML = "";


    const offices =
      state.offices;


    $("totalOffices")
      .textContent =
      offices.length;


    $("activeOffices")
      .textContent =
      offices.filter(
        x => x.active
      ).length;


    $("inactiveOffices")
      .textContent =
      offices.filter(
        x => !x.active
      ).length;


    if (!offices.length) {

      tbody.innerHTML =
        `<tr>
          <td colspan="6">
            لا توجد مكاتب حتى الآن
          </td>
        </tr>`;

      return;

    }


    offices.forEach(
      office => {

        const tr =
          document.createElement(
            "tr"
          );


        tr.innerHTML = `

          <td>
            <strong>
              ${escapeHtml(
                office.name
              )}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              office.username
            )}
          </td>

          <td>
            ${formatDate(
              office.contract_start
            )}
          </td>

          <td>
            ${formatDate(
              office.contract_end
            )}
          </td>

          <td>
            <span class="badge ${
              office.active
                ? "active"
                : "inactive"
            }">
              ${
                office.active
                  ? "فعال"
                  : "معطل"
              }
            </span>
          </td>

          <td>

            <button
              class="action-button ${
                office.active
                  ? "disable"
                  : "enable"
              }"
              data-office-id="${
                office.id
              }"
              data-action="${
                office.active
                  ? "disable"
                  : "enable"
              }"
            >
              ${
                office.active
                  ? "تعطيل"
                  : "تفعيل"
              }
            </button>

          </td>

        `;


        tbody.appendChild(
          tr
        );

      }
    );

  }


  $("officesTable")
    ?.addEventListener(
      "click",
      async event => {

        const button =
          event.target.closest(
            "[data-office-id]"
          );


        if (!button)
          return;


        const officeId =
          button.dataset.officeId;


        const action =
          button.dataset.action;


        await changeOfficeStatus(
          officeId,
          action === "enable"
        );

      }
    );


  /* =====================================================
     ADMIN - ENABLE / DISABLE
  ===================================================== */

  async function changeOfficeStatus(
    officeId,
    active
  ) {

    /*
     * مهم:
     * الأدمن لا يعدل offices مباشرة
     * لأن RLS يمنع ذلك.
     *
     * نستعمل Edge Function.
     */

    try {

      const {
        data,
        error
      } =
        await supabaseClient.functions
          .invoke(
            "update-office",
            {
              body: {
                office_id:
                  officeId,

                active
              }
            }
          );


      if (error) {

        console.error(
          "Update office:",
          error
        );

        alert(
          error.message ||
          "تعذر تعديل حالة المكتب"
        );

        return;

      }


      if (
        !data?.success
      ) {

        alert(
          data?.error ||
          "تعذر تعديل حالة المكتب"
        );

        return;

      }


      await loadOffices();


    } catch (error) {

      console.error(
        error
      );

      alert(
        "حدث خطأ"
      );

    }

  }


  /* =====================================================
     OPEN OFFICE MODAL
  ===================================================== */

  $("openOfficeModal")
    ?.addEventListener(
      "click",
      () => {

        message(
          "officeFormMessage",
          ""
        );

        show(
          "officeModal"
        );

      }
    );


  $("closeOfficeModal")
    ?.addEventListener(
      "click",
      () => {

        hide(
          "officeModal"
        );

      }
    );


  /* =====================================================
     CREATE OFFICE
  ===================================================== */

  $("officeForm")
    ?.addEventListener(
      "submit",
      createOffice
    );


  async function createOffice(
    event
  ) {

    event.preventDefault();


    message(
      "officeFormMessage",
      ""
    );


    const name =
      $("officeName")
        .value
        .trim();


    const email =
      $("officeEmail")
        .value
        .trim()
        .toLowerCase();


    const password =
      $("officePassword")
        .value;


    const contractStart =
      $("contractStart")
        .value ||
      null;


    const contractEnd =
      $("contractEnd")
        .value ||
      null;


    if (
      password.length < 6
    ) {

      message(
        "officeFormMessage",
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      );

      return;

    }


    if (
      contractStart &&
      contractEnd &&
      contractEnd <
      contractStart
    ) {

      message(
        "officeFormMessage",
        "تاريخ نهاية العقد يجب أن يكون بعد البداية"
      );

      return;

    }


    const button =
      $("saveOfficeButton");


    button.disabled = true;

    button.textContent =
      "جارٍ إنشاء المكتب...";


    try {

      const {
        data,
        error
      } =
        await supabaseClient.functions
          .invoke(
            "create-office",
            {
              body: {

                name,

                email,

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

        message(
          "officeFormMessage",
          error.message ||
          "تعذر إنشاء المكتب"
        );

        return;

      }


      if (
        !data?.success
      ) {

        message(
          "officeFormMessage",
          data?.error ||
          "تعذر إنشاء المكتب"
        );

        return;

      }


      message(
        "officeFormMessage",
        "تم إنشاء المكتب بنجاح",
        "success"
      );


      $("officeForm")
        .reset();


      await loadOffices();


      setTimeout(
        () => {
          hide(
            "officeModal"
          );
        },
        700
      );


    } catch (error) {

      console.error(
        "Create office:",
        error
      );

      message(
        "officeFormMessage",
        error.message ||
        "حدث خطأ"
      );

    } finally {

      button.disabled =
        false;

      button.textContent =
        "إنشاء المكتب";

    }

  }


  /* =====================================================
     OFFICE - LOAD PEOPLE
  ===================================================== */

  async function loadPeople() {

    if (
      !state.office
    )
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

      return;

    }


    state.people =
      data || [];


    renderPeople();

  }


  /* =====================================================
     OFFICE - RENDER PEOPLE
  ===================================================== */

  function renderPeople() {

    const query =
      (
        $("searchPeople")
          ?.value ||
        ""
      )
        .trim()
        .toLowerCase();


    const people =
      state.people.filter(
        person => {

          if (!query)
            return true;


          return (
            String(
              person.name || ""
            )
              .toLowerCase()
              .includes(query)
            ||
            String(
              person.phone || ""
            )
              .toLowerCase()
              .includes(query)
          );

        }
      );


    const tbody =
      $("peopleTable");


    tbody.innerHTML = "";


    $("peopleCount")
      .textContent =
      state.people.length;


    /*
     * ملاحظة:
     * في هذا الإصدار debt/paid
     * نحسبها من الحقول الموجودة
     * إذا أضفت نظام معاملات لاحقًا
     * نقدر نفصله بجدول مستقل.
     */

    $("totalDebt")
      .textContent =
      "0";


    $("totalPaid")
      .textContent =
      "0";


    if (!people.length) {

      tbody.innerHTML =
        `<tr>
          <td colspan="7">
            لا توجد بيانات
          </td>
        </tr>`;

      return;

    }


    people.forEach(
      person => {

        const tr =
          document.createElement(
            "tr"
          );


        tr.innerHTML = `

          <td>
            <strong>
              ${escapeHtml(
                person.name
              )}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              person.phone
            )}
          </td>

          <td>
            ${escapeHtml(
              person.address
            )}
          </td>

          <td>
            0
          </td>

          <td>
            0
          </td>

          <td>
            0
          </td>

          <td>
            -
          </td>

        `;


        tbody.appendChild(
          tr
        );

      }
    );

  }


  $("searchPeople")
    ?.addEventListener(
      "input",
      renderPeople
    );


  /* =====================================================
     PERSON MODAL
  ===================================================== */

  $("addPersonButton")
    ?.addEventListener(
      "click",
      () => {

        show(
          "personModal"
        );

      }
    );


  $("closePersonModal")
    ?.addEventListener(
      "click",
      () => {

        hide(
          "personModal"
        );

      }
    );


  $("personForm")
    ?.addEventListener(
      "submit",
      createPerson
    );


  async function createPerson(
    event
  ) {

    event.preventDefault();


    if (
      !state.office
    ) {

      alert(
        "حساب المكتب غير موجود"
      );

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


    const address =
      $("personAddress")
        .value
        .trim();


    const notes =
      $("personNotes")
        .value
        .trim();


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

          address,

          notes

        })
        .select()
        .single();


    if (error) {

      console.error(
        "Create person:",
        error
      );

      alert(
        error.message
      );

      return;

    }


    console.log(
      "Person created:",
      data
    );


    $("personForm")
      .reset();


    hide(
      "personModal"
    );


    await loadPeople();

  }


  /* =====================================================
     INIT
  ===================================================== */

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