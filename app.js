(function () {
  "use strict";

  console.log("Starting Debt Book...");

  // =========================================================
  // SUPABASE
  // =========================================================

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = CFG.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR-") &&
    !SUPABASE_ANON_KEY.includes("YOUR-")
  ) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    console.log("Supabase connected");
  } else {
    console.error("Supabase configuration is missing");
  }


  // =========================================================
  // STATE
  // =========================================================

  const state = {
    role: null,
    session: null,

    offices: [],

    currentOffice: null,
    currentOfficeId: null,

    people: [],
    transactions: [],

    currentPersonId: null,

    searchQuery: "",

    officeSearch: ""
  };


  // =========================================================
  // HELPERS
  // =========================================================

  function $(id) {
    return document.getElementById(id);
  }


  function hideLoading() {
    const el = $("loadingScreen");

    if (el) {
      el.classList.add("hidden");
      el.style.display = "none";
    }
  }


  function showOnly(viewId) {

    [
      "loginView",
      "adminView",
      "appView"
    ].forEach(function (id) {

      const el = $(id);

      if (el) {
        el.classList.add("hidden");
      }

    });

    const target = $(viewId);

    if (target) {
      target.classList.remove("hidden");
    }
  }


  function showLogin() {
    showOnly("loginView");

    const msg = $("loginMessage");

    if (msg) {
      msg.classList.add("hidden");
    }
  }


  function showAdmin() {
    showOnly("adminView");

    loadOffices();
  }


  function showApp() {
    showOnly("appView");

    const peopleView = $("peopleView");
    const personView = $("personView");

    if (peopleView) {
      peopleView.classList.remove("hidden");
    }

    if (personView) {
      personView.classList.add("hidden");
    }

    loadOfficeData();
  }


  function escapeHtml(value) {

    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatMoney(value) {

    const number = Number(value || 0);

    return number.toLocaleString("ar-IQ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }


  function formatDate(date) {

    if (!date) {
      return "-";
    }

    try {

      return new Date(date).toLocaleDateString(
        "ar-IQ",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      );

    } catch (e) {
      return date;
    }
  }


  function todayString() {

    const d = new Date();

    const year = d.getFullYear();

    const month = String(
      d.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      d.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  function isContractExpired(office) {

    if (!office) {
      return true;
    }

    if (!office.contract_end) {
      return false;
    }

    return office.contract_end < todayString();
  }


  function isOfficeAllowed(office) {

    if (!office) {
      return false;
    }

    if (office.active !== true) {
      return false;
    }

    if (office.contract_active !== true) {
      return false;
    }

    if (isContractExpired(office)) {
      return false;
    }

    return true;
  }


  function showLoginMessage(message, type) {

    const el = $("loginMessage");

    if (!el) {
      return;
    }

    el.textContent = message;

    el.className =
      "login-message " +
      (type === "error"
        ? "error"
        : "success");

    el.classList.remove("hidden");
  }


  function setLoginLoading(loading) {

    const btn = $("loginBtn");

    if (!btn) {
      return;
    }

    btn.disabled = loading;

    btn.textContent =
      loading
        ? "جارٍ الدخول..."
        : "دخول";
  }


  function notify(message, type) {

    // إذا عندك نظام إشعارات في style.css
    // استخدمه، وإلا alert
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
      return;
    }

    alert(message);
  }


  function updateConnectionStatus() {

    const dot = $("connDot");
    const text = $("connText");

    if (!dot || !text) {
      return;
    }

    if (supabaseClient) {

      dot.style.background = "#22c55e";

      text.textContent =
        "متصل بـ Supabase";

    } else {

      dot.style.background = "#ef4444";

      text.textContent =
        "Supabase غير متصل";
    }
  }


  // =========================================================
  // MODAL
  // =========================================================

  function openModal(title, html) {

    const modal = $("modal");
    const modalTitle = $("modalTitle");
    const modalBody = $("modalBody");

    if (!modal) {
      return;
    }

    if (modalTitle) {
      modalTitle.textContent = title;
    }

    if (modalBody) {
      modalBody.innerHTML = html;
    }

    modal.classList.remove("hidden");
  }


  function closeModal() {

    const modal = $("modal");

    if (modal) {
      modal.classList.add("hidden");
    }
  }


  // =========================================================
  // LOGIN
  // =========================================================

  async function handleLogin(event) {

    event.preventDefault();

    if (!supabaseClient) {

      showLoginMessage(
        "Supabase غير متصل. تأكد من supabase-config.js",
        "error"
      );

      return;
    }

    const loginInput =
      $("loginEmail").value.trim();

    const password =
      $("loginPassword").value;

    if (!loginInput || !password) {

      showLoginMessage(
        "اكتب اسم المستخدم وكلمة المرور",
        "error"
      );

      return;
    }

    setLoginLoading(true);

    showLoginMessage(
      "جارٍ تسجيل الدخول...",
      "success"
    );

    try {

      // =====================================================
      // إذا كان بريد إلكتروني → نحاول Admin Auth
      // =====================================================

      if (loginInput.includes("@")) {

        const result =
          await supabaseClient.auth.signInWithPassword({
            email: loginInput,
            password: password
          });

        if (!result.error && result.data?.session) {

          state.role = "admin";

          state.session =
            result.data.session;

          console.log(
            "Admin login successful"
          );

          setLoginLoading(false);

          showAdmin();

          return;
        }

        console.warn(
          "Admin Auth failed:",
          result.error
        );
      }


      // =====================================================
      // دخول المكتب
      // =====================================================

      const officeResult =
        await supabaseClient
          .from("offices")
          .select("*")
          .eq("username", loginInput)
          .eq("password", password)
          .maybeSingle();


      if (officeResult.error) {

        console.error(
          "Office login:",
          officeResult.error
        );

        showLoginMessage(
          "تعذر تسجيل الدخول. تحقق من اتصال Supabase وسياسات RLS.",
          "error"
        );

        setLoginLoading(false);

        return;
      }


      const office =
        officeResult.data;


      if (!office) {

        showLoginMessage(
          "اسم المستخدم أو كلمة المرور غير صحيحة.",
          "error"
        );

        setLoginLoading(false);

        return;
      }


      // =====================================================
      // التحقق من تفعيل المكتب
      // =====================================================

      if (office.active !== true) {

        showLoginMessage(
          "هذا المكتب معطل من قبل الأدمن.",
          "error"
        );

        setLoginLoading(false);

        return;
      }


      // =====================================================
      // التحقق من العقد
      // =====================================================

      if (office.contract_active !== true) {

        showLoginMessage(
          "العقد معطل من قبل الأدمن.",
          "error"
        );

        setLoginLoading(false);

        return;
      }


      if (isContractExpired(office)) {

        showLoginMessage(
          "مدة عقد هذا المكتب انتهت.",
          "error"
        );

        setLoginLoading(false);

        return;
      }


      // =====================================================
      // تسجيل المكتب
      // =====================================================

      state.role = "office";

      state.currentOffice =
        office;

      state.currentOfficeId =
        office.id;

      state.people = [];

      state.transactions = [];

      console.log(
        "Office login successful:",
        office.name
      );

      setLoginLoading(false);

      showApp();

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      showLoginMessage(
        "حدث خطأ أثناء تسجيل الدخول.",
        "error"
      );

      setLoginLoading(false);
    }
  }


  // =========================================================
  // ADMIN LOGOUT
  // =========================================================

  async function adminLogout() {

    if (supabaseClient) {

      try {
        await supabaseClient.auth.signOut();
      } catch (error) {
        console.warn(
          "Logout error:",
          error
        );
      }
    }

    resetState();

    showLogin();
  }


  async function logout() {

    if (state.role === "admin") {
      await adminLogout();
      return;
    }

    resetState();

    showLogin();
  }


  function resetState() {

    state.role = null;
    state.session = null;

    state.offices = [];

    state.currentOffice = null;
    state.currentOfficeId = null;

    state.people = [];
    state.transactions = [];

    state.currentPersonId = null;

    state.searchQuery = "";
  }


  // =========================================================
  // ADMIN - OFFICES
  // =========================================================

  async function loadOffices() {

    if (!supabaseClient) {
      return;
    }

    try {

      const result =
        await supabaseClient
          .from("offices")
          .select("*")
          .order("created_at", {
            ascending: false
          });


      if (result.error) {

        console.error(
          "Load offices:",
          result.error
        );

        notify(
          "تعذر تحميل المكاتب من Supabase.",
          "error"
        );

        return;
      }


      state.offices =
        result.data || [];


      renderOffices();

    } catch (error) {

      console.error(
        "Load offices exception:",
        error
      );
    }
  }


  function renderOffices() {

    const list =
      $("officesList");

    const empty =
      $("officesEmpty");

    const count =
      $("officesCount");

    if (!list) {
      return;
    }


    const query =
      (state.officeSearch || "")
        .trim()
        .toLowerCase();


    let offices =
      state.offices.filter(function (office) {

        if (!query) {
          return true;
        }

        return (
          String(office.name || "")
            .toLowerCase()
            .includes(query)
          ||
          String(office.username || "")
            .toLowerCase()
            .includes(query)
        );

      });


    if (count) {
      count.textContent =
        state.offices.length;
    }


    if (!offices.length) {

      list.innerHTML = "";

      if (empty) {
        empty.classList.remove("hidden");
      }

      return;
    }


    if (empty) {
      empty.classList.add("hidden");
    }


    list.innerHTML =
      offices.map(renderOfficeCard).join("");
  }


  function renderOfficeCard(office) {

    const expired =
      isContractExpired(office);

    let statusText = "فعال";
    let statusClass = "active";


    if (office.active !== true) {

      statusText =
        "المكتب معطل";

      statusClass =
        "disabled";

    } else if (
      office.contract_active !== true
    ) {

      statusText =
        "العقد معطل";

      statusClass =
        "disabled";

    } else if (expired) {

      statusText =
        "العقد منتهي";

      statusClass =
        "expired";
    }


    return `
      <div class="person-item office-card">

        <div class="person-main">

          <div class="person-avatar">
            🏢
          </div>

          <div class="person-info">

            <h3>
              ${escapeHtml(office.name)}
            </h3>

            <p>
              اسم المستخدم:
              ${escapeHtml(office.username)}
            </p>

            ${
              office.phone
                ? `<p>${escapeHtml(office.phone)}</p>`
                : ""
            }

            <div class="office-contract">

              ${
                office.contract_start
                  ? `من ${formatDate(office.contract_start)}`
                  : "بدون بداية"
              }

              →

              ${
                office.contract_end
                  ? formatDate(office.contract_end)
                  : "بدون نهاية"
              }

            </div>

            <div style="margin-top:8px">

              <span class="contract-status ${statusClass}">
                ${statusText}
              </span>

            </div>

          </div>

        </div>


        <div class="admin-contract-controls">

          <button
            class="btn btn-edit"
            onclick="window.editOffice('${office.id}')">

            تعديل

          </button>


          ${
            office.contract_active === true
              ? `
                <button
                  class="btn btn-contract-off"
                  onclick="window.toggleOfficeContract('${office.id}', false)">

                  تعطيل العقد

                </button>
              `
              : `
                <button
                  class="btn btn-contract-on"
                  onclick="window.toggleOfficeContract('${office.id}', true)">

                  تفعيل العقد

                </button>
              `
          }


          ${
            office.active === true
              ? `
                <button
                  class="btn btn-contract-off"
                  onclick="window.toggleOfficeActive('${office.id}', false)">

                  تعطيل المكتب

                </button>
              `
              : `
                <button
                  class="btn btn-contract-on"
                  onclick="window.toggleOfficeActive('${office.id}', true)">

                  تفعيل المكتب

                </button>
              `
          }


          <button
            class="btn btn-danger"
            onclick="window.deleteOffice('${office.id}')">

            حذف

          </button>

        </div>

      </div>
    `;
  }


  // =========================================================
  // ADD OFFICE
  // =========================================================

  function showAddOfficeModal() {

    openModal(
      "إضافة مكتب",
      `
        <form id="officeForm">

          <div class="form-group">

            <label>
              اسم المكتب
            </label>

            <input
              id="officeName"
              required
              placeholder="مثال: مكتب أحمد"
            >

          </div>


          <div class="form-group">

            <label>
              اسم المستخدم
            </label>

            <input
              id="officeUsername"
              required
              autocomplete="off"
              placeholder="اسم دخول المكتب"
            >

          </div>


          <div class="form-group">

            <label>
              كلمة المرور
            </label>

            <input
              id="officePassword"
              type="password"
              required
              autocomplete="new-password"
            >

          </div>


          <div class="form-group">

            <label>
              رقم الهاتف
            </label>

            <input
              id="officePhone"
              type="tel"
            >

          </div>


          <div class="form-row">

            <div class="form-group">

              <label>
                بداية العقد
              </label>

              <input
                id="contractStart"
                type="date"
              >

            </div>


            <div class="form-group">

              <label>
                نهاية العقد
              </label>

              <input
                id="contractEnd"
                type="date"
              >

            </div>

          </div>


          <div class="form-group">

            <label>
              تفاصيل
            </label>

            <textarea
              id="officeDetails">
            </textarea>

          </div>


          <button
            class="btn btn-primary"
            type="submit"
            style="width:100%">

            حفظ المكتب

          </button>

        </form>
      `
    );


    const form =
      $("officeForm");

    if (form) {

      form.addEventListener(
        "submit",
        saveOffice
      );

    }
  }


  async function saveOffice(event) {

    event.preventDefault();


    const name =
      $("officeName").value.trim();

    const username =
      $("officeUsername").value.trim();

    const password =
      $("officePassword").value;

    const phone =
      $("officePhone").value.trim();

    const details =
      $("officeDetails").value.trim();

    const contractStart =
      $("contractStart").value || null;

    const contractEnd =
      $("contractEnd").value || null;


    if (!name || !username || !password) {

      alert(
        "اسم المكتب واسم المستخدم وكلمة المرور مطلوبة."
      );

      return;
    }


    if (
      contractStart &&
      contractEnd &&
      contractEnd < contractStart
    ) {

      alert(
        "نهاية العقد يجب أن تكون بعد بداية العقد."
      );

      return;
    }


    try {

      const result =
        await supabaseClient
          .from("offices")
          .insert({
            name: name,
            username: username,
            password: password,
            phone: phone,
            details: details,
            active: true,
            contract_start: contractStart,
            contract_end: contractEnd,
            contract_active: true
          })
          .select()
          .single();


      if (result.error) {

        console.error(
          "Create office:",
          result.error
        );

        if (
          result.error.code === "23505"
        ) {

          alert(
            "اسم المستخدم مستخدم مسبقًا."
          );

        } else {

          alert(
            result.error.message ||
            "تعذر إنشاء المكتب."
          );
        }

        return;
      }


      closeModal();

      await loadOffices();

      alert(
        "تم إنشاء المكتب وحفظه في Supabase."
      );

    } catch (error) {

      console.error(
        "Save office exception:",
        error
      );

      alert(
        "حدث خطأ أثناء حفظ المكتب."
      );
    }
  }


  // =========================================================
  // EDIT OFFICE
  // =========================================================

  async function editOffice(id) {

    const office =
      state.offices.find(
        o => o.id === id
      );

    if (!office) {
      return;
    }


    openModal(
      "تعديل المكتب",
      `
        <form id="editOfficeForm">

          <div class="form-group">

            <label>
              اسم المكتب
            </label>

            <input
              id="editOfficeName"
              value="${escapeHtml(office.name)}"
              required
            >

          </div>


          <div class="form-group">

            <label>
              اسم المستخدم
            </label>

            <input
              id="editOfficeUsername"
              value="${escapeHtml(office.username)}"
              required
            >

          </div>


          <div class="form-group">

            <label>
              كلمة المرور
            </label>

            <input
              id="editOfficePassword"
              type="password"
              placeholder="اتركها فارغة إذا لا تريد تغييرها"
            >

          </div>


          <div class="form-group">

            <label>
              الهاتف
            </label>

            <input
              id="editOfficePhone"
              value="${escapeHtml(office.phone || "")}"
            >

          </div>


          <div class="form-row">

            <div class="form-group">

              <label>
                بداية العقد
              </label>

              <input
                id="editContractStart"
                type="date"
                value="${office.contract_start || ""}"
              >

            </div>


            <div class="form-group">

              <label>
                نهاية العقد
              </label>

              <input
                id="editContractEnd"
                type="date"
                value="${office.contract_end || ""}"
              >

            </div>

          </div>


          <div class="form-group">

            <label>
              التفاصيل
            </label>

            <textarea
              id="editOfficeDetails">${escapeHtml(
                office.details || ""
              )}</textarea>

          </div>


          <button
            class="btn btn-primary"
            type="submit"
            style="width:100%">

            حفظ التعديلات

          </button>

        </form>
      `
    );


    $("editOfficeForm").addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        const updateData = {

          name:
            $("editOfficeName")
              .value.trim(),

          username:
            $("editOfficeUsername")
              .value.trim(),

          phone:
            $("editOfficePhone")
              .value.trim(),

          details:
            $("editOfficeDetails")
              .value.trim(),

          contract_start:
            $("editContractStart")
              .value || null,

          contract_end:
            $("editContractEnd")
              .value || null

        };


        const newPassword =
          $("editOfficePassword")
            .value;


        if (
          updateData.contract_start &&
          updateData.contract_end &&
          updateData.contract_end <
          updateData.contract_start
        ) {

          alert(
            "نهاية العقد يجب أن تكون بعد البداية."
          );

          return;
        }


        if (newPassword) {

          updateData.password =
            newPassword;
        }


        const result =
          await supabaseClient
            .from("offices")
            .update(updateData)
            .eq("id", id);


        if (result.error) {

          console.error(
            "Update office:",
            result.error
          );

          alert(
            result.error.message ||
            "تعذر تعديل المكتب."
          );

          return;
        }


        closeModal();

        await loadOffices();

        alert(
          "تم حفظ تعديلات المكتب."
        );
      }
    );
  }


  // =========================================================
  // TOGGLE OFFICE ACTIVE
  // =========================================================

  async function toggleOfficeActive(
    id,
    active
  ) {

    const result =
      await supabaseClient
        .from("offices")
        .update({
          active: active
        })
        .eq("id", id);


    if (result.error) {

      console.error(
        "Toggle office:",
        result.error
      );

      alert(
        result.error.message
      );

      return;
    }


    await loadOffices();
  }


  // =========================================================
  // TOGGLE CONTRACT
  // =========================================================

  async function toggleOfficeContract(
    id,
    active
  ) {

    const result =
      await supabaseClient
        .from("offices")
        .update({
          contract_active: active
        })
        .eq("id", id);


    if (result.error) {

      console.error(
        "Toggle contract:",
        result.error
      );

      alert(
        result.error.message
      );

      return;
    }


    await loadOffices();
  }


  // =========================================================
  // DELETE OFFICE
  // =========================================================

  async function deleteOffice(id) {

    const office =
      state.offices.find(
        o => o.id === id
      );


    if (!office) {
      return;
    }


    const ok =
      confirm(
        `هل تريد حذف مكتب "${office.name}"؟\n\nسيتم حذف الأشخاص والحركات التابعة له أيضًا.`
      );


    if (!ok) {
      return;
    }


    const result =
      await supabaseClient
        .from("offices")
        .delete()
        .eq("id", id);


    if (result.error) {

      console.error(
        "Delete office:",
        result.error
      );

      alert(
        result.error.message ||
        "تعذر حذف المكتب."
      );

      return;
    }


    await loadOffices();

    alert(
      "تم حذف المكتب."
    );
  }


  // =========================================================
  // OFFICE DATA
  // =========================================================

  async function loadOfficeData() {

    if (!state.currentOfficeId) {
      return;
    }


    updateOfficeHeader();

    updateContractBanner();


    try {

      const peopleResult =
        await supabaseClient
          .from("people")
          .select("*")
          .eq(
            "office_id",
            state.currentOfficeId
          )
          .order("created_at", {
            ascending: false
          });


      if (peopleResult.error) {

        console.error(
          "Load people:",
          peopleResult.error
        );

        alert(
          "تعذر تحميل الأشخاص."
        );

        return;
      }


      state.people =
        peopleResult.data || [];


      const txnResult =
        await supabaseClient
          .from("transactions")
          .select("*")
          .eq(
            "office_id",
            state.currentOfficeId
          )
          .order("date", {
            ascending: false
          });


      if (txnResult.error) {

        console.error(
          "Load transactions:",
          txnResult.error
        );

        alert(
          "تعذر تحميل الحركات."
        );

        return;
      }


      state.transactions =
        txnResult.data || [];


      renderPeople();

      updateStats();

    } catch (error) {

      console.error(
        "Load office data:",
        error
      );
    }
  }


  // =========================================================
  // OFFICE HEADER
  // =========================================================

  function updateOfficeHeader() {

    if (!state.currentOffice) {
      return;
    }


    const title =
      $("appTitle");

    const subtitle =
      $("appSubtitle");


    if (title) {

      title.textContent =
        state.currentOffice.name;
    }


    if (subtitle) {

      subtitle.textContent =
        "إدارة الديون بسهولة";
    }


    const back =
      $("backToAdminBtn");


    if (back) {

      if (state.role === "admin") {
        back.classList.remove("hidden");
      } else {
        back.classList.add("hidden");
      }
    }
  }


  // =========================================================
  // CONTRACT BANNER
  // =========================================================

  function updateContractBanner() {

    const banner =
      $("contractBanner");


    if (!banner || !state.currentOffice) {
      return;
    }


    const office =
      state.currentOffice;


    banner.className =
      "contract-banner";


    if (office.contract_active !== true) {

      banner.classList.add(
        "disabled"
      );

      banner.innerHTML = `
        <strong>
          🔴 العقد معطل
        </strong>
        <br>
        تم تعطيل عقد هذا المكتب من قبل الأدمن.
      `;

      banner.classList.remove(
        "hidden"
      );

      return;
    }


    if (isContractExpired(office)) {

      banner.classList.add(
        "expired"
      );

      banner.innerHTML = `
        <strong>
          ⚠️ العقد منتهي
        </strong>
        <br>
        انتهت مدة العقد بتاريخ
        ${formatDate(office.contract_end)}
      `;

      banner.classList.remove(
        "hidden"
      );

      return;
    }


    banner.innerHTML = `
      <strong>
        🟢 العقد فعال
      </strong>

      <br>

      مدة العقد:

      ${
        office.contract_start
          ? formatDate(office.contract_start)
          : "غير محدد"
      }

      →

      ${
        office.contract_end
          ? formatDate(office.contract_end)
          : "غير محدد"
      }
    `;


    banner.classList.remove(
      "hidden"
    );
  }


  // =========================================================
  // PEOPLE
  // =========================================================

  function getPersonDebt(personId) {

    let balance = 0;


    state.transactions
      .filter(
        t =>
          t.person_id === personId
      )
      .forEach(function (txn) {

        if (
          txn.type === "purchase"
        ) {

          balance +=
            Number(txn.amount);

        } else if (
          txn.type === "payment"
        ) {

          balance -=
            Number(txn.amount);
        }

      });


    return balance;
  }


  function renderPeople() {

    const list =
      $("peopleList");

    const empty =
      $("emptyState");


    if (!list) {
      return;
    }


    const query =
      state.searchQuery
        .trim()
        .toLowerCase();


    const people =
      state.people.filter(
        function (person) {

          if (!query) {
            return true;
          }

          return (
            String(person.name || "")
              .toLowerCase()
              .includes(query)
            ||
            String(person.phone || "")
              .toLowerCase()
              .includes(query)
          );

        }
      );


    if (!people.length) {

      list.innerHTML = "";

      if (empty) {
        empty.classList.remove(
          "hidden"
        );
      }

      return;
    }


    if (empty) {
      empty.classList.add(
        "hidden"
      );
    }


    list.innerHTML =
      people.map(
        function (person) {

          const debt =
            getPersonDebt(
              person.id
            );


          return `
            <div
              class="person-item"
              onclick="window.openPerson('${person.id}')">

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

                  ${
                    person.phone
                      ? `
                        <p>
                          ${escapeHtml(
                            person.phone
                          )}
                        </p>
                      `
                      : ""
                  }

                </div>

              </div>


              <div class="person-balance">

                <strong>
                  ${formatMoney(debt)}
                </strong>

                <small>
                  المستحق
                </small>

              </div>

            </div>
          `;
        }
      ).join("");
  }


  // =========================================================
  // STATS
  // =========================================================

  function updateStats() {

    const peopleCount =
      $("peopleCount");

    const totalDebt =
      $("totalDebt");


    if (peopleCount) {

      peopleCount.textContent =
        state.people.length;
    }


    let total = 0;


    state.people.forEach(
      function (person) {

        const debt =
          getPersonDebt(
            person.id
          );

        total += debt;

      }
    );


    if (totalDebt) {

      totalDebt.textContent =
        formatMoney(total);
    }
  }


  // =========================================================
  // ADD PERSON
  // =========================================================

  function showAddPersonModal() {

    openModal(
      "إضافة شخص",
      `
        <form id="personForm">

          <div class="form-group">

            <label>
              الاسم
            </label>

            <input
              id="personName"
              required
            >

          </div>


          <div class="form-group">

            <label>
              رقم الهاتف
            </label>

            <input
              id="personPhone"
              type="tel"
            >

          </div>


          <div class="form-group">

            <label>
              التفاصيل
            </label>

            <textarea
              id="personDetails">
            </textarea>

          </div>


          <button
            type="submit"
            class="btn btn-primary"
            style="width:100%">

            حفظ الشخص

          </button>

        </form>
      `
    );


    $("personForm").addEventListener(
      "submit",
      savePerson
    );
  }


  async function savePerson(event) {

    event.preventDefault();


    if (!state.currentOfficeId) {
      return;
    }


    const data = {

      office_id:
        state.currentOfficeId,

      name:
        $("personName")
          .value.trim(),

      phone:
        $("personPhone")
          .value.trim(),

      details:
        $("personDetails")
          .value.trim()

    };


    if (!data.name) {

      alert(
        "اكتب اسم الشخص."
      );

      return;
    }


    const result =
      await supabaseClient
        .from("people")
        .insert(data);


    if (result.error) {

      console.error(
        "Create person:",
        result.error
      );

      alert(
        result.error.message
      );

      return;
    }


    closeModal();

    await loadOfficeData();
  }


  // =========================================================
  // PERSON PAGE
  // =========================================================

  function openPerson(id) {

    const person =
      state.people.find(
        p => p.id === id
      );


    if (!person) {
      return;
    }


    state.currentPersonId =
      id;


    $("peopleView")
      .classList.add(
        "hidden"
      );

    $("personView")
      .classList.remove(
        "hidden"
      );


    renderPersonPage();
  }


  function renderPersonPage() {

    const person =
      state.people.find(
        p =>
          p.id ===
          state.currentPersonId
      );


    if (!person) {
      return;
    }


    const card =
      $("personCard");


    if (card) {

      const debt =
        getPersonDebt(
          person.id
        );


      card.innerHTML = `
        <div>

          <h2>
            ${escapeHtml(
              person.name
            )}
          </h2>

          ${
            person.phone
              ? `
                <p>
                  📞
                  ${escapeHtml(
                    person.phone
                  )}
                </p>
              `
              : ""
          }

          ${
            person.details
              ? `
                <p>
                  ${escapeHtml(
                    person.details
                  )}
                </p>
              `
              : ""
          }

        </div>


        <div>

          <strong>
            ${formatMoney(debt)}
          </strong>

          <small>
            إجمالي المستحق
          </small>

        </div>
      `;
    }


    renderTransactions();
  }


  // =========================================================
  // TRANSACTIONS
  // =========================================================

  function renderTransactions() {

    const list =
      $("transactionsList");

    const count =
      $("txnCount");


    const transactions =
      state.transactions.filter(
        t =>
          t.person_id ===
          state.currentPersonId
      );


    if (count) {

      count.textContent =
        transactions.length;
    }


    if (!list) {
      return;
    }


    if (!transactions.length) {

      list.innerHTML = `
        <div class="empty-state">
          لا توجد حركات لهذا الشخص.
        </div>
      `;

      return;
    }


    list.innerHTML =
      transactions.map(
        function (txn) {

          const purchase =
            txn.type === "purchase";


          return `
            <div class="transaction-item">

              <div>

                <strong>
                  ${
                    purchase
                      ? "شراء"
                      : "تسديد"
                  }
                </strong>

                <small>
                  ${formatDate(
                    txn.date
                  )}
                </small>

                ${
                  txn.details
                    ? `
                      <p>
                        ${escapeHtml(
                          txn.details
                        )}
                      </p>
                    `
                    : ""
                }

              </div>


              <div
                style="
                  color:
                    ${
                      purchase
                        ? "#dc2626"
                        : "#16a34a"
                    };
                  font-weight:800;
                ">

                ${
                  purchase
                    ? "+"
                    : "-"
                }

                ${formatMoney(
                  txn.amount
                )}

              </div>

            </div>
          `;
        }
      ).join("");
  }


  // =========================================================
  // ADD TRANSACTION
  // =========================================================

  function showTransactionModal(type) {

    const person =
      state.people.find(
        p =>
          p.id ===
          state.currentPersonId
      );


    if (!person) {
      return;
    }


    const title =
      type === "payment"
        ? "تسجيل تسديد"
        : "تسجيل شراء";


    openModal(
      title,
      `
        <form id="transactionForm">

          <div class="form-group">

            <label>
              المبلغ
            </label>

            <input
              id="transactionAmount"
              type="number"
              min="0.01"
              step="0.01"
              required
            >

          </div>


          <div class="form-group">

            <label>
              التفاصيل
            </label>

            <textarea
              id="transactionDetails">
            </textarea>

          </div>


          <button
            type="submit"
            class="btn ${
              type === "payment"
                ? "btn-success"
                : "btn-danger"
            }"
            style="width:100%">

            ${
              type === "payment"
                ? "حفظ التسديد"
                : "حفظ الشراء"
            }

          </button>

        </form>
      `
    );


    $("transactionForm").addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        const amount =
          Number(
            $("transactionAmount")
              .value
          );


        if (
          !amount ||
          amount <= 0
        ) {

          alert(
            "اكتب مبلغ صحيح."
          );

          return;
        }


        const result =
          await supabaseClient
            .from("transactions")
            .insert({

              office_id:
                state.currentOfficeId,

              person_id:
                state.currentPersonId,

              type: type,

              amount: amount,

              details:
                $("transactionDetails")
                  .value.trim(),

              date:
                new Date()
                  .toISOString()

            });


        if (result.error) {

          console.error(
            "Create transaction:",
            result.error
          );

          alert(
            result.error.message
          );

          return;
        }


        closeModal();

        await loadOfficeData();

        renderPersonPage();
      }
    );
  }


  // =========================================================
  // EDIT PERSON
  // =========================================================

  function showEditPersonModal() {

    const person =
      state.people.find(
        p =>
          p.id ===
          state.currentPersonId
      );


    if (!person) {
      return;
    }


    openModal(
      "تعديل بيانات الشخص",
      `
        <form id="editPersonForm">

          <div class="form-group">

            <label>
              الاسم
            </label>

            <input
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
              id="editPersonPhone"
              value="${escapeHtml(
                person.phone || ""
              )}"
            >

          </div>


          <div class="form-group">

            <label>
              التفاصيل
            </label>

            <textarea
              id="editPersonDetails"
            >${escapeHtml(
              person.details || ""
            )}</textarea>

          </div>


          <button
            type="submit"
            class="btn btn-primary"
            style="width:100%">

            حفظ

          </button>

        </form>
      `
    );


    $("editPersonForm")
      .addEventListener(
        "submit",
        async function (event) {

          event.preventDefault();


          const result =
            await supabaseClient
              .from("people")
              .update({

                name:
                  $("editPersonName")
                    .value.trim(),

                phone:
                  $("editPersonPhone")
                    .value.trim(),

                details:
                  $("editPersonDetails")
                    .value.trim()

              })
              .eq(
                "id",
                state.currentPersonId
              )
              .eq(
                "office_id",
                state.currentOfficeId
              );


          if (result.error) {

            console.error(
              "Update person:",
              result.error
            );

            alert(
              result.error.message
            );

            return;
          }


          closeModal();

          await loadOfficeData();

          renderPersonPage();
        }
      );
  }


  // =========================================================
  // EXPORT
  // =========================================================

  function exportData() {

    const data = {

      office: state.currentOffice,

      people: state.people,

      transactions:
        state.transactions,

      exported_at:
        new Date().toISOString()

    };


    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
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
      `debt-book-${todayString()}.json`;

    a.click();


    URL.revokeObjectURL(
      url
    );
  }


  // =========================================================
  // IMPORT
  // =========================================================

  function importData() {

    const input =
      $("importFile");


    if (input) {
      input.click();
    }
  }


  async function handleImport(event) {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    try {

      const text =
        await file.text();


      const data =
        JSON.parse(text);


      if (
        !data.people ||
        !data.transactions
      ) {

        throw new Error(
          "Invalid backup"
        );
      }


      const ok =
        confirm(
          "سيتم استيراد البيانات إلى المكتب الحالي. هل تريد المتابعة؟"
        );


      if (!ok) {
        return;
      }


      // استيراد الأشخاص
      for (
        const person of data.people
      ) {

        const personResult =
          await supabaseClient
            .from("people")
            .insert({

              office_id:
                state.currentOfficeId,

              name:
                person.name || "",

              phone:
                person.phone || "",

              details:
                person.details || ""

            })
            .select()
            .single();


        if (personResult.error) {
          throw personResult.error;
        }
      }


      alert(
        "تم استيراد الأشخاص. الحركات تحتاج ربطًا جديدًا بالأشخاص."
      );


      await loadOfficeData();

    } catch (error) {

      console.error(
        "Import error:",
        error
      );

      alert(
        "تعذر استيراد النسخة."
      );

    } finally {

      event.target.value = "";
    }
  }


  // =========================================================
  // EVENTS
  // =========================================================

  function setupEvents() {

    // Login
    const loginForm =
      $("loginForm");

    if (loginForm) {

      loginForm.addEventListener(
        "submit",
        handleLogin
      );
    }


    // Admin logout
    const adminLogout =
      $("adminLogoutBtn");

    if (adminLogout) {

      adminLogout.addEventListener(
        "click",
        adminLogout
      );
    }


    // App logout
    const logoutBtn =
      $("logoutBtn");

    if (logoutBtn) {

      logoutBtn.addEventListener(
        "click",
        logout
      );
    }


    // Add office
    const addOffice =
      $("addOfficeBtn");

    if (addOffice) {

      addOffice.addEventListener(
        "click",
        showAddOfficeModal
      );
    }


    // Office search
    const officeSearch =
      $("officeSearch");

    if (officeSearch) {

      officeSearch.addEventListener(
        "input",
        function (event) {

          state.officeSearch =
            event.target.value;

          renderOffices();

        }
      );
    }


    // Search people
    const searchInput =
      $("searchInput");

    if (searchInput) {

      searchInput.addEventListener(
        "input",
        function (event) {

          state.searchQuery =
            event.target.value;

          renderPeople();

        }
      );
    }


    // Add person
    const addPerson =
      $("addPersonBtn");

    if (addPerson) {

      addPerson.addEventListener(
        "click",
        showAddPersonModal
      );
    }


    // Back
    const backBtn =
      $("backBtn");

    if (backBtn) {

      backBtn.addEventListener(
        "click",
        function () {

          $("personView")
            .classList.add(
              "hidden"
            );

          $("peopleView")
            .classList.remove(
              "hidden"
            );

          state.currentPersonId =
            null;

        }
      );
    }


    // Payment
    const payBtn =
      $("payBtn");

    if (payBtn) {

      payBtn.addEventListener(
        "click",
        function () {

          showTransactionModal(
            "payment"
          );

        }
      );
    }


    // Purchase
    const purchaseBtn =
      $("purchaseBtn");

    if (purchaseBtn) {

      purchaseBtn.addEventListener(
        "click",
        function () {

          showTransactionModal(
            "purchase"
          );

        }
      );
    }


    // Edit person
    const editPersonBtn =
      $("editPersonBtn");

    if (editPersonBtn) {

      editPersonBtn.addEventListener(
        "click",
        showEditPersonModal
      );
    }


    // Export
    const exportBtn =
      $("exportBtn");

    if (exportBtn) {

      exportBtn.addEventListener(
        "click",
        exportData
      );
    }


    // Import
    const importBtn =
      $("importBtn");

    if (importBtn) {

      importBtn.addEventListener(
        "click",
        importData
      );
    }


    const importFile =
      $("importFile");

    if (importFile) {

      importFile.addEventListener(
        "change",
        handleImport
      );
    }


    // Close modal
    const modalClose =
      $("modalClose");

    if (modalClose) {

      modalClose.addEventListener(
        "click",
        closeModal
      );
    }


    const modal =
      $("modal");

    if (modal) {

      modal.addEventListener(
        "click",
        function (event) {

          if (
            event.target ===
            modal
          ) {

            closeModal();
          }

        }
      );
    }


    // Back admin
    const backToAdmin =
      $("backToAdminBtn");

    if (backToAdmin) {

      backToAdmin.addEventListener(
        "click",
        function () {

          if (
            state.role === "admin"
          ) {

            showAdmin();
          }

        }
      );
    }
  }


  // =========================================================
  // GLOBAL FUNCTIONS
  // =========================================================

  window.openPerson =
    openPerson;

  window.editOffice =
    editOffice;

  window.toggleOfficeActive =
    toggleOfficeActive;

  window.toggleOfficeContract =
    toggleOfficeContract;

  window.deleteOffice =
    deleteOffice;


  // =========================================================
  // AUTH STATE
  // =========================================================

  function setupAuthListener() {

    if (!supabaseClient) {
      return;
    }


    supabaseClient.auth.onAuthStateChange(
      function (event, session) {

        console.log(
          "Supabase Auth:",
          event
        );


        state.session =
          session;


        if (
          event === "SIGNED_OUT"
        ) {

          if (
            state.role === "admin"
          ) {

            resetState();

            showLogin();
          }
        }

      }
    );
  }


  // =========================================================
  // INITIALIZE
  // =========================================================

  async function init() {

    hideLoading();

    updateConnectionStatus();

    setupEvents();

    setupAuthListener();


    if (!supabaseClient) {

      showLogin();

      showLoginMessage(
        "Supabase غير مضبوط. افتح supabase-config.js وتأكد من الرابط والمفتاح.",
        "error"
      );

      return;
    }


    try {

      const result =
        await supabaseClient.auth.getSession();


      if (result.error) {

        console.error(
          "getSession:",
          result.error
        );

        showLogin();

        return;
      }


      const session =
        result.data?.session;


      if (session) {

        console.log(
          "Existing Supabase session"
        );


        state.session =
          session;

        state.role =
          "admin";


        showAdmin();

      } else {

        console.log(
          "No Supabase session"
        );

        showLogin();
      }


    } catch (error) {

      console.error(
        "Initialization error:",
        error
      );

      hideLoading();

      showLogin();
    }
  }


  // =========================================================
  // START
  // =========================================================

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();
  }

})();