(function () {
  "use strict";

  /* =========================================================
     SUPABASE
     ========================================================= */

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = CFG.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";

  if (
    !window.supabase ||
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    console.error("Supabase configuration is missing.");
  }

  /*
    مهم جداً:
    إنشاء Supabase Client مرة واحدة فقط
  */
  const supabaseClient =
    window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY
      ? window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY
        )
      : null;


  /* =========================================================
     STATE
     ========================================================= */

  const state = {
    role: null,

    currentOffice: null,
    currentOfficeId: null,

    offices: [],
    people: [],
    transactions: [],

    currentPerson: null,
    currentPersonId: null,

    searchQuery: "",

    loading: false
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = (id) => document.getElementById(id);

  function show(el) {
    if (el) {
      el.classList.remove("hidden");
    }
  }

  function hide(el) {
    if (el) {
      el.classList.add("hidden");
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

  function money(value) {
    const number = Number(value || 0);

    return number.toLocaleString("ar-IQ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function formatDate(date) {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleDateString("ar-IQ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    } catch {
      return date;
    }
  }

  function formatDateTime(date) {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleString("ar-IQ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return date;
    }
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getBalance(personId, transactions = state.transactions) {
    let balance = 0;

    for (const transaction of transactions) {
      if (transaction.person_id !== personId) continue;

      if (transaction.type === "purchase") {
        balance += Number(transaction.amount || 0);
      }

      if (transaction.type === "payment") {
        balance -= Number(transaction.amount || 0);
      }
    }

    return balance;
  }

  function getOfficeTransactions(officeId) {
    return state.transactions.filter(
      (transaction) =>
        transaction.office_id === officeId
    );
  }


  /* =========================================================
     VIEWS
     ========================================================= */

  function showLoginView() {
    show($("loginView"));
    hide($("adminView"));
    hide($("appView"));
  }

  function showAdminView() {
    hide($("loginView"));
    show($("adminView"));
    hide($("appView"));
  }

  function showAppView() {
    hide($("loginView"));
    hide($("adminView"));
    show($("appView"));
  }


  /* =========================================================
     LOGIN MESSAGE
     ========================================================= */

  function showLoginMessage(message, type = "error") {
    const box = $("loginMessage");

    if (!box) return;

    box.textContent = message;

    box.classList.remove(
      "hidden",
      "error",
      "success"
    );

    box.classList.add(type);
  }

  function clearLoginMessage() {
    const box = $("loginMessage");

    if (!box) return;

    box.textContent = "";

    box.classList.add("hidden");

    box.classList.remove(
      "error",
      "success"
    );
  }

  function setLoginLoading(loading) {
    state.loading = loading;

    const button = $("loginBtn");

    if (!button) return;

    button.disabled = loading;

    if (loading) {
      button.dataset.oldText = button.textContent;
      button.textContent = "جارٍ تسجيل الدخول...";
    } else {
      button.textContent =
        button.dataset.oldText || "دخول";
    }
  }


  /* =========================================================
     CONNECTION
     ========================================================= */

  async function checkConnection() {
    const dot = $("connDot");
    const text = $("connText");

    if (!supabaseClient) {
      if (dot) dot.className = "conn-dot offline";
      if (text) text.textContent = "Supabase غير مضبوط";
      return false;
    }

    try {
      const { error } = await supabaseClient
        .from("offices")
        .select("id")
        .limit(1);

      /*
        حتى لو كان RLS يمنع القراءة، Supabase نفسه متصل.
      */

      if (!error) {
        if (dot) dot.className = "conn-dot online";
        if (text) text.textContent = "متصل بـ Supabase";
        return true;
      }

      console.warn("Supabase connection:", error);

      if (dot) dot.className = "conn-dot online";
      if (text) text.textContent = "Supabase متصل";

      return true;

    } catch (error) {
      console.error(error);

      if (dot) dot.className = "conn-dot offline";
      if (text) text.textContent = "تعذر الاتصال";

      return false;
    }
  }


  /* =========================================================
     AUTH - ADMIN
     ========================================================= */

  async function loginAdmin(email, password) {
    if (!supabaseClient) {
      throw new Error("Supabase غير مضبوط");
    }

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (error) {
      throw error;
    }

    if (!data || !data.user) {
      throw new Error("تعذر الحصول على حساب الأدمن");
    }

    state.role = "admin";

    state.currentOffice = null;
    state.currentOfficeId = null;

    return data.user;
  }


  /* =========================================================
     LOGIN - OFFICE
     =========================================================

     ملاحظة:
     هذا تسجيل الدخول القديم للمكاتب من جدول offices.
     لا تستخدمه للأدمن.
  */

  async function loginOffice(username, password) {
    if (!supabaseClient) {
      throw new Error("Supabase غير مضبوط");
    }

    const { data, error } =
      await supabaseClient
        .from("offices")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error("Office login:", error);
      throw error;
    }

    if (!data) {
      throw new Error(
        "اسم المستخدم أو كلمة المرور غير صحيحة"
      );
    }

    state.role = "office";

    state.currentOffice = data;
    state.currentOfficeId = data.id;

    return data;
  }


  /* =========================================================
     HANDLE LOGIN
     ========================================================= */

  async function handleLogin(event) {
    event.preventDefault();

    if (state.loading) return;

    clearLoginMessage();

    const emailOrUsername =
      ($("loginEmail")?.value || "").trim();

    const password =
      ($("loginPassword")?.value || "").trim();

    if (!emailOrUsername || !password) {
      showLoginMessage(
        "اكتب اسم المستخدم والباسوورد.",
        "error"
      );
      return;
    }

    setLoginLoading(true);

    /*
      إذا كان المستخدم أدمن:
      نجرب Supabase Auth أولاً.

      مهم:
      الأدمن الذي أنشأته في Authentication
      يجب أن يكون:
      ahmedalbarca20@gmail.com
    */

    try {
      if (
        emailOrUsername.includes("@")
      ) {
        try {
          await loginAdmin(
            emailOrUsername,
            password
          );

          showAdminView();

          await loadOffices();

          return;

        } catch (authError) {
          console.warn(
            "Admin Auth login failed:",
            authError
          );
        }
      }

      /*
        إذا لم يكن أدمن:
        نجرب المكتب.
      */

      try {
        const office =
          await loginOffice(
            emailOrUsername,
            password
          );

        showAppView();

        updateOfficeHeader();

        await loadOfficeData();

        return;

      } catch (officeError) {
        console.error(
          "Office login:",
          officeError
        );

        showLoginMessage(
          "بيانات الدخول غير صحيحة.",
          "error"
        );
      }

    } finally {
      setLoginLoading(false);
    }
  }


  /* =========================================================
     LOGOUT
     ========================================================= */

  async function logout() {
    try {
      if (
        state.role === "admin" &&
        supabaseClient
      ) {
        await supabaseClient.auth.signOut();
      }
    } catch (error) {
      console.error("Logout:", error);
    }

    state.role = null;

    state.currentOffice = null;
    state.currentOfficeId = null;

    state.offices = [];
    state.people = [];
    state.transactions = [];

    state.currentPerson = null;
    state.currentPersonId = null;

    showLoginView();

    if ($("loginEmail")) {
      $("loginEmail").value = "";
    }

    if ($("loginPassword")) {
      $("loginPassword").value = "";
    }

    clearLoginMessage();
  }


  /* =========================================================
     ADMIN - LOAD OFFICES
     ========================================================= */

  async function loadOffices() {
    if (!supabaseClient) return;

    const { data, error } =
      await supabaseClient
        .from("offices")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (error) {
      console.error("Load offices:", error);

      showLoginMessage(
        "تعذر تحميل المكاتب.",
        "error"
      );

      return;
    }

    state.offices = data || [];

    renderOffices();
  }


  /* =========================================================
     ADMIN - RENDER OFFICES
     ========================================================= */

  function renderOffices() {
    const list = $("officesList");
    const empty = $("officesEmpty");
    const count = $("officesCount");

    if (!list) return;

    const query =
      normalize($("officeSearch")?.value);

    let offices = state.offices;

    if (query) {
      offices = offices.filter((office) => {
        return (
          normalize(office.name).includes(query) ||
          normalize(office.username).includes(query) ||
          normalize(office.phone).includes(query)
        );
      });
    }

    if (count) {
      count.textContent =
        state.offices.length;
    }

    if (!offices.length) {
      list.innerHTML = "";

      show(empty);

      return;
    }

    hide(empty);

    list.innerHTML =
      offices.map(renderOfficeCard).join("");
  }


  function renderOfficeCard(office) {
    const active =
      office.active !== false;

    const contract =
      getContractStatus(
        office.contract_start,
        office.contract_end
      );

    return `
      <div class="office-item">

        <div class="office-item-header">

          <div>
            <div class="office-name">
              ${escapeHTML(office.name)}
            </div>

            <div class="office-phone">
              ${escapeHTML(office.phone || "بدون رقم")}
            </div>
          </div>

          <span class="status-badge ${
            active
              ? "active"
              : "inactive"
          }">
            ${active ? "● فعال" : "● غير فعال"}
          </span>

        </div>

        <div class="office-info">

          <div class="info-row">
            <span>👤</span>
            <strong>المستخدم:</strong>
            ${escapeHTML(office.username)}
          </div>

          ${
            office.details
              ? `
                <div class="info-row">
                  <span>📝</span>
                  ${escapeHTML(office.details)}
                </div>
              `
              : ""
          }

          <div class="info-row">
            <span>📅</span>
            <strong>العقد:</strong>
            ${contract.text}
          </div>

        </div>

        <div class="card-footer">

          <div class="card-actions">

            <button
              class="btn btn-primary"
              onclick="window.openOffice('${office.id}')"
            >
              فتح
            </button>

            <button
              class="btn btn-edit"
              onclick="window.editOffice('${office.id}')"
            >
              تعديل
            </button>

            <button
              class="btn btn-danger"
              onclick="window.deleteOffice('${office.id}')"
            >
              حذف
            </button>

          </div>

        </div>

      </div>
    `;
  }


  /* =========================================================
     CONTRACT
     ========================================================= */

  function getContractStatus(start, end) {
    if (!start && !end) {
      return {
        text: "غير محدد",
        className: ""
      };
    }

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    if (start) {
      const startDate =
        new Date(start);

      if (today < startDate) {
        return {
          text:
            `يبدأ ${formatDate(start)}`,
          className: ""
        };
      }
    }

    if (end) {
      const endDate =
        new Date(end);

      endDate.setHours(
        23,
        59,
        59,
        999
      );

      if (today > endDate) {
        return {
          text:
            `منتهي ${formatDate(end)}`,
          className: "danger"
        };
      }

      const diff =
        endDate.getTime() -
        today.getTime();

      const days =
        Math.ceil(
          diff /
          (1000 * 60 * 60 * 24)
        );

      if (days <= 7) {
        return {
          text:
            `متبقي ${days} يوم`,
          className: "warning"
        };
      }

      return {
        text:
          `حتى ${formatDate(end)}`,
        className: ""
      };
    }

    return {
      text:
        `من ${formatDate(start)}`,
      className: ""
    };
  }


  /* =========================================================
     MODAL
     ========================================================= */

  function openModal(title, body) {
    const modal = $("modal");
    const modalTitle = $("modalTitle");
    const modalBody = $("modalBody");

    if (!modal) return;

    if (modalTitle) {
      modalTitle.textContent = title;
    }

    if (modalBody) {
      modalBody.innerHTML = body;
    }

    show(modal);
  }

  function closeModal() {
    hide($("modal"));
  }


  /* =========================================================
     ADD OFFICE
     ========================================================= */

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
          <label>اسم المستخدم</label>
          <input
            type="text"
            id="officeUsername"
            required
            placeholder="office1"
          >
        </div>

        <div class="form-group">
          <label>كلمة المرور</label>
          <input
            type="password"
            id="officePassword"
            required
            placeholder="كلمة مرور المكتب"
          >
        </div>

        <div class="form-group">
          <label>رقم الهاتف</label>
          <input
            type="text"
            id="officePhone"
            placeholder="07xxxxxxxxx"
          >
        </div>

        <div class="contract-fields">

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

        </div>

        <div class="form-group">
          <label>ملاحظات</label>
          <textarea
            id="officeDetails"
            placeholder="تفاصيل المكتب..."
          ></textarea>
        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn btn-ghost"
            onclick="window.closeModal()"
          >
            إلغاء
          </button>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ المكتب
          </button>

        </div>

      </form>
      `
    );

    $("officeForm")?.addEventListener(
      "submit",
      saveOffice
    );
  }


  /* =========================================================
     SAVE OFFICE
     ========================================================= */

  async function saveOffice(event) {
    event.preventDefault();

    if (!supabaseClient) {
      alert("Supabase غير مضبوط.");
      return;
    }

    const name =
      $("officeName")?.value.trim();

    const username =
      $("officeUsername")?.value.trim();

    const password =
      $("officePassword")?.value.trim();

    const phone =
      $("officePhone")?.value.trim() || "";

    const details =
      $("officeDetails")?.value.trim() || "";

    const contractStart =
      $("contractStart")?.value || null;

    const contractEnd =
      $("contractEnd")?.value || null;

    if (!name || !username || !password) {
      alert(
        "اسم المكتب واسم المستخدم وكلمة المرور مطلوبة."
      );
      return;
    }

    if (
      contractStart &&
      contractEnd &&
      contractStart > contractEnd
    ) {
      alert(
        "تاريخ بداية العقد يجب أن يكون قبل تاريخ النهاية."
      );
      return;
    }

    const button =
      event.target.querySelector(
        'button[type="submit"]'
      );

    if (button) {
      button.disabled = true;
      button.textContent = "جارٍ الحفظ...";
    }

    try {
      const { error } =
        await supabaseClient
          .from("offices")
          .insert({
            name,
            username,
            password,
            phone,
            details,
            active: true,
            contract_start: contractStart,
            contract_end: contractEnd
          });

      if (error) {
        console.error(
          "Save office:",
          error
        );

        alert(
          "تعذر حفظ المكتب:\n" +
          error.message
        );

        return;
      }

      closeModal();

      await loadOffices();

      alert("تم حفظ المكتب بنجاح.");

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "حفظ المكتب";
      }
    }
  }


  /* =========================================================
     EDIT OFFICE
     ========================================================= */

  function editOffice(id) {
    const office =
      state.offices.find(
        (item) => item.id === id
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
            value="${escapeHTML(office.name)}"
            required
          >
        </div>

        <div class="form-group">
          <label>اسم المستخدم</label>
          <input
            type="text"
            id="editOfficeUsername"
            value="${escapeHTML(office.username)}"
            required
          >
        </div>

        <div class="form-group">
          <label>
            كلمة المرور
            <small>
              اتركها كما هي إذا لا تريد تغييرها
            </small>
          </label>

          <input
            type="password"
            id="editOfficePassword"
            placeholder="كلمة مرور جديدة"
          >
        </div>

        <div class="form-group">
          <label>رقم الهاتف</label>
          <input
            type="text"
            id="editOfficePhone"
            value="${escapeHTML(office.phone || "")}"
          >
        </div>

        <div class="contract-fields">

          <div class="form-group">
            <label>بداية العقد</label>
            <input
              type="date"
              id="editContractStart"
              value="${office.contract_start || ""}"
            >
          </div>

          <div class="form-group">
            <label>نهاية العقد</label>
            <input
              type="date"
              id="editContractEnd"
              value="${office.contract_end || ""}"
            >
          </div>

        </div>

        <div class="form-group">
          <label>الحالة</label>

          <select id="editOfficeActive">
            <option
              value="true"
              ${office.active ? "selected" : ""}
            >
              فعال
            </option>

            <option
              value="false"
              ${!office.active ? "selected" : ""}
            >
              غير فعال
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>ملاحظات</label>

          <textarea id="editOfficeDetails">${escapeHTML(
            office.details || ""
          )}</textarea>
        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn btn-ghost"
            onclick="window.closeModal()"
          >
            إلغاء
          </button>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ التعديلات
          </button>

        </div>

      </form>
      `
    );

    $("editOfficeForm")?.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const updates = {
          name:
            $("editOfficeName").value.trim(),

          username:
            $("editOfficeUsername").value.trim(),

          phone:
            $("editOfficePhone").value.trim(),

          details:
            $("editOfficeDetails").value.trim(),

          active:
            $("editOfficeActive").value ===
            "true",

          contract_start:
            $("editContractStart").value ||
            null,

          contract_end:
            $("editContractEnd").value ||
            null
        };

        const newPassword =
          $("editOfficePassword").value.trim();

        if (newPassword) {
          updates.password =
            newPassword;
        }

        const { error } =
          await supabaseClient
            .from("offices")
            .update(updates)
            .eq("id", id);

        if (error) {
          console.error(
            "Update office:",
            error
          );

          alert(
            "تعذر تعديل المكتب:\n" +
            error.message
          );

          return;
        }

        closeModal();

        await loadOffices();

        alert("تم تعديل المكتب.");
      }
    );
  }


  /* =========================================================
     DELETE OFFICE
     ========================================================= */

  async function deleteOffice(id) {
    const office =
      state.offices.find(
        (item) => item.id === id
      );

    if (!office) return;

    const confirmed =
      confirm(
        `هل تريد حذف مكتب "${office.name}"؟\n\nسيتم حذف الأشخاص والحركات المرتبطة به إذا كانت العلاقات مضبوطة ON DELETE CASCADE.`
      );

    if (!confirmed) return;

    const { error } =
      await supabaseClient
        .from("offices")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Delete office:",
        error
      );

      alert(
        "تعذر حذف المكتب:\n" +
        error.message
      );

      return;
    }

    await loadOffices();

    alert("تم حذف المكتب.");
  }


  /* =========================================================
     OPEN OFFICE
     ========================================================= */

  async function openOffice(id) {
    const office =
      state.offices.find(
        (item) => item.id === id
      );

    if (!office) return;

    state.role = "admin";

    state.currentOffice = office;
    state.currentOfficeId = office.id;

    showAppView();

    updateOfficeHeader();

    await loadOfficeData();
  }


  /* =========================================================
     UPDATE OFFICE HEADER
     ========================================================= */

  function updateOfficeHeader() {
    const office =
      state.currentOffice;

    if (!office) return;

    if ($("appTitle")) {
      $("appTitle").textContent =
        office.name ||
        "دفتر الديون";
    }

    if ($("appSubtitle")) {
      $("appSubtitle").textContent =
        "إدارة الديون بسهولة";
    }

    updateContractBanner();
  }


  /* =========================================================
     CONTRACT BANNER
     ========================================================= */

  function updateContractBanner() {
    const banner =
      $("contractBanner");

    const office =
      state.currentOffice;

    if (!banner || !office) return;

    const status =
      getContractStatus(
        office.contract_start,
        office.contract_end
      );

    if (
      !office.contract_start &&
      !office.contract_end
    ) {
      hide(banner);
      return;
    }

    banner.className =
      "contract-banner";

    if (status.className) {
      banner.classList.add(
        status.className
      );
    }

    banner.textContent =
      `📅 مدة العقد: ${status.text}`;

    show(banner);
  }


  /* =========================================================
     LOAD OFFICE DATA
     ========================================================= */

  async function loadOfficeData() {
    if (!state.currentOfficeId) return;

    await Promise.all([
      loadPeople(),
      loadTransactions()
    ]);

    renderPeople();
    updateTotals();
  }


  /* =========================================================
     LOAD PEOPLE
     ========================================================= */

  async function loadPeople() {
    const { data, error } =
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

    if (error) {
      console.error(
        "Load people:",
        error
      );

      alert(
        "تعذر تحميل الأشخاص:\n" +
        error.message
      );

      return;
    }

    state.people = data || [];
  }


  /* =========================================================
     LOAD TRANSACTIONS
     ========================================================= */

  async function loadTransactions() {
    const { data, error } =
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

    if (error) {
      console.error(
        "Load transactions:",
        error
      );

      alert(
        "تعذر تحميل الحركات:\n" +
        error.message
      );

      return;
    }

    state.transactions = data || [];
  }


  /* =========================================================
     RENDER PEOPLE
     ========================================================= */

  function renderPeople() {
    const list =
      $("peopleList");

    const empty =
      $("emptyState");

    if (!list) return;

    const query =
      normalize(
        $("searchInput")?.value
      );

    let people =
      state.people;

    if (query) {
      people =
        people.filter((person) => {
          return (
            normalize(person.name)
              .includes(query) ||
            normalize(person.phone)
              .includes(query)
          );
        });
    }

    if (!people.length) {
      list.innerHTML = "";

      show(empty);

      return;
    }

    hide(empty);

    list.innerHTML =
      people
        .map(renderPersonCard)
        .join("");
  }


  function renderPersonCard(person) {
    const balance =
      getBalance(person.id);

    let balanceClass =
      "balance-zero";

    if (balance > 0) {
      balanceClass =
        "balance-positive";
    }

    if (balance < 0) {
      balanceClass =
        "balance-negative";
    }

    return `
      <div class="person-item">

        <div class="person-item-header">

          <div>

            <div class="person-name">
              ${escapeHTML(person.name)}
            </div>

            <div class="person-phone">
              ${escapeHTML(
                person.phone ||
                "بدون رقم"
              )}
            </div>

          </div>

          <div class="person-balance">

            <span class="balance-label">
              الرصيد
            </span>

            <span class="balance-value ${balanceClass}">
              ${money(balance)}
            </span>

          </div>

        </div>

        ${
          person.details
            ? `
              <div class="info-row">
                📝
                ${escapeHTML(person.details)}
              </div>
            `
            : ""
        }

        <div class="card-footer">

          <div class="card-actions">

            <button
              class="btn btn-primary"
              onclick="window.openPerson('${person.id}')"
            >
              فتح
            </button>

            <button
              class="btn btn-success"
              onclick="window.quickPayment('${person.id}')"
            >
              تسديد
            </button>

            <button
              class="btn btn-danger"
              onclick="window.quickPurchase('${person.id}')"
            >
              شراء
            </button>

          </div>

        </div>

      </div>
    `;
  }


  /* =========================================================
     UPDATE TOTALS
     ========================================================= */

  function updateTotals() {
    const peopleCount =
      $("peopleCount");

    const totalDebt =
      $("totalDebt");

    if (peopleCount) {
      peopleCount.textContent =
        state.people.length;
    }

    let total = 0;

    for (const person of state.people) {
      const balance =
        getBalance(person.id);

      if (balance > 0) {
        total += balance;
      }
    }

    if (totalDebt) {
      totalDebt.textContent =
        money(total);
    }
  }


  /* =========================================================
     OPEN PERSON
     ========================================================= */

  async function openPerson(id) {
    const person =
      state.people.find(
        (item) => item.id === id
      );

    if (!person) return;

    state.currentPerson =
      person;

    state.currentPersonId =
      person.id;

    hide($("peopleView"));
    show($("personView"));

    renderPersonDetails();
    renderTransactions();
  }


  function renderPersonDetails() {
    const person =
      state.currentPerson;

    const card =
      $("personCard");

    if (!person || !card) return;

    const balance =
      getBalance(person.id);

    card.innerHTML = `
      <div class="person-card-main">

        <div class="person-avatar">
          ${escapeHTML(
            person.name
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div>

          <h2>
            ${escapeHTML(person.name)}
          </h2>

          <div class="person-card-details">
            📞 ${escapeHTML(
              person.phone ||
              "بدون رقم"
            )}
          </div>

          ${
            person.details
              ? `
                <div class="person-card-details">
                  📝 ${escapeHTML(
                    person.details
                  )}
                </div>
              `
              : ""
          }

        </div>

        <div class="person-card-balance">

          <div class="label">
            إجمالي المستحق
          </div>

          <div class="amount">
            ${money(balance)}
          </div>

        </div>

      </div>
    `;
  }


  /* =========================================================
     TRANSACTIONS
     ========================================================= */

  function renderTransactions() {
    const list =
      $("transactionsList");

    const count =
      $("txnCount");

    if (!list) return;

    const transactions =
      state.transactions.filter(
        (transaction) =>
          transaction.person_id ===
          state.currentPersonId
      );

    if (count) {
      count.textContent =
        transactions.length;
    }

    if (!transactions.length) {
      list.innerHTML = `
        <div class="empty-state">
          <p>لا توجد حركات لهذا الشخص.</p>
        </div>
      `;

      return;
    }

    list.innerHTML =
      transactions
        .map(renderTransaction)
        .join("");
  }


  function renderTransaction(transaction) {
    const purchase =
      transaction.type === "purchase";

    return `
      <div class="transaction-item">

        <div class="transaction-right">

          <div class="transaction-icon ${
            purchase
              ? "purchase"
              : "payment"
          }">
            ${purchase ? "🛒" : "💰"}
          </div>

          <div>

            <div class="transaction-type">
              ${
                purchase
                  ? "شراء"
                  : "تسديد"
              }
            </div>

            <div class="transaction-date">
              ${formatDateTime(
                transaction.date ||
                transaction.created_at
              )}
            </div>

            ${
              transaction.details
                ? `
                  <div class="transaction-details">
                    ${escapeHTML(
                      transaction.details
                    )}
                  </div>
                `
                : ""
            }

          </div>

        </div>

        <div class="transaction-amount ${
          purchase
            ? "purchase"
            : "payment"
        }">

          ${
            purchase
              ? "+"
              : "-"
          }

          ${money(
            transaction.amount
          )}

        </div>

      </div>
    `;
  }


  /* =========================================================
     ADD PERSON
     ========================================================= */

  function openAddPersonModal() {
    openModal(
      "إضافة شخص",
      `
      <form id="personForm">

        <div class="form-group">
          <label>اسم الشخص</label>

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
          <label>تفاصيل</label>

          <textarea
            id="personDetails"
            placeholder="ملاحظات..."
          ></textarea>
        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn btn-ghost"
            onclick="window.closeModal()"
          >
            إلغاء
          </button>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ
          </button>

        </div>

      </form>
      `
    );

    $("personForm")?.addEventListener(
      "submit",
      savePerson
    );
  }


  /* =========================================================
     SAVE PERSON
     ========================================================= */

  async function savePerson(event) {
    event.preventDefault();

    const name =
      $("personName")?.value.trim();

    const phone =
      $("personPhone")?.value.trim() || "";

    const details =
      $("personDetails")?.value.trim() || "";

    if (!name) {
      alert("اكتب اسم الشخص.");
      return;
    }

    const { error } =
      await supabaseClient
        .from("people")
        .insert({
          office_id:
            state.currentOfficeId,

          name,
          phone,
          details
        });

    if (error) {
      console.error(
        "Save person:",
        error
      );

      alert(
        "تعذر حفظ الشخص:\n" +
        error.message
      );

      return;
    }

    closeModal();

    await loadPeople();

    renderPeople();

    updateTotals();

    alert("تم حفظ الشخص.");
  }


  /* =========================================================
     EDIT PERSON
     ========================================================= */

  function editPerson() {
    const person =
      state.currentPerson;

    if (!person) return;

    openModal(
      "تعديل بيانات الشخص",
      `
      <form id="editPersonForm">

        <div class="form-group">
          <label>الاسم</label>

          <input
            type="text"
            id="editPersonName"
            value="${escapeHTML(
              person.name
            )}"
            required
          >
        </div>

        <div class="form-group">
          <label>رقم الهاتف</label>

          <input
            type="text"
            id="editPersonPhone"
            value="${escapeHTML(
              person.phone || ""
            )}"
          >
        </div>

        <div class="form-group">
          <label>تفاصيل</label>

          <textarea id="editPersonDetails">${escapeHTML(
            person.details || ""
          )}</textarea>
        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn btn-ghost"
            onclick="window.closeModal()"
          >
            إلغاء
          </button>

          <button
            type="submit"
            class="btn btn-primary"
          >
            حفظ
          </button>

        </div>

      </form>
      `
    );

    $("editPersonForm")?.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const updates = {
          name:
            $("editPersonName")
              .value
              .trim(),

          phone:
            $("editPersonPhone")
              .value
              .trim(),

          details:
            $("editPersonDetails")
              .value
              .trim(),

          updated_at:
            new Date().toISOString()
        };

        const { error } =
          await supabaseClient
            .from("people")
            .update(updates)
            .eq(
              "id",
              person.id
            );

        if (error) {
          console.error(
            "Update person:",
            error
          );

          alert(
            "تعذر تعديل الشخص:\n" +
            error.message
          );

          return;
        }

        closeModal();

        await loadPeople();

        state.currentPerson =
          state.people.find(
            (item) =>
              item.id === person.id
          );

        renderPersonDetails();
        renderPeople();

        alert("تم تعديل البيانات.");
      }
    );
  }


  /* =========================================================
     TRANSACTION MODAL
     ========================================================= */

  function openTransactionModal(
    personId,
    type
  ) {
    const person =
      state.people.find(
        (item) => item.id === personId
      );

    if (!person) return;

    const title =
      type === "purchase"
        ? "إضافة شراء"
        : "إضافة تسديد";

    openModal(
      title,
      `
      <form id="transactionForm">

        <div class="form-group">

          <label>
            الشخص
          </label>

          <input
            type="text"
            value="${escapeHTML(
              person.name
            )}"
            disabled
          >

        </div>

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
            placeholder="مثال: مواد غذائية..."
          ></textarea>

        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn btn-ghost"
            onclick="window.closeModal()"
          >
            إلغاء
          </button>

          <button
            type="submit"
            class="btn ${
              type === "purchase"
                ? "btn-danger"
                : "btn-success"
            }"
          >
            ${
              type === "purchase"
                ? "حفظ الشراء"
                : "حفظ التسديد"
            }
          </button>

        </div>

      </form>
      `
    );

    $("transactionForm")?.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        await saveTransaction(
          event,
          personId,
          type
        );
      }
    );
  }


  /* =========================================================
     SAVE TRANSACTION
     ========================================================= */

  async function saveTransaction(
    event,
    personId,
    type
  ) {
    const amount =
      Number(
        $("transactionAmount")
          ?.value
      );

    const details =
      $("transactionDetails")
        ?.value
        .trim() || "";

    if (!amount || amount <= 0) {
      alert("اكتب مبلغ صحيح.");
      return;
    }

    const { error } =
      await supabaseClient
        .from("transactions")
        .insert({
          office_id:
            state.currentOfficeId,

          person_id:
            personId,

          type,

          amount,

          details,

          date:
            new Date().toISOString()
        });

    if (error) {
      console.error(
        "Save transaction:",
        error
      );

      alert(
        "تعذر حفظ الحركة:\n" +
        error.message
      );

      return;
    }

    closeModal();

    await loadTransactions();

    renderTransactions();

    renderPersonDetails();

    renderPeople();

    updateTotals();

    alert(
      type === "purchase"
        ? "تم تسجيل الشراء."
        : "تم تسجيل التسديد."
    );
  }


  /* =========================================================
     BACK TO PEOPLE
     ========================================================= */

  function backToPeople() {
    state.currentPerson = null;
    state.currentPersonId = null;

    show($("peopleView"));
    hide($("personView"));

    renderPeople();
  }


  /* =========================================================
     BACK TO ADMIN
     ========================================================= */

  async function backToAdmin() {
    state.currentOffice = null;
    state.currentOfficeId = null;

    state.people = [];
    state.transactions = [];

    showAdminView();

    await loadOffices();
  }


  /* =========================================================
     EXPORT
     ========================================================= */

  function exportData() {
    const data = {
      app: "دفتر الديون",
      version: 1,

      exported_at:
        new Date().toISOString(),

      office:
        state.currentOffice,

      people:
        state.people,

      transactions:
        state.transactions
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
            "application/json;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `دفتر-الديون-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  }


  /* =========================================================
     IMPORT
     ========================================================= */

  function importData() {
    $("importFile")?.click();
  }

  async function handleImport(event) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      const text =
        await file.text();

      const data =
        JSON.parse(text);

      if (
        !data ||
        !Array.isArray(data.people) ||
        !Array.isArray(data.transactions)
      ) {
        throw new Error(
          "ملف النسخة غير صحيح."
        );
      }

      const confirmed =
        confirm(
          "هل تريد استيراد هذه النسخة إلى Supabase؟"
        );

      if (!confirmed) return;

      /*
        الأشخاص:
        نعيد إدخالهم للمكتب الحالي.
      */

      const people =
        data.people.map(
          (person) => ({
            office_id:
              state.currentOfficeId,

            name:
              person.name,

            phone:
              person.phone || "",

            details:
              person.details || ""
          })
        );

      /*
        نحتاج map حتى نربط
        معاملات الأشخاص القديمة
        بالأشخاص الجدد.
      */

      const oldToNew =
        new Map();

      for (
        const oldPerson
        of data.people
      ) {
        const { data: insertedPerson, error } =
          await supabaseClient
            .from("people")
            .insert({
              office_id:
                state.currentOfficeId,

              name:
                oldPerson.name,

              phone:
                oldPerson.phone || "",

              details:
                oldPerson.details || ""
            })
            .select()
            .single();

        if (error) {
          throw error;
        }

        oldToNew.set(
          oldPerson.id,
          insertedPerson.id
        );
      }

      const transactions =
        data.transactions
          .map((transaction) => {
            const newPersonId =
              oldToNew.get(
                transaction.person_id
              );

            if (!newPersonId) {
              return null;
            }

            return {
              office_id:
                state.currentOfficeId,

              person_id:
                newPersonId,

              type:
                transaction.type,

              amount:
                Number(
                  transaction.amount
                ),

              details:
                transaction.details ||
                "",

              date:
                transaction.date ||
                new Date().toISOString()
            };
          })
          .filter(Boolean);

      if (transactions.length) {
        const { error } =
          await supabaseClient
            .from("transactions")
            .insert(
              transactions
            );

        if (error) {
          throw error;
        }
      }

      await loadOfficeData();

      alert(
        "تم استيراد النسخة بنجاح."
      );

    } catch (error) {
      console.error(
        "Import:",
        error
      );

      alert(
        "فشل الاستيراد:\n" +
        error.message
      );

    } finally {
      event.target.value = "";
    }
  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function setupEvents() {

    $("loginForm")?.addEventListener(
      "submit",
      handleLogin
    );

    $("logoutBtn")?.addEventListener(
      "click",
      logout
    );

    $("adminLogoutBtn")?.addEventListener(
      "click",
      logout
    );

    $("addOfficeBtn")?.addEventListener(
      "click",
      openAddOfficeModal
    );

    $("addPersonBtn")?.addEventListener(
      "click",
      openAddPersonModal
    );

    $("modalClose")?.addEventListener(
      "click",
      closeModal
    );

    $("backBtn")?.addEventListener(
      "click",
      backToPeople
    );

    $("backToAdminBtn")?.addEventListener(
      "click",
      backToAdmin
    );

    $("editPersonBtn")?.addEventListener(
      "click",
      editPerson
    );

    $("payBtn")?.addEventListener(
      "click",
      function () {
        if (
          state.currentPersonId
        ) {
          openTransactionModal(
            state.currentPersonId,
            "payment"
          );
        }
      }
    );

    $("purchaseBtn")?.addEventListener(
      "click",
      function () {
        if (
          state.currentPersonId
        ) {
          openTransactionModal(
            state.currentPersonId,
            "purchase"
          );
        }
      }
    );

    $("exportBtn")?.addEventListener(
      "click",
      exportData
    );

    $("importBtn")?.addEventListener(
      "click",
      importData
    );

    $("importFile")?.addEventListener(
      "change",
      handleImport
    );

    $("searchInput")?.addEventListener(
      "input",
      renderPeople
    );

    $("officeSearch")?.addEventListener(
      "input",
      renderOffices
    );

    $("modal")?.addEventListener(
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
  }


  /* =========================================================
     QUICK ACTIONS
     ========================================================= */

  window.openPerson =
    openPerson;

  window.quickPayment =
    function (id) {
      openTransactionModal(
        id,
        "payment"
      );
    };

  window.quickPurchase =
    function (id) {
      openTransactionModal(
        id,
        "purchase"
      );
    };

  window.openOffice =
    openOffice;

  window.editOffice =
    editOffice;

  window.deleteOffice =
    deleteOffice;

  window.closeModal =
    closeModal;


  /* =========================================================
     SUPABASE AUTH STATE
     ========================================================= */

  async function checkExistingSession() {
    if (!supabaseClient) {
      showLoginView();
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

      if (
        data &&
        data.session &&
        data.session.user
      ) {
        /*
          إذا توجد جلسة Auth:
          نعتبره أدمن.
        */

        state.role = "admin";

        showAdminView();

        await loadOffices();

        return;
      }

    } catch (error) {
      console.error(
        "Session:",
        error
      );
    }

    showLoginView();
  }


  /* =========================================================
     AUTH LISTENER
     ========================================================= */

  function setupAuthListener() {
    if (!supabaseClient) return;

    /*
      مهم:
      لا ننشئ Supabase Client هنا.
      نستخدم نفس client فقط.
    */

    supabaseClient.auth.onAuthStateChange(
      function (event, session) {

        console.log(
          "Supabase Auth:",
          event
        );

        if (
          event === "SIGNED_OUT"
        ) {
          state.role = null;
          showLoginView();
        }
      }
    );
  }


  /* =========================================================
     INIT
     ========================================================= */

  async function init() {

    setupEvents();

    await checkConnection();

    setupAuthListener();

    await checkExistingSession();
  }


  /* =========================================================
     START
     ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();