(function () {
  "use strict";

  // =====================================================
  // SUPABASE
  // =====================================================

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = CFG.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  if (
    !window.supabase ||
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    console.error("Supabase configuration missing");

    document.addEventListener("DOMContentLoaded", () => {
      const loading = document.getElementById("loadingScreen");

      if (loading) {
        loading.classList.add("hidden");
      }

      const message =
        document.getElementById("loginMessage");

      if (message) {
        message.textContent =
          "إعدادات Supabase غير موجودة.";
        message.className = "login-message error";
      }
    });

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

    console.log("Supabase connected");
  } catch (error) {
    console.error(
      "Supabase initialization error:",
      error
    );

    return;
  }

  // =====================================================
  // STATE
  // =====================================================

  const state = {
    user: null,
    role: null,
    office: null,

    offices: [],
    people: [],
    transactions: [],

    currentPersonId: null,

    initialized: false
  };

  // =====================================================
  // HELPERS
  // =====================================================

  const $ = id =>
    document.getElementById(id);

  function show(id) {
    const el = $(id);
    if (el) el.classList.remove("hidden");
  }

  function hide(id) {
    const el = $(id);
    if (el) el.classList.add("hidden");
  }

  function finishLoading() {
    const el = $("loadingScreen");

    if (el) {
      el.classList.add("hidden");
    }
  }

  function message(text, type = "info") {
    console.log(`[${type}] ${text}`);

    const el = $("loginMessage");

    if (el) {
      el.textContent = text;
      el.className =
        `login-message ${type}`;
    } else {
      alert(text);
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =====================================================
  // SESSION
  // =====================================================

  async function getSession() {
    const {
      data,
      error
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(
        "Get session:",
        error
      );

      return null;
    }

    return data?.session || null;
  }

  // =====================================================
  // ADMIN CHECK
  // =====================================================

  async function isAdmin(userId) {
    if (!userId) {
      return false;
    }

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

  // =====================================================
  // GET OFFICE
  // =====================================================

  async function getMyOffice(userId) {
    if (!userId) {
      return null;
    }

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

    return data;
  }

  // =====================================================
  // LOGIN
  // =====================================================

  async function login(email, password) {

    if (!supabaseClient) {
      message(
        "Supabase غير متصل.",
        "error"
      );

      return;
    }

    email =
      String(email || "")
        .trim()
        .toLowerCase();

    password =
      String(password || "");

    if (!email || !password) {
      message(
        "أدخل البريد وكلمة المرور.",
        "error"
      );

      return;
    }

    console.log(
      "Login:",
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

      message(
        "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        "error"
      );

      return;
    }

    state.user =
      data.user;

    await loadUser();
  }

  // =====================================================
  // LOAD USER
  // =====================================================

  async function loadUser() {

    if (!state.user) {
      return;
    }

    console.log(
      "Loading user:",
      state.user.id
    );

    // ---------------------------------------------------
    // ADMIN
    // ---------------------------------------------------

    const admin =
      await isAdmin(
        state.user.id
      );

    if (admin) {

      state.role = "admin";
      state.office = null;

      console.log(
        "User role: ADMIN"
      );

      await showAdmin();

      return;
    }

    // ---------------------------------------------------
    // OFFICE
    // ---------------------------------------------------

    const office =
      await getMyOffice(
        state.user.id
      );

    if (!office) {

      console.error(
        "No office profile"
      );

      await supabaseClient.auth.signOut();

      message(
        "هذا الحساب غير مرتبط بأي مكتب.",
        "error"
      );

      return;
    }

    // ---------------------------------------------------
    // ACTIVE
    // ---------------------------------------------------

    if (office.active === false) {

      await supabaseClient.auth.signOut();

      message(
        "هذا المكتب معطل من الأدمن.",
        "error"
      );

      return;
    }

    // ---------------------------------------------------
    // CONTRACT
    // ---------------------------------------------------

    if (office.contract_end) {

      const end =
        new Date(
          office.contract_end
        );

      const today =
        new Date();

      today.setHours(
        0, 0, 0, 0
      );

      if (
        !Number.isNaN(end.getTime()) &&
        end < today
      ) {

        await supabaseClient.auth.signOut();

        message(
          "مدة عقد المكتب انتهت.",
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
      "User role: OFFICE",
      office.name
    );

    await showOffice();
  }

  // =====================================================
  // SHOW LOGIN
  // =====================================================

  function showLogin() {

    hide("adminPage");
    hide("officePage");

    show("loginPage");

    finishLoading();
  }

  // =====================================================
  // SHOW ADMIN
  // =====================================================

  async function showAdmin() {

    hide("loginPage");
    hide("officePage");

    show("adminPage");

    await loadOffices();

    finishLoading();
  }

  // =====================================================
  // SHOW OFFICE
  // =====================================================

  async function showOffice() {

    hide("loginPage");
    hide("adminPage");

    show("officePage");

    const name =
      state.office?.name ||
      "المكتب";

    const officeName =
      $("officeName");

    if (officeName) {
      officeName.textContent =
        name;
    }

    const currentOfficeName =
      $("currentOfficeName");

    if (currentOfficeName) {
      currentOfficeName.textContent =
        name;
    }

    await loadPeople();

    finishLoading();
  }

  // =====================================================
  // LOAD OFFICES
  // =====================================================

  async function loadOffices() {

    const {
      data,
      error
    } = await supabaseClient
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
  }

  // =====================================================
  // RENDER OFFICES
  // =====================================================

  function renderOffices() {

    const container =
      $("officesList");

    if (!container) {
      return;
    }

    if (!state.offices.length) {

      container.innerHTML =
        `
        <div class="empty-state">
          لا توجد مكاتب حالياً
        </div>
        `;

      return;
    }

    container.innerHTML =
      state.offices.map(
        office => {

          const active =
            office.active !== false;

          let contract =
            "غير محددة";

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

              contract =
                date.toLocaleDateString(
                  "ar-IQ"
                );
            }
          }

          return `
            <div class="office-card">

              <div class="office-card-header">

                <h3>
                  ${escapeHTML(
                    office.name
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

              <p>
                البريد:
                ${escapeHTML(
                  office.email
                )}
              </p>

              <p>
                نهاية العقد:
                ${escapeHTML(
                  contract
                )}
              </p>

              <div class="office-actions">

                <button
                  type="button"
                  onclick="DebtBook.toggleOffice(
                    '${office.id}',
                    ${active}
                  )"
                >
                  ${
                    active
                      ? "تعطيل المكتب"
                      : "تفعيل المكتب"
                  }
                </button>

              </div>

            </div>
          `;
        }
      ).join("");
  }

  // =====================================================
  // CREATE OFFICE
  // =====================================================

  async function createOffice() {

    if (
      state.role !== "admin"
    ) {

      message(
        "فقط الأدمن يستطيع إنشاء مكتب.",
        "error"
      );

      return;
    }

    const name =
      $("officeNameInput")?.value.trim();

    const email =
      $("officeEmailInput")?.value
        .trim()
        .toLowerCase();

    const password =
      $("officePasswordInput")?.value;

    const contractStart =
      $("officeContractStart")?.value ||
      null;

    const contractEnd =
      $("officeContractEnd")?.value ||
      null;

    if (
      !name ||
      !email ||
      !password
    ) {

      message(
        "أكمل بيانات المكتب.",
        "error"
      );

      return;
    }

    if (
      password.length < 6
    ) {

      message(
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
        "error"
      );

      return;
    }

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
          "تعذر إنشاء حساب المكتب.",
          "error"
        );

        return;
      }

      console.log(
        "Office created:",
        data
      );

      message(
        "تم إنشاء حساب المكتب بنجاح.",
        "success"
      );

      const form =
        $("createOfficeForm");

      if (form) {
        form.reset();
      }

      await loadOffices();

    } catch (error) {

      console.error(
        "Create office exception:",
        error
      );

      message(
        "حدث خطأ أثناء إنشاء المكتب.",
        "error"
      );
    }
  }

  // =====================================================
  // TOGGLE OFFICE
  // =====================================================

  async function toggleOffice(
    officeId,
    currentStatus
  ) {

    if (
      state.role !== "admin"
    ) {
      return;
    }

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

      message(
        "تعذر تغيير حالة المكتب.",
        "error"
      );

      return;
    }

    await loadOffices();
  }

  // =====================================================
  // LOAD PEOPLE
  // =====================================================

  async function loadPeople() {

    if (
      state.role !== "office" ||
      !state.office
    ) {
      return;
    }

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

  // =====================================================
  // RENDER PEOPLE
  // =====================================================

  function renderPeople() {

    const container =
      $("peopleList");

    if (!container) {
      return;
    }

    if (!state.people.length) {

      container.innerHTML =
        `
        <div class="empty-state">
          لا توجد ديون أو أشخاص حالياً.
        </div>
        `;

      return;
    }

    container.innerHTML =
      state.people.map(
        person => `
          <div class="person-card">

            <h3>
              ${escapeHTML(
                person.name
              )}
            </h3>

            <p>
              الهاتف:
              ${escapeHTML(
                person.phone || "-"
              )}
            </p>

            <p>
              المبلغ:
              ${escapeHTML(
                person.amount || 0
              )}
            </p>

            <button
              type="button"
              onclick="DebtBook.openPerson('${person.id}')"
            >
              فتح
            </button>

          </div>
        `
      ).join("");
  }

  // =====================================================
  // ADD PERSON
  // =====================================================

  async function addPerson() {

    if (
      state.role !== "office" ||
      !state.office
    ) {
      return;
    }

    const name =
      $("personNameInput")?.value.trim();

    const phone =
      $("personPhoneInput")?.value.trim();

    const amount =
      Number(
        $("personAmountInput")?.value || 0
      );

    const notes =
      $("personNotesInput")?.value.trim();

    if (!name) {

      message(
        "اكتب اسم الشخص.",
        "error"
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

          phone:
            phone || null,

          amount,

          notes:
            notes || null
        })
        .select()
        .single();

    if (error) {

      console.error(
        "Add person:",
        error
      );

      message(
        "تعذر إضافة الشخص.",
        "error"
      );

      return;
    }

    console.log(
      "Person created:",
      data
    );

    const form =
      $("personForm");

    if (form) {
      form.reset();
    }

    await loadPeople();
  }

  // =====================================================
  // OPEN PERSON
  // =====================================================

  function openPerson(
    personId
  ) {

    const person =
      state.people.find(
        p =>
          String(p.id) ===
          String(personId)
      );

    if (!person) {
      return;
    }

    state.currentPersonId =
      person.id;

    console.log(
      "Open person:",
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

  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {

    try {

      const {
        error
      } =
        await supabaseClient.auth
          .signOut({
            scope: "local"
          });

      if (error) {
        console.error(
          "Logout:",
          error
        );
      }

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );
    }

    state.user = null;
    state.role = null;
    state.office = null;

    showLogin();
  }

  // =====================================================
  // LOGIN FORM
  // =====================================================

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
      async event => {

        event.preventDefault();

        const email =
          $("email")?.value ||
          $("loginEmail")?.value ||
          "";

        const password =
          $("password")?.value ||
          $("loginPassword")?.value ||
          "";

        await login(
          email,
          password
        );
      }
    );
  }

  // =====================================================
  // OFFICE FORM
  // =====================================================

  function setupOfficeForm() {

    const form =
      $("createOfficeForm");

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        await createOffice();
      }
    );
  }

  // =====================================================
  // PERSON FORM
  // =====================================================

  function setupPersonForm() {

    const form =
      $("personForm");

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        await addPerson();
      }
    );
  }

  // =====================================================
  // LOGOUT BUTTONS
  // =====================================================

  function setupLogoutButtons() {

    document
      .querySelectorAll(
        "[data-action='logout']"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          logout
        );
      });
  }

  // =====================================================
  // AUTH EVENTS
  // =====================================================

  supabaseClient.auth
    .onAuthStateChange(
      (event, session) => {

        console.log(
          "Supabase Auth:",
          event
        );

        if (session) {
          state.user =
            session.user;
        } else {
          state.user = null;
        }
      }
    );

  // =====================================================
  // START
  // =====================================================

  async function start() {

    console.log(
      "Starting Debt Book..."
    );

    setupLoginForm();
    setupOfficeForm();
    setupPersonForm();
    setupLogoutButtons();

    const session =
      await getSession();

    if (session) {

      console.log(
        "Existing Supabase session"
      );

      state.user =
        session.user;

      await loadUser();

    } else {

      console.log(
        "No existing session"
      );

      showLogin();
    }

    state.initialized =
      true;

    finishLoading();

    console.log(
      "Debt Book ready"
    );
  }

  // =====================================================
  // PUBLIC API
  // =====================================================

  window.DebtBook = {

    supabase:
      supabaseClient,

    state,

    login,

    logout,

    loadUser,

    loadOffices,

    loadPeople,

    createOffice,

    toggleOffice,

    addPerson,

    openPerson
  };

  // =====================================================
  // RUN
  // =====================================================

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