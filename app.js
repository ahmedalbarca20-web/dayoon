(function () {
  "use strict";

  // =========================================================
  // إعداد Supabase
  // =========================================================

  function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");

  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    loadingScreen.style.display = "none";
  }
}

// إخفاء شاشة التحميل مباشرة
hideLoadingScreen();
  
  
  
  
  const CONFIG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = CONFIG.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  function isSupabaseReady() {
    return (
      window.supabase &&
      typeof window.supabase.createClient === "function" &&
      SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes("YOUR-") &&
      !SUPABASE_ANON_KEY.includes("YOUR-")
    );
  }

  if (isSupabaseReady()) {
    try {
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
    } catch (error) {
      console.error("Supabase createClient error:", error);
    }
  } else {
    console.error("Supabase configuration is missing.");
  }

  // =========================================================
  // حالة التطبيق
  // =========================================================

  const state = {
    role: null, // admin | office

    session: null,

    currentOffice: null,
    currentPerson: null,

    offices: [],
    people: [],
    transactions: [],

    search: "",

    loading: false
  };

  // =========================================================
  // Helpers
  // =========================================================

  const $ = (id) => document.getElementById(id);

  function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
  }

  function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
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

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function notify(message, type = "success") {
    let box = $("appNotification");

    if (!box) {
      box = document.createElement("div");
      box.id = "appNotification";

      box.style.position = "fixed";
      box.style.top = "20px";
      box.style.left = "20px";
      box.style.right = "20px";
      box.style.maxWidth = "500px";
      box.style.margin = "auto";
      box.style.zIndex = "99999";
      box.style.padding = "15px 18px";
      box.style.borderRadius = "12px";
      box.style.color = "#fff";
      box.style.fontWeight = "700";
      box.style.textAlign = "center";
      box.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";

      document.body.appendChild(box);
    }

    box.textContent = message;

    box.style.background =
      type === "error"
        ? "#dc2626"
        : type === "warning"
        ? "#d97706"
        : "#16a34a";

    box.style.display = "block";

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
      box.style.display = "none";
    }, 3500);
  }

  function setLoading(loading) {
    state.loading = loading;

    const btn = $("loginBtn");

    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? "جارٍ الدخول..." : "دخول";
    }
  }

  // =========================================================
  // الصفحات
  // =========================================================

  function showLogin() {
    show($("loginView"));
    hide($("adminView"));
    hide($("appView"));

    setLoading(false);
  }

  function showAdmin() {
    hide($("loginView"));
    show($("adminView"));
    hide($("appView"));
  }

  function showApp() {
    hide($("loginView"));
    hide($("adminView"));
    show($("appView"));
  }

  // =========================================================
  // اتصال Supabase
  // =========================================================

  function updateConnectionStatus() {
    const dot = $("connDot");
    const text = $("connText");

    if (!dot || !text) return;

    if (supabaseClient) {
      dot.style.background = "#22c55e";
      text.textContent = "متصل بـ Supabase";
    } else {
      dot.style.background = "#ef4444";
      text.textContent = "Supabase غير متصل";
    }
  }

  // =========================================================
  // Login Message
  // =========================================================

  function showLoginMessage(message, type = "error") {
    const box = $("loginMessage");

    if (!box) {
      notify(message, type);
      return;
    }

    box.textContent = message;
    box.classList.remove("hidden");

    box.style.color = type === "error" ? "#dc2626" : "#16a34a";
  }

  // =========================================================
  // تشغيل التطبيق
  // =========================================================

  async function init() {
    console.log("Starting Debt Book...");

    updateConnectionStatus();

    // إظهار الدخول مباشرة حتى لا تبقى الصفحة معلقة
    showLogin();

    if (!supabaseClient) {
      showLoginMessage(
        "تعذر الاتصال بـ Supabase. تأكد من supabase-config.js",
        "error"
      );

      return;
    }

    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) {
        console.error("getSession:", error);
        return;
      }

      state.session = data.session || null;

      if (state.session) {
        console.log("Existing Supabase session");

        state.role = "admin";

        showAdmin();

        await loadOffices();
      }
    } catch (error) {
      console.error("Init error:", error);
      showLogin();
    }
  }

  // =========================================================
  // مراقبة Auth
  // =========================================================

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log("Supabase Auth:", event);

      state.session = session || null;

      if (event === "SIGNED_OUT") {
        state.role = null;
        state.currentOffice = null;

        showLogin();
      }
    });
  }

  // =========================================================
  // تسجيل الدخول
  // =========================================================

  async function handleLogin(event) {
    event.preventDefault();

    if (state.loading) return;

    if (!supabaseClient) {
      showLoginMessage(
        "Supabase غير متصل. تأكد من إعداد supabase-config.js",
        "error"
      );

      return;
    }

    const emailOrUsername =
      $("loginEmail")?.value.trim() || "";

    const password =
      $("loginPassword")?.value || "";

    if (!emailOrUsername || !password) {
      showLoginMessage(
        "اكتب اسم المستخدم وكلمة المرور",
        "error"
      );

      return;
    }

    setLoading(true);

    showLoginMessage("", "success");

    // -------------------------------------------------------
    // أولاً: تجربة Supabase Auth للأدمن
    // -------------------------------------------------------

    try {
      let email = emailOrUsername;

      // إذا كتب المستخدم اسم admin وليس إيميل
      // نحاول استخدام الإيميل الموجود في Auth
      if (!email.includes("@")) {
        email = emailOrUsername;
      }

      if (email.includes("@")) {
        const { data, error } =
          await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

        if (!error && data?.session) {
          state.session = data.session;
          state.role = "admin";

          showAdmin();

          await loadOffices();

          setLoading(false);

          return;
        }

        console.warn(
          "Auth login failed:",
          error?.message
        );
      }
    } catch (error) {
      console.warn("Auth login error:", error);
    }

    // -------------------------------------------------------
    // ثانياً: تسجيل دخول المكتب
    // -------------------------------------------------------

    try {
      const { data, error } =
        await supabaseClient
          .from("offices")
          .select("*")
          .eq("username", emailOrUsername)
          .eq("password", password)
          .eq("active", true)
          .maybeSingle();

      if (error) {
        console.error("Office login:", error);

        showLoginMessage(
          "تعذر تسجيل دخول المكتب: " +
            (error.message || "خطأ غير معروف"),
          "error"
        );

        setLoading(false);

        return;
      }

      if (data) {
        state.role = "office";
        state.currentOffice = data;

        showApp();

        await loadOfficeData();

        setLoading(false);

        return;
      }

      showLoginMessage(
        "بيانات الدخول غير صحيحة",
        "error"
      );

      setLoading(false);
    } catch (error) {
      console.error("Office login exception:", error);

      showLoginMessage(
        "حدث خطأ أثناء تسجيل الدخول",
        "error"
      );

      setLoading(false);
    }
  }

  // =========================================================
  // Logout
  // =========================================================

  async function logout() {
    try {
      if (state.role === "admin" && supabaseClient) {
        await supabaseClient.auth.signOut();
      }
    } catch (error) {
      console.error("Logout:", error);
    }

    state.role = null;
    state.session = null;
    state.currentOffice = null;
    state.currentPerson = null;
    state.offices = [];
    state.people = [];
    state.transactions = [];

    showLogin();

    if ($("loginPassword")) {
      $("loginPassword").value = "";
    }
  }

  // =========================================================
  // المكاتب
  // =========================================================

  async function loadOffices() {
    if (!supabaseClient) return;

    try {
      const { data, error } =
        await supabaseClient
          .from("offices")
          .select("*")
          .order("created_at", {
            ascending: false
          });

      if (error) {
        console.error("Load offices:", error);

        notify(
          "تعذر تحميل المكاتب: " +
            error.message,
          "error"
        );

        return;
      }

      state.offices = data || [];

      renderOffices();
    } catch (error) {
      console.error(error);
    }
  }

  function renderOffices() {
    const list = $("officesList");
    const empty = $("officesEmpty");

    if (!list) return;

    const query =
      $("officeSearch")?.value
        .trim()
        .toLowerCase() || "";

    const offices = state.offices.filter((office) => {
      return (
        !query ||
        String(office.name || "")
          .toLowerCase()
          .includes(query) ||
        String(office.username || "")
          .toLowerCase()
          .includes(query) ||
        String(office.phone || "")
          .toLowerCase()
          .includes(query)
      );
    });

    setText(
      "officesCount",
      state.offices.length
    );

    if (!offices.length) {
      list.innerHTML = "";

      if (empty) show(empty);

      return;
    }

    if (empty) hide(empty);

    list.innerHTML = offices
      .map((office) => {
        const active =
          office.active !== false;

        return `
          <div class="person-item office-item">

            <div class="person-main">

              <div class="person-avatar">
                🏢
              </div>

              <div class="person-info">

                <h3>
                  ${escapeHTML(
                    office.name
                  )}
                </h3>

                <p>
                  المستخدم:
                  ${escapeHTML(
                    office.username
                  )}
                </p>

                <p>
                  الهاتف:
                  ${escapeHTML(
                    office.phone || "-"
                  )}
                </p>

                ${
                  office.contract_start ||
                  office.contract_end
                    ? `
                      <p>
                        مدة العقد:
                        ${formatDate(
                          office.contract_start
                        )}
                        -
                        ${formatDate(
                          office.contract_end
                        )}
                      </p>
                    `
                    : ""
                }

              </div>

            </div>

            <div class="person-actions">

              <span class="status-badge ${
                active
                  ? "status-active"
                  : "status-inactive"
              }">
                ${active ? "فعال" : "متوقف"}
              </span>

              <button
                class="btn btn-edit"
                data-edit-office="${office.id}">
                تعديل
              </button>

              <button
                class="btn btn-danger"
                data-delete-office="${office.id}">
                حذف
              </button>

            </div>

          </div>
        `;
      })
      .join("");
  }

  // =========================================================
  // إضافة / تعديل مكتب
  // =========================================================

  function openOfficeModal(office = null) {
    const title = office
      ? "تعديل المكتب"
      : "إضافة مكتب";

    const body = `
      <form id="officeForm">

        <div class="form-group">
          <label>اسم المكتب</label>
          <input
            id="officeName"
            required
            value="${escapeHTML(
              office?.name || ""
            )}">
        </div>

        <div class="form-group">
          <label>اسم المستخدم</label>
          <input
            id="officeUsername"
            required
            value="${escapeHTML(
              office?.username || ""
            )}">
        </div>

        <div class="form-group">
          <label>
            كلمة المرور
            ${
              office
                ? "(اتركها فارغة للإبقاء على القديمة)"
                : ""
            }
          </label>

          <input
            type="password"
            id="officePassword"
            ${
              office
                ? ""
                : "required"
            }>
        </div>

        <div class="form-group">
          <label>رقم الهاتف</label>
          <input
            id="officePhone"
            value="${escapeHTML(
              office?.phone || ""
            )}">
        </div>

        <div class="form-group">
          <label>التفاصيل</label>
          <textarea
            id="officeDetails">${escapeHTML(
              office?.details || ""
            )}</textarea>
        </div>

        <div class="form-group">
          <label>بداية العقد</label>
          <input
            type="date"
            id="contractStart"
            value="${
              office?.contract_start || ""
            }">
        </div>

        <div class="form-group">
          <label>نهاية العقد</label>
          <input
            type="date"
            id="contractEnd"
            value="${
              office?.contract_end || ""
            }">
        </div>

        <div class="form-group">
          <label>
            <input
              type="checkbox"
              id="officeActive"
              ${
                office?.active !== false
                  ? "checked"
                  : ""
              }>
            المكتب فعال
          </label>
        </div>

        <button
          type="submit"
          class="btn btn-primary">
          حفظ المكتب
        </button>

      </form>
    `;

    openModal(title, body);

    $("officeForm")?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await saveOffice(
          office?.id || null
        );
      }
    );
  }

  async function saveOffice(officeId) {
    const name =
      $("officeName")?.value.trim() || "";

    const username =
      $("officeUsername")?.value.trim() || "";

    const password =
      $("officePassword")?.value || "";

    const phone =
      $("officePhone")?.value.trim() || "";

    const details =
      $("officeDetails")?.value.trim() || "";

    const contract_start =
      $("contractStart")?.value || null;

    const contract_end =
      $("contractEnd")?.value || null;

    const active =
      $("officeActive")?.checked ?? true;

    if (!name || !username) {
      notify(
        "اسم المكتب واسم المستخدم مطلوبان",
        "error"
      );

      return;
    }

    try {
      if (officeId) {
        const oldOffice =
          state.offices.find(
            (x) => x.id === officeId
          );

        const updateData = {
          name,
          username,
          phone,
          details,
          contract_start,
          contract_end,
          active
        };

        if (password) {
          updateData.password = password;
        }

        const { error } =
          await supabaseClient
            .from("offices")
            .update(updateData)
            .eq("id", officeId);

        if (error) {
          console.error(
            "Save office:",
            error
          );

          notify(
            "فشل تعديل المكتب: " +
              error.message,
            "error"
          );

          return;
        }
      } else {
        if (!password) {
          notify(
            "كلمة المرور مطلوبة",
            "error"
          );

          return;
        }

        const { error } =
          await supabaseClient
            .from("offices")
            .insert({
              name,
              username,
              password,
              phone,
              details,
              active,
              contract_start,
              contract_end
            });

        if (error) {
          console.error(
            "Create office:",
            error
          );

          notify(
            "فشل إنشاء المكتب: " +
              error.message,
            "error"
          );

          return;
        }
      }

      closeModal();

      notify("تم حفظ المكتب بنجاح");

      await loadOffices();
    } catch (error) {
      console.error(error);

      notify(
        "حدث خطأ أثناء حفظ المكتب",
        "error"
      );
    }
  }

  async function deleteOffice(id) {
    const office =
      state.offices.find(
        (x) => x.id === id
      );

    if (!office) return;

    if (
      !confirm(
        `هل أنت متأكد من حذف مكتب "${office.name}"؟\nسيتم حذف الأشخاص والحركات المرتبطة به.`
      )
    ) {
      return;
    }

    try {
      const { error } =
        await supabaseClient
          .from("offices")
          .delete()
          .eq("id", id);

      if (error) {
        notify(
          "فشل حذف المكتب: " +
            error.message,
          "error"
        );

        return;
      }

      notify("تم حذف المكتب");

      await loadOffices();
    } catch (error) {
      console.error(error);
    }
  }

  // =========================================================
  // بيانات المكتب
  // =========================================================

  async function loadOfficeData() {
    if (!state.currentOffice) return;

    const officeId =
      state.currentOffice.id;

    try {
      const [
        peopleResult,
        transactionsResult
      ] = await Promise.all([
        supabaseClient
          .from("people")
          .select("*")
          .eq("office_id", officeId)
          .order("created_at", {
            ascending: false
          }),

        supabaseClient
          .from("transactions")
          .select("*")
          .eq("office_id", officeId)
          .order("date", {
            ascending: false
          })
      ]);

      if (peopleResult.error) {
        console.error(
          "Load people:",
          peopleResult.error
        );

        notify(
          "فشل تحميل الأشخاص: " +
            peopleResult.error.message,
          "error"
        );

        return;
      }

      if (transactionsResult.error) {
        console.error(
          "Load transactions:",
          transactionsResult.error
        );

        notify(
          "فشل تحميل الحركات: " +
            transactionsResult.error.message,
          "error"
        );

        return;
      }

      state.people =
        peopleResult.data || [];

      state.transactions =
        transactionsResult.data || [];

      updateOfficeHeader();

      renderPeople();
    } catch (error) {
      console.error(
        "loadOfficeData:",
        error
      );

      notify(
        "حدث خطأ أثناء تحميل بيانات المكتب",
        "error"
      );
    }
  }

  function updateOfficeHeader() {
    const office =
      state.currentOffice;

    if (!office) return;

    setText(
      "appTitle",
      office.name || "دفتر الديون"
    );

    setText(
      "appSubtitle",
      office.details ||
        "إدارة الديون بسهولة"
    );

    setText(
      "peopleCount",
      state.people.length
    );

    const total = calculateOfficeDebt();

    setText(
      "totalDebt",
      money(total)
    );

    const banner =
      $("contractBanner");

    if (!banner) return;

    if (
      office.contract_start ||
      office.contract_end
    ) {
      banner.innerHTML = `
        <strong>مدة العقد:</strong>
        ${formatDate(
          office.contract_start
        )}
        إلى
        ${formatDate(
          office.contract_end
        )}
      `;

      show(banner);
    } else {
      hide(banner);
    }
  }

  function calculateOfficeDebt() {
    let total = 0;

    state.transactions.forEach(
      (txn) => {
        const amount =
          Number(txn.amount) || 0;

        if (txn.type === "purchase") {
          total += amount;
        } else if (
          txn.type === "payment"
        ) {
          total -= amount;
        }
      }
    );

    return total;
  }

  // =========================================================
  // الأشخاص
  // =========================================================

  function renderPeople() {
    const list = $("peopleList");
    const empty = $("emptyState");

    if (!list) return;

    const query =
      $("searchInput")?.value
        .trim()
        .toLowerCase() || "";

    const people =
      state.people.filter((person) => {
        return (
          !query ||
          String(person.name || "")
            .toLowerCase()
            .includes(query) ||
          String(person.phone || "")
            .toLowerCase()
            .includes(query)
        );
      });

    setText(
      "peopleCount",
      state.people.length
    );

    if (!people.length) {
      list.innerHTML = "";

      if (empty) show(empty);

      return;
    }

    if (empty) hide(empty);

    list.innerHTML = people
      .map((person) => {
        const debt =
          calculatePersonDebt(
            person.id
          );

        const debtClass =
          debt > 0
            ? "debt-positive"
            : debt < 0
            ? "debt-negative"
            : "debt-zero";

        return `
          <div
            class="person-item"
            data-person="${person.id}">

            <div class="person-main">

              <div class="person-avatar">
                👤
              </div>

              <div class="person-info">

                <h3>
                  ${escapeHTML(
                    person.name
                  )}
                </h3>

                <p>
                  ${escapeHTML(
                    person.phone || "بدون هاتف"
                  )}
                </p>

              </div>

            </div>

            <div class="person-balance">

              <span class="${debtClass}">
                ${money(Math.abs(debt))}
              </span>

              <small>
                ${
                  debt > 0
                    ? "عليه"
                    : debt < 0
                    ? "له"
                    : "متسدد"
                }
              </small>

            </div>

          </div>
        `;
      })
      .join("");
  }

  function calculatePersonDebt(personId) {
    let total = 0;

    state.transactions
      .filter(
        (txn) =>
          txn.person_id === personId
      )
      .forEach((txn) => {
        const amount =
          Number(txn.amount) || 0;

        if (txn.type === "purchase") {
          total += amount;
        } else if (
          txn.type === "payment"
        ) {
          total -= amount;
        }
      });

    return total;
  }

  // =========================================================
  // فتح الشخص
  // =========================================================

  async function openPerson(personId) {
    const person =
      state.people.find(
        (x) => x.id === personId
      );

    if (!person) return;

    state.currentPerson = person;

    show($("personView"));
    hide($("peopleView"));

    renderPerson();
  }

  function renderPerson() {
    const person =
      state.currentPerson;

    if (!person) return;

    const debt =
      calculatePersonDebt(person.id);

    const personCard =
      $("personCard");

    if (personCard) {
      personCard.innerHTML = `
        <div class="person-card-inner">

          <div class="person-avatar large">
            👤
          </div>

          <div>
            <h2>
              ${escapeHTML(
                person.name
              )}
            </h2>

            <p>
              الهاتف:
              ${escapeHTML(
                person.phone || "-"
              )}
            </p>

            <p>
              التفاصيل:
              ${escapeHTML(
                person.details || "-"
              )}
            </p>

          </div>

          <div class="person-card-debt">

            <span>
              الرصيد الحالي
            </span>

            <strong>
              ${money(Math.abs(debt))}
            </strong>

            <small>
              ${
                debt > 0
                  ? "عليه"
                  : debt < 0
                  ? "له"
                  : "لا يوجد دين"
              }
            </small>

          </div>

        </div>
      `;
    }

    const transactions =
      state.transactions
        .filter(
          (txn) =>
            txn.person_id === person.id
        )
        .sort(
          (a, b) =>
            new Date(b.date) -
            new Date(a.date)
        );

    setText(
      "txnCount",
      transactions.length
    );

    renderTransactions(
      transactions
    );
  }

  function renderTransactions(
    transactions
  ) {
    const list =
      $("transactionsList");

    if (!list) return;

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
        .map((txn) => {
          const purchase =
            txn.type === "purchase";

          return `
            <div class="transaction-item">

              <div class="transaction-icon ${
                purchase
                  ? "transaction-purchase"
                  : "transaction-payment"
              }">
                ${
                  purchase
                    ? "🛒"
                    : "💵"
                }
              </div>

              <div class="transaction-info">

                <strong>
                  ${
                    purchase
                      ? "شراء"
                      : "تسديد"
                  }
                </strong>

                <span>
                  ${formatDateTime(
                    txn.date
                  )}
                </span>

                ${
                  txn.details
                    ? `
                      <small>
                        ${escapeHTML(
                          txn.details
                        )}
                      </small>
                    `
                    : ""
                }

              </div>

              <div class="transaction-amount ${
                purchase
                  ? "amount-purchase"
                  : "amount-payment"
              }">
                ${
                  purchase
                    ? "+"
                    : "-"
                }
                ${money(txn.amount)}
              </div>

              <button
                class="btn btn-danger transaction-delete"
                data-delete-txn="${txn.id}">
                حذف
              </button>

            </div>
          `;
        })
        .join("");
  }

  // =========================================================
  // إضافة شخص
  // =========================================================

  function openPersonModal(
    person = null
  ) {
    const title = person
      ? "تعديل بيانات الشخص"
      : "إضافة شخص";

    const body = `
      <form id="personForm">

        <div class="form-group">
          <label>الاسم</label>
          <input
            id="personName"
            required
            value="${escapeHTML(
              person?.name || ""
            )}">
        </div>

        <div class="form-group">
          <label>رقم الهاتف</label>
          <input
            id="personPhone"
            value="${escapeHTML(
              person?.phone || ""
            )}">
        </div>

        <div class="form-group">
          <label>التفاصيل</label>
          <textarea
            id="personDetails">${escapeHTML(
              person?.details || ""
            )}</textarea>
        </div>

        <button
          type="submit"
          class="btn btn-primary">
          حفظ
        </button>

      </form>
    `;

    openModal(title, body);

    $("personForm")?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await savePerson(
          person?.id || null
        );
      }
    );
  }

  async function savePerson(personId) {
    if (!state.currentOffice) {
      notify(
        "لا يوجد مكتب محدد",
        "error"
      );

      return;
    }

    const name =
      $("personName")?.value.trim() || "";

    const phone =
      $("personPhone")?.value.trim() || "";

    const details =
      $("personDetails")?.value.trim() || "";

    if (!name) {
      notify(
        "اسم الشخص مطلوب",
        "error"
      );

      return;
    }

    try {
      if (personId) {
        const { error } =
          await supabaseClient
            .from("people")
            .update({
              name,
              phone,
              details,
              updated_at:
                new Date().toISOString()
            })
            .eq("id", personId)
            .eq(
              "office_id",
              state.currentOffice.id
            );

        if (error) {
          console.error(
            "Update person:",
            error
          );

          notify(
            "فشل تعديل الشخص: " +
              error.message,
            "error"
          );

          return;
        }
      } else {
        const { error } =
          await supabaseClient
            .from("people")
            .insert({
              office_id:
                state.currentOffice.id,
              name,
              phone,
              details
            });

        if (error) {
          console.error(
            "Create person:",
            error
          );

          notify(
            "فشل إضافة الشخص: " +
              error.message,
            "error"
          );

          return;
        }
      }

      closeModal();

      notify(
        "تم حفظ بيانات الشخص"
      );

      await loadOfficeData();
    } catch (error) {
      console.error(error);

      notify(
        "حدث خطأ أثناء حفظ الشخص",
        "error"
      );
    }
  }

  async function deletePerson(personId) {
    const person =
      state.people.find(
        (x) => x.id === personId
      );

    if (!person) return;

    if (
      !confirm(
        `هل تريد حذف "${person.name}"؟\nسيتم حذف جميع حركاته أيضًا.`
      )
    ) {
      return;
    }

    try {
      const { error } =
        await supabaseClient
          .from("people")
          .delete()
          .eq("id", personId)
          .eq(
            "office_id",
            state.currentOffice.id
          );

      if (error) {
        notify(
          "فشل حذف الشخص: " +
            error.message,
          "error"
        );

        return;
      }

      notify("تم حذف الشخص");

      state.currentPerson = null;

      show($("peopleView"));
      hide($("personView"));

      await loadOfficeData();
    } catch (error) {
      console.error(error);
    }
  }

  // =========================================================
  // حركة شراء / تسديد
  // =========================================================

  function openTransactionModal(
    type
  ) {
    const purchase =
      type === "purchase";

    const title = purchase
      ? "إضافة شراء"
      : "إضافة تسديد";

    const body = `
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
            placeholder="0">

        </div>

        <div class="form-group">

          <label>
            التفاصيل
          </label>

          <textarea
            id="transactionDetails"
            placeholder="تفاصيل الحركة..."></textarea>

        </div>

        <div class="form-group">

          <label>
            التاريخ
          </label>

          <input
            id="transactionDate"
            type="datetime-local"
            value="${getDateTimeLocal()}">

        </div>

        <button
          type="submit"
          class="btn ${
            purchase
              ? "btn-danger"
              : "btn-success"
          }">

          ${
            purchase
              ? "حفظ الشراء"
              : "حفظ التسديد"
          }

        </button>

      </form>
    `;

    openModal(
      title,
      body
    );

    $("transactionForm")?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await saveTransaction(
          type
        );
      }
    );
  }

  function getDateTimeLocal() {
    const date = new Date();

    const pad = (n) =>
      String(n).padStart(2, "0");

    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  }

  async function saveTransaction(type) {
    if (
      !state.currentOffice ||
      !state.currentPerson
    ) {
      notify(
        "حدد الشخص أولاً",
        "error"
      );

      return;
    }

    const amount =
      Number(
        $("transactionAmount")
          ?.value
      );

    const details =
      $("transactionDetails")
        ?.value.trim() || "";

    const dateInput =
      $("transactionDate")
        ?.value;

    if (!amount || amount <= 0) {
      notify(
        "اكتب مبلغًا صحيحًا",
        "error"
      );

      return;
    }

    const date =
      dateInput
        ? new Date(
            dateInput
          ).toISOString()
        : new Date().toISOString();

    try {
      const { error } =
        await supabaseClient
          .from("transactions")
          .insert({
            office_id:
              state.currentOffice.id,

            person_id:
              state.currentPerson.id,

            type,

            amount,

            details,

            date
          });

      if (error) {
        console.error(
          "Save transaction:",
          error
        );

        notify(
          "فشل حفظ الحركة: " +
            error.message,
          "error"
        );

        return;
      }

      closeModal();

      notify(
        type === "purchase"
          ? "تم حفظ الشراء"
          : "تم حفظ التسديد"
      );

      await loadOfficeData();

      // إعادة فتح الشخص بعد التحديث
      const person =
        state.people.find(
          (x) =>
            x.id ===
            state.currentPerson.id
        );

      if (person) {
        state.currentPerson = person;
        renderPerson();
      }
    } catch (error) {
      console.error(error);

      notify(
        "حدث خطأ أثناء حفظ الحركة",
        "error"
      );
    }
  }

  // =========================================================
  // حذف حركة
  // =========================================================

  async function deleteTransaction(
    transactionId
  ) {
    if (
      !confirm(
        "هل تريد حذف هذه الحركة؟"
      )
    ) {
      return;
    }

    try {
      const { error } =
        await supabaseClient
          .from("transactions")
          .delete()
          .eq(
            "id",
            transactionId
          )
          .eq(
            "office_id",
            state.currentOffice.id
          );

      if (error) {
        notify(
          "فشل حذف الحركة: " +
            error.message,
          "error"
        );

        return;
      }

      notify("تم حذف الحركة");

      await loadOfficeData();

      if (state.currentPerson) {
        renderPerson();
      }
    } catch (error) {
      console.error(error);
    }
  }

  // =========================================================
  // Modal
  // =========================================================

  function openModal(
    title,
    body
  ) {
    setText(
      "modalTitle",
      title
    );

    const modalBody =
      $("modalBody");

    if (modalBody) {
      modalBody.innerHTML = body;
    }

    show($("modal"));
  }

  function closeModal() {
    hide($("modal"));

    const body =
      $("modalBody");

    if (body) {
      body.innerHTML = "";
    }
  }

  // =========================================================
  // تصدير البيانات
  // =========================================================

  function exportData() {
    if (!state.currentOffice) {
      notify(
        "لا يوجد مكتب",
        "error"
      );

      return;
    }

    const backup = {
      version: 1,

      exported_at:
        new Date().toISOString(),

      office: state.currentOffice,

      people: state.people,

      transactions:
        state.transactions
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
      document.createElement("a");

    a.href = url;

    a.download =
      "debt-book-backup-" +
      new Date()
        .toISOString()
        .slice(0, 10) +
      ".json";

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  }

  // =========================================================
  // استيراد البيانات
  // =========================================================

  async function importData(file) {
    if (!file) return;

    if (!state.currentOffice) {
      notify(
        "لا يوجد مكتب",
        "error"
      );

      return;
    }

    try {
      const text =
        await file.text();

      const backup =
        JSON.parse(text);

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
          "ملف النسخة الاحتياطية غير صحيح"
        );
      }

      if (
        !confirm(
          "سيتم استيراد البيانات إلى المكتب الحالي. هل تريد المتابعة؟"
        )
      ) {
        return;
      }

      const officeId =
        state.currentOffice.id;

      // الأشخاص
      const peopleMap =
        new Map();

      for (
        const oldPerson of backup.people
      ) {
        const { data, error } =
          await supabaseClient
            .from("people")
            .insert({
              office_id:
                officeId,

              name:
                oldPerson.name ||
                "بدون اسم",

              phone:
                oldPerson.phone ||
                "",

              details:
                oldPerson.details ||
                ""
            })
            .select()
            .single();

        if (error) {
          console.error(
            "Import person:",
            error
          );

          continue;
        }

        peopleMap.set(
          oldPerson.id,
          data.id
        );
      }

      // الحركات
      for (
        const oldTxn of backup.transactions
      ) {
        const newPersonId =
          peopleMap.get(
            oldTxn.person_id
          );

        if (!newPersonId) continue;

        const { error } =
          await supabaseClient
            .from("transactions")
            .insert({
              office_id:
                officeId,

              person_id:
                newPersonId,

              type:
                oldTxn.type,

              amount:
                Number(
                  oldTxn.amount
                ),

              details:
                oldTxn.details ||
                "",

              date:
                oldTxn.date ||
                new Date().toISOString()
            });

        if (error) {
          console.error(
            "Import transaction:",
            error
          );
        }
      }

      notify(
        "تم استيراد البيانات"
      );

      await loadOfficeData();
    } catch (error) {
      console.error(
        "Import:",
        error
      );

      notify(
        "فشل استيراد النسخة: " +
          error.message,
        "error"
      );
    }
  }

  // =========================================================
  // الأحداث
  // =========================================================

  function setupEvents() {
    // Login
    $("loginForm")?.addEventListener(
      "submit",
      handleLogin
    );

    // Logout
    $("logoutBtn")?.addEventListener(
      "click",
      logout
    );

    $("adminLogoutBtn")?.addEventListener(
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
      renderOffices
    );

    // Search people
    $("searchInput")?.addEventListener(
      "input",
      renderPeople
    );

    // Add person
    $("addPersonBtn")?.addEventListener(
      "click",
      () => openPersonModal()
    );

    // Back person
    $("backBtn")?.addEventListener(
      "click",
      () => {
        state.currentPerson = null;

        show($("peopleView"));
        hide($("personView"));

        renderPeople();
      }
    );

    // Pay
    $("payBtn")?.addEventListener(
      "click",
      () =>
        openTransactionModal(
          "payment"
        )
    );

    // Purchase
    $("purchaseBtn")?.addEventListener(
      "click",
      () =>
        openTransactionModal(
          "purchase"
        )
    );

    // Edit person
    $("editPersonBtn")?.addEventListener(
      "click",
      () => {
        if (
          state.currentPerson
        ) {
          openPersonModal(
            state.currentPerson
          );
        }
      }
    );

    // Back admin
    $("backToAdminBtn")?.addEventListener(
      "click",
      () => {
        state.currentOffice = null;
        state.currentPerson = null;
        state.role = "admin";

        showAdmin();

        loadOffices();
      }
    );

    // Export
    $("exportBtn")?.addEventListener(
      "click",
      exportData
    );

    // Import
    $("importBtn")?.addEventListener(
      "click",
      () => {
        $("importFile")?.click();
      }
    );

    $("importFile")?.addEventListener(
      "change",
      (event) => {
        const file =
          event.target.files?.[0];

        if (file) {
          importData(file);
        }

        event.target.value = "";
      }
    );

    // Modal close
    $("modalClose")?.addEventListener(
      "click",
      closeModal
    );

    $("modal")?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("modal")
        ) {
          closeModal();
        }
      }
    );

    // Offices list delegation
    $("officesList")?.addEventListener(
      "click",
      (event) => {
        const editBtn =
          event.target.closest(
            "[data-edit-office]"
          );

        if (editBtn) {
          const id =
            editBtn.dataset
              .editOffice;

          const office =
            state.offices.find(
              (x) => x.id === id
            );

          if (office) {
            openOfficeModal(
              office
            );
          }

          return;
        }

        const deleteBtn =
          event.target.closest(
            "[data-delete-office]"
          );

        if (deleteBtn) {
          deleteOffice(
            deleteBtn.dataset
              .deleteOffice
          );

          return;
        }
      }
    );

    // People list delegation
    $("peopleList")?.addEventListener(
      "click",
      (event) => {
        const item =
          event.target.closest(
            "[data-person]"
          );

        if (!item) return;

        openPerson(
          item.dataset.person
        );
      }
    );

    // Transactions
    $("transactionsList")
      ?.addEventListener(
        "click",
        (event) => {
          const btn =
            event.target.closest(
              "[data-delete-txn]"
            );

          if (!btn) return;

          deleteTransaction(
            btn.dataset
              .deleteTxn
          );
        }
      );

    // Keyboard ESC
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape"
        ) {
          closeModal();
        }
      }
    );
  }

  // =========================================================
  // حماية من عدم وجود الصفحة
  // =========================================================

  function boot() {
    try {
      setupEvents();

      init();
    } catch (error) {
      console.error(
        "Application boot error:",
        error
      );

      showLogin();

      notify(
        "حدث خطأ في تشغيل التطبيق. افتح Console لمعرفة التفاصيل.",
        "error"
      );
    }
  }

  // =========================================================
  // بدء التطبيق
  // =========================================================

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();