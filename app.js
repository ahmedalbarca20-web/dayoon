(function () {
  "use strict";

  // ============================================================
  // SUPABASE
  // ============================================================

  const supabase = window.supabaseClient;

  if (!supabase) {
    console.error("Supabase client غير موجود. تأكد من supabase-config.js");
    return;
  }

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    user: null,
    role: null,

    offices: [],
    currentOfficeId: null,

    people: [],
    currentPersonId: null,

    searchQuery: ""
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const $ = (id) => document.getElementById(id);

  function show(el) {
    if (el) el.classList.remove("hidden");
  }

  function hide(el) {
    if (el) el.classList.add("hidden");
  }

  function setText(id, value) {
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
    if (!value) return "";

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function formatDateTime(value) {
    if (!value) return "";

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showLoginMessage(message, type = "error") {
    const el = $("loginMessage");

    if (!el) return;

    el.textContent = message;
    el.className = "login-message";

    if (type === "success") {
      el.classList.add("success");
    } else {
      el.classList.add("error");
    }

    show(el);
  }

  function clearLoginMessage() {
    hide($("loginMessage"));
  }

  function showModal(title, html) {
    setText("modalTitle", title);

    const body = $("modalBody");

    if (body) {
      body.innerHTML = html;
    }

    show($("modal"));
  }

  function closeModal() {
    hide($("modal"));
  }

  // ============================================================
  // CONNECTION STATUS
  // ============================================================

  async function checkConnection() {
    const dot = $("connDot");
    const text = $("connText");

    try {
      const { error } = await supabase
        .from("offices")
        .select("id")
        .limit(1);

      if (error) {
        if (dot) dot.style.background = "#ef4444";
        if (text) text.textContent = "تعذر الاتصال بقاعدة البيانات";
        return false;
      }

      if (dot) dot.style.background = "#22c55e";
      if (text) text.textContent = "متصل بـ Supabase";

      return true;
    } catch (error) {
      console.error(error);

      if (dot) dot.style.background = "#ef4444";
      if (text) text.textContent = "تعذر الاتصال";

      return false;
    }
  }

  // ============================================================
  // AUTH
  // ============================================================

  async function getCurrentUser() {
    const {
      data,
      error
    } = await supabase.auth.getUser();

    if (error) {
      console.error(error);
      return null;
    }

    return data.user || null;
  }

  async function loadProfile(userId) {
    const {
      data,
      error
    } = await supabase
      .from("profiles")
      .select("id, role, office_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile error:", error);
      return null;
    }

    return data;
  }

  async function login(email, password) {
    clearLoginMessage();

    if (!email || !password) {
      showLoginMessage("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    const btn = $("loginBtn");

    if (btn) {
      btn.disabled = true;
      btn.textContent = "جارٍ الدخول...";
    }

    try {
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        console.error(error);
        showLoginMessage("بيانات الدخول غير صحيحة");
        return;
      }

      state.user = data.user;

      const profile = await loadProfile(state.user.id);

      if (!profile) {
        await supabase.auth.signOut();

        showLoginMessage(
          "هذا الحساب غير مربوط بحساب أدمن في قاعدة البيانات."
        );

        return;
      }

      state.role = profile.role;
      state.currentOfficeId = profile.office_id || null;

      if (state.role === "admin") {
        await enterAdmin();
      } else if (state.role === "office") {
        if (!state.currentOfficeId) {
          await supabase.auth.signOut();

          showLoginMessage("حساب المكتب غير مربوط بمكتب.");
          return;
        }

        await enterOffice(state.currentOfficeId);
      } else {
        await supabase.auth.signOut();

        showLoginMessage("نوع الحساب غير معروف.");
      }
    } catch (error) {
      console.error(error);
      showLoginMessage("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "دخول";
      }
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    }

    state.user = null;
    state.role = null;
    state.currentOfficeId = null;
    state.people = [];
    state.currentPersonId = null;

    hide($("adminView"));
    hide($("appView"));
    show($("loginView"));

    clearLoginMessage();
  }

  // ============================================================
  // VIEWS
  // ============================================================

  async function enterAdmin() {
    hide($("loginView"));
    hide($("appView"));
    show($("adminView"));

    state.currentOfficeId = null;

    await loadOffices();
  }

  async function enterOffice(officeId) {
    state.currentOfficeId = officeId;

    hide($("loginView"));
    hide($("adminView"));
    show($("appView"));

    hide($("backToAdminBtn"));

    await loadCurrentOffice();
    await loadPeople();

    showPeopleView();
  }

  async function enterOfficeFromAdmin(officeId) {
    state.currentOfficeId = officeId;

    hide($("adminView"));
    show($("appView"));

    show($("backToAdminBtn"));

    await loadCurrentOffice();
    await loadPeople();

    showPeopleView();
  }

  function backToAdmin() {
    state.currentOfficeId = null;
    state.currentPersonId = null;
    state.people = [];

    hide($("appView"));
    show($("adminView"));

    loadOffices();
  }

  function showPeopleView() {
    show($("peopleView"));
    hide($("personView"));

    state.currentPersonId = null;

    renderPeople();
    updateStats();
  }

  function showPersonView(personId) {
    hide($("peopleView"));
    show($("personView"));

    state.currentPersonId = personId;

    renderCurrentPerson();
    loadTransactions(personId);
  }

  // ============================================================
  // OFFICES
  // ============================================================

  async function loadOffices() {
    const list = $("officesList");

    if (list) {
      list.innerHTML = "<div class='loading'>جارٍ تحميل المكاتب...</div>";
    }

    const {
      data,
      error
    } = await supabase
      .from("offices")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      if (list) {
        list.innerHTML =
          "<div class='empty-state'>حدث خطأ أثناء تحميل المكاتب</div>";
      }

      return;
    }

    state.offices = data || [];

    renderOffices();
  }

  function renderOffices() {
    const list = $("officesList");
    const empty = $("officesEmpty");

    if (!list) return;

    let offices = state.offices;

    const search = ($("officeSearch")?.value || "")
      .trim()
      .toLowerCase();

    if (search) {
      offices = offices.filter((office) => {
        return (
          String(office.name || "")
            .toLowerCase()
            .includes(search) ||
          String(office.username || "")
            .toLowerCase()
            .includes(search) ||
          String(office.phone || "")
            .toLowerCase()
            .includes(search)
        );
      });
    }

    setText("officesCount", state.offices.length);

    if (!offices.length) {
      list.innerHTML = "";

      if (empty) {
        show(empty);
      }

      return;
    }

    hide(empty);

    list.innerHTML = offices
      .map((office) => {
        const active = office.active !== false;

        return `
          <div class="person-item office-item">

            <div class="person-main"
                 data-office-id="${escapeHtml(office.id)}">

              <div class="person-name">
                ${escapeHtml(office.name)}
              </div>

              <div class="person-meta">
                ${escapeHtml(office.username || "")}
                ${office.phone ? " • " + escapeHtml(office.phone) : ""}
              </div>

              ${
                office.contract_end
                  ? `
                    <div class="person-meta">
                      نهاية العقد:
                      ${escapeHtml(formatDate(office.contract_end))}
                    </div>
                  `
                  : ""
              }

            </div>

            <div class="person-actions">

              <span class="status-badge ${
                active ? "active" : "inactive"
              }">
                ${active ? "فعال" : "غير فعال"}
              </span>

              <button
                class="btn btn-primary office-open-btn"
                data-office-id="${escapeHtml(office.id)}">
                فتح
              </button>

              <button
                class="btn btn-edit office-edit-btn"
                data-office-id="${escapeHtml(office.id)}">
                تعديل
              </button>

              <button
                class="btn btn-danger office-delete-btn"
                data-office-id="${escapeHtml(office.id)}">
                حذف
              </button>

            </div>

          </div>
        `;
      })
      .join("");
  }

  function openAddOfficeModal() {
    showModal(
      "إضافة مكتب",
      `
        <form id="officeForm">

          <div class="form-group">
            <label>اسم المكتب</label>
            <input
              id="officeName"
              type="text"
              required
              placeholder="مثال: مكتب بغداد">
          </div>

          <div class="form-group">
            <label>اسم المستخدم</label>
            <input
              id="officeUsername"
              type="text"
              required
              placeholder="اسم المكتب">
          </div>

          <div class="form-group">
            <label>رقم الهاتف</label>
            <input
              id="officePhone"
              type="text"
              placeholder="07xxxxxxxxx">
          </div>

          <div class="form-group">
            <label>التفاصيل</label>
            <textarea
              id="officeDetails"
              rows="3"
              placeholder="ملاحظات"></textarea>
          </div>

          <div class="form-group">
            <label>بداية العقد</label>
            <input
              id="officeContractStart"
              type="date">
          </div>

          <div class="form-group">
            <label>نهاية العقد</label>
            <input
              id="officeContractEnd"
              type="date">
          </div>

          <button
            type="submit"
            class="btn btn-primary">
            حفظ المكتب
          </button>

        </form>
      `
    );

    const form = $("officeForm");

    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        await createOffice();
      });
    }
  }

  async function createOffice() {
    const name = $("officeName")?.value.trim();
    const username = $("officeUsername")?.value.trim();
    const phone = $("officePhone")?.value.trim() || "";
    const details = $("officeDetails")?.value.trim() || "";
    const contractStart =
      $("officeContractStart")?.value || null;
    const contractEnd =
      $("officeContractEnd")?.value || null;

    if (!name || !username) {
      alert("اسم المكتب واسم المستخدم مطلوبان");
      return;
    }

    const {
      data,
      error
    } = await supabase
      .from("offices")
      .insert({
        name,
        username,
        phone,
        details,
        active: true,
        contract_start: contractStart,
        contract_end: contractEnd
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        alert("اسم المستخدم موجود مسبقًا");
      } else {
        alert("تعذر حفظ المكتب: " + error.message);
      }

      return;
    }

    state.offices.unshift(data);

    closeModal();
    renderOffices();

    alert("تم حفظ المكتب بنجاح");
  }

  function openEditOfficeModal(officeId) {
    const office = state.offices.find(
      (item) => item.id === officeId
    );

    if (!office) return;

    showModal(
      "تعديل المكتب",
      `
        <form id="officeEditForm">

          <div class="form-group">
            <label>اسم المكتب</label>
            <input
              id="officeName"
              type="text"
              required
              value="${escapeHtml(office.name)}">
          </div>

          <div class="form-group">
            <label>اسم المستخدم</label>
            <input
              id="officeUsername"
              type="text"
              required
              value="${escapeHtml(office.username)}">
          </div>

          <div class="form-group">
            <label>رقم الهاتف</label>
            <input
              id="officePhone"
              type="text"
              value="${escapeHtml(office.phone || "")}">
          </div>

          <div class="form-group">
            <label>التفاصيل</label>
            <textarea
              id="officeDetails"
              rows="3">${escapeHtml(
                office.details || ""
              )}</textarea>
          </div>

          <div class="form-group">
            <label>بداية العقد</label>
            <input
              id="officeContractStart"
              type="date"
              value="${escapeHtml(
                office.contract_start || ""
              )}">
          </div>

          <div class="form-group">
            <label>نهاية العقد</label>
            <input
              id="officeContractEnd"
              type="date"
              value="${escapeHtml(
                office.contract_end || ""
              )}">
          </div>

          <div class="form-group">
            <label>
              <input
                id="officeActive"
                type="checkbox"
                ${office.active !== false ? "checked" : ""}>
              المكتب فعال
            </label>
          </div>

          <button
            type="submit"
            class="btn btn-primary">
            حفظ التعديلات
          </button>

        </form>
      `
    );

    const form = $("officeEditForm");

    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const update = {
          name: $("officeName").value.trim(),
          username: $("officeUsername").value.trim(),
          phone: $("officePhone").value.trim(),
          details: $("officeDetails").value.trim(),
          contract_start:
            $("officeContractStart").value || null,
          contract_end:
            $("officeContractEnd").value || null,
          active: $("officeActive").checked
        };

        if (!update.name || !update.username) {
          alert("اسم المكتب واسم المستخدم مطلوبان");
          return;
        }

        const {
          data,
          error
        } = await supabase
          .from("offices")
          .update(update)
          .eq("id", officeId)
          .select()
          .single();

        if (error) {
          console.error(error);
          alert("تعذر تعديل المكتب: " + error.message);
          return;
        }

        const index = state.offices.findIndex(
          (item) => item.id === officeId
        );

        if (index !== -1) {
          state.offices[index] = data;
        }

        closeModal();
        renderOffices();

        alert("تم تعديل المكتب");
      });
    }
  }

  async function deleteOffice(officeId) {
    const office = state.offices.find(
      (item) => item.id === officeId
    );

    if (!office) return;

    const ok = confirm(
      `هل أنت متأكد من حذف المكتب "${office.name}"؟\n\nسيتم حذف الأشخاص والحركات التابعة له أيضًا.`
    );

    if (!ok) return;

    const {
      error
    } = await supabase
      .from("offices")
      .delete()
      .eq("id", officeId);

    if (error) {
      console.error(error);
      alert("تعذر حذف المكتب: " + error.message);
      return;
    }

    state.offices = state.offices.filter(
      (item) => item.id !== officeId
    );

    renderOffices();

    alert("تم حذف المكتب");
  }

  // ============================================================
  // CURRENT OFFICE
  // ============================================================

  async function loadCurrentOffice() {
    if (!state.currentOfficeId) return;

    const {
      data,
      error
    } = await supabase
      .from("offices")
      .select("*")
      .eq("id", state.currentOfficeId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    if (!data) return;

    setText("appTitle", data.name || "دفتر الديون");
    setText(
      "appSubtitle",
      data.details || "إدارة الديون بسهولة"
    );

    renderContractBanner(data);
  }

  function renderContractBanner(office) {
    const banner = $("contractBanner");

    if (!banner) return;

    if (!office.contract_end) {
      hide(banner);
      return;
    }

    const end = new Date(office.contract_end);
    const now = new Date();

    const diff =
      Math.ceil(
        (end.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

    if (diff < 0) {
      banner.innerHTML = `
        <strong>⚠️ العقد منتهي</strong>
        <span>
          انتهى بتاريخ ${escapeHtml(
            formatDate(office.contract_end)
          )}
        </span>
      `;

      show(banner);
      return;
    }

    if (diff <= 30) {
      banner.innerHTML = `
        <strong>⚠️ تنبيه العقد</strong>
        <span>
          متبقي ${diff} يوم على انتهاء العقد
        </span>
      `;

      show(banner);
      return;
    }

    hide(banner);
  }

  // ============================================================
  // PEOPLE
  // ============================================================

  async function loadPeople() {
    if (!state.currentOfficeId) return;

    const list = $("peopleList");

    if (list) {
      list.innerHTML =
        "<div class='loading'>جارٍ تحميل الأشخاص...</div>";
    }

    const {
      data,
      error
    } = await supabase
      .from("people_with_balance")
      .select("*")
      .eq("office_id", state.currentOfficeId)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(error);

      if (list) {
        list.innerHTML =
          "<div class='empty-state'>تعذر تحميل الأشخاص</div>";
      }

      return;
    }

    state.people = data || [];

    renderPeople();
    updateStats();
  }

  function renderPeople() {
    const list = $("peopleList");
    const empty = $("emptyState");

    if (!list) return;

    let people = state.people;

    const search = state.searchQuery.trim().toLowerCase();

    if (search) {
      people = people.filter((person) => {
        return (
          String(person.name || "")
            .toLowerCase()
            .includes(search) ||
          String(person.phone || "")
            .toLowerCase()
            .includes(search)
        );
      });
    }

    if (!people.length) {
      list.innerHTML = "";

      if (empty) {
        show(empty);
      }

      return;
    }

    hide(empty);

    list.innerHTML = people
      .map((person) => {
        const balance = Number(person.balance || 0);

        let balanceClass = "neutral";

        if (balance > 0) {
          balanceClass = "debt";
        } else if (balance < 0) {
          balanceClass = "credit";
        }

        return `
          <div
            class="person-item"
            data-person-id="${escapeHtml(person.id)}">

            <div class="person-main">

              <div class="person-name">
                ${escapeHtml(person.name)}
              </div>

              <div class="person-meta">
                ${
                  person.phone
                    ? escapeHtml(person.phone)
                    : "بدون رقم هاتف"
                }
              </div>

            </div>

            <div class="person-balance ${balanceClass}">
              <span class="balance-label">
                المستحق
              </span>

              <strong>
                ${money(balance)}
              </strong>
            </div>

            <div class="person-actions">

              <button
                class="btn btn-primary person-open-btn"
                data-person-id="${escapeHtml(person.id)}">
                فتح
              </button>

              <button
                class="btn btn-edit person-edit-btn"
                data-person-id="${escapeHtml(person.id)}">
                تعديل
              </button>

              <button
                class="btn btn-danger person-delete-btn"
                data-person-id="${escapeHtml(person.id)}">
                حذف
              </button>

            </div>

          </div>
        `;
      })
      .join("");
  }

  function updateStats() {
    const total = state.people.reduce(
      (sum, person) =>
        sum + Number(person.balance || 0),
      0
    );

    setText("totalDebt", money(total));
    setText("peopleCount", state.people.length);
  }

  function openAddPersonModal() {
    showModal(
      "إضافة شخص",
      `
        <form id="personForm">

          <div class="form-group">
            <label>اسم الشخص</label>

            <input
              id="personName"
              type="text"
              required
              placeholder="الاسم">
          </div>

          <div class="form-group">
            <label>رقم الهاتف</label>

            <input
              id="personPhone"
              type="text"
              placeholder="07xxxxxxxxx">
          </div>

          <div class="form-group">
            <label>التفاصيل</label>

            <textarea
              id="personDetails"
              rows="3"
              placeholder="ملاحظات"></textarea>
          </div>

          <button
            type="submit"
            class="btn btn-primary">
            حفظ الشخص
          </button>

        </form>
      `
    );

    $("personForm").addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        await createPerson();
      }
    );
  }

  async function createPerson() {
    if (!state.currentOfficeId) {
      alert("لم يتم تحديد المكتب");
      return;
    }

    const name = $("personName").value.trim();
    const phone = $("personPhone").value.trim();
    const details = $("personDetails").value.trim();

    if (!name) {
      alert("اسم الشخص مطلوب");
      return;
    }

    const {
      data,
      error
    } = await supabase
      .from("people")
      .insert({
        office_id: state.currentOfficeId,
        name,
        phone,
        details
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("تعذر حفظ الشخص: " + error.message);
      return;
    }

    state.people.unshift({
      ...data,
      balance: 0
    });

    closeModal();

    renderPeople();
    updateStats();

    alert("تم حفظ الشخص في Supabase");
  }

  function openEditPersonModal(personId) {
    const person = state.people.find(
      (item) => item.id === personId
    );

    if (!person) return;

    showModal(
      "تعديل بيانات الشخص",
      `
        <form id="personEditForm">

          <div class="form-group">
            <label>اسم الشخص</label>

            <input
              id="personName"
              type="text"
              required
              value="${escapeHtml(person.name)}">
          </div>

          <div class="form-group">
            <label>رقم الهاتف</label>

            <input
              id="personPhone"
              type="text"
              value="${escapeHtml(
                person.phone || ""
              )}">
          </div>

          <div class="form-group">
            <label>التفاصيل</label>

            <textarea
              id="personDetails"
              rows="3">${escapeHtml(
                person.details || ""
              )}</textarea>
          </div>

          <button
            type="submit"
            class="btn btn-primary">
            حفظ التعديلات
          </button>

        </form>
      `
    );

    $("personEditForm").addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const update = {
          name: $("personName").value.trim(),
          phone: $("personPhone").value.trim(),
          details: $("personDetails").value.trim()
        };

        if (!update.name) {
          alert("اسم الشخص مطلوب");
          return;
        }

        const {
          data,
          error
        } = await supabase
          .from("people")
          .update(update)
          .eq("id", personId)
          .eq("office_id", state.currentOfficeId)
          .select()
          .single();

        if (error) {
          console.error(error);
          alert(
            "تعذر تعديل الشخص: " +
              error.message
          );
          return;
        }

        const index = state.people.findIndex(
          (item) => item.id === personId
        );

        if (index !== -1) {
          state.people[index] = {
            ...state.people[index],
            ...data
          };
        }

        closeModal();

        renderPeople();

        if (state.currentPersonId === personId) {
          renderCurrentPerson();
        }

        alert("تم تعديل البيانات");
      }
    );
  }

  async function deletePerson(personId) {
    const person = state.people.find(
      (item) => item.id === personId
    );

    if (!person) return;

    const ok = confirm(
      `هل تريد حذف "${person.name}"؟\n\nسيتم حذف جميع حركاته أيضًا.`
    );

    if (!ok) return;

    const {
      error
    } = await supabase
      .from("people")
      .delete()
      .eq("id", personId)
      .eq("office_id", state.currentOfficeId);

    if (error) {
      console.error(error);
      alert("تعذر حذف الشخص: " + error.message);
      return;
    }

    state.people = state.people.filter(
      (item) => item.id !== personId
    );

    if (state.currentPersonId === personId) {
      showPeopleView();
    }

    renderPeople();
    updateStats();

    alert("تم حذف الشخص");
  }

  // ============================================================
  // PERSON DETAILS
  // ============================================================

  function getCurrentPerson() {
    return state.people.find(
      (person) =>
        person.id === state.currentPersonId
    );
  }

  function renderCurrentPerson() {
    const person = getCurrentPerson();

    if (!person) return;

    const card = $("personCard");

    if (!card) return;

    const balance = Number(person.balance || 0);

    card.innerHTML = `
      <div class="person-card-inner">

        <div>
          <h2>
            ${escapeHtml(person.name)}
          </h2>

          ${
            person.phone
              ? `
                <p>
                  📱 ${escapeHtml(person.phone)}
                </p>
              `
              : ""
          }

          ${
            person.details
              ? `
                <p>
                  ${escapeHtml(person.details)}
                </p>
              `
              : ""
          }
        </div>

        <div class="person-card-balance">

          <span>المستحق</span>

          <strong>
            ${money(balance)}
          </strong>

        </div>

      </div>
    `;
  }

  // ============================================================
  // TRANSACTIONS
  // ============================================================

  async function loadTransactions(personId) {
    const list = $("transactionsList");

    if (list) {
      list.innerHTML =
        "<div class='loading'>جارٍ تحميل سجل الحركات...</div>";
    }

    const {
      data,
      error
    } = await supabase
      .from("transactions")
      .select("*")
      .eq("person_id", personId)
      .eq("office_id", state.currentOfficeId)
      .order("date", {
        ascending: false
      });

    if (error) {
      console.error(error);

      if (list) {
        list.innerHTML =
          "<div class='empty-state'>تعذر تحميل الحركات</div>";
      }

      return;
    }

    renderTransactions(data || []);
  }

  function renderTransactions(transactions) {
    const list = $("transactionsList");

    if (!list) return;

    setText("txnCount", transactions.length);

    if (!transactions.length) {
      list.innerHTML = `
        <div class="empty-state">
          <p>لا توجد حركات لهذا الشخص.</p>
        </div>
      `;

      return;
    }

    list.innerHTML = transactions
      .map((txn) => {
        const purchase =
          txn.type === "purchase";

        return `
          <div class="transaction-item ${
            purchase ? "purchase" : "payment"
          }">

            <div class="transaction-main">

              <strong>
                ${
                  purchase
                    ? "شراء"
                    : "تسديد"
                }
              </strong>

              <span>
                ${escapeHtml(
                  formatDateTime(txn.date)
                )}
              </span>

              ${
                txn.details
                  ? `
                    <small>
                      ${escapeHtml(
                        txn.details
                      )}
                    </small>
                  `
                  : ""
              }

            </div>

            <div class="transaction-amount">

              ${
                purchase ? "+" : "-"
              }${money(txn.amount)}

            </div>

            <button
              class="btn btn-danger txn-delete-btn"
              data-txn-id="${escapeHtml(txn.id)}">
              حذف
            </button>

          </div>
        `;
      })
      .join("");
  }

  function openTransactionModal(type) {
    const person = getCurrentPerson();

    if (!person) {
      alert("لم يتم تحديد الشخص");
      return;
    }

    const title =
      type === "purchase"
        ? "إضافة شراء"
        : "إضافة تسديد";

    showModal(
      title,
      `
        <form id="transactionForm">

          <div class="form-group">
            <label>المبلغ</label>

            <input
              id="transactionAmount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0">
          </div>

          <div class="form-group">
            <label>التفاصيل</label>

            <textarea
              id="transactionDetails"
              rows="3"
              placeholder="ملاحظات"></textarea>
          </div>

          <button
            type="submit"
            class="btn ${
              type === "purchase"
                ? "btn-danger"
                : "btn-success"
            }">
            ${
              type === "purchase"
                ? "حفظ الشراء"
                : "حفظ التسديد"
            }
          </button>

        </form>
      `
    );

    $("transactionForm").addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        await createTransaction(type);
      }
    );
  }

  async function createTransaction(type) {
    const amount = Number(
      $("transactionAmount").value
    );

    const details =
      $("transactionDetails").value.trim();

    if (!amount || amount <= 0) {
      alert("أدخل مبلغًا صحيحًا");
      return;
    }

    if (
      !state.currentOfficeId ||
      !state.currentPersonId
    ) {
      alert("لم يتم تحديد المكتب أو الشخص");
      return;
    }

    const {
      data,
      error
    } = await supabase
      .from("transactions")
      .insert({
        office_id: state.currentOfficeId,
        person_id: state.currentPersonId,
        type,
        amount,
        details,
        date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      alert(
        "تعذر حفظ الحركة في Supabase: " +
          error.message
      );

      return;
    }

    closeModal();

    await loadPeople();

    renderCurrentPerson();

    await loadTransactions(
      state.currentPersonId
    );

    alert(
      type === "purchase"
        ? "تم حفظ الشراء في Supabase"
        : "تم حفظ التسديد في Supabase"
    );
  }

  async function deleteTransaction(txnId) {
    const ok = confirm(
      "هل تريد حذف هذه الحركة؟"
    );

    if (!ok) return;

    const {
      error
    } = await supabase
      .from("transactions")
      .delete()
      .eq("id", txnId)
      .eq("office_id", state.currentOfficeId);

    if (error) {
      console.error(error);
      alert(
        "تعذر حذف الحركة: " +
          error.message
      );
      return;
    }

    await loadPeople();

    renderCurrentPerson();

    await loadTransactions(
      state.currentPersonId
    );
  }

  // ============================================================
  // EXPORT
  // ============================================================

  async function exportData() {
    if (!state.currentOfficeId) return;

    const {
      data: people,
      error: peopleError
    } = await supabase
      .from("people")
      .select("*")
      .eq("office_id", state.currentOfficeId)
      .order("created_at", {
        ascending: true
      });

    if (peopleError) {
      alert(
        "تعذر تصدير الأشخاص: " +
          peopleError.message
      );
      return;
    }

    const {
      data: transactions,
      error: transactionsError
    } = await supabase
      .from("transactions")
      .select("*")
      .eq("office_id", state.currentOfficeId)
      .order("date", {
        ascending: true
      });

    if (transactionsError) {
      alert(
        "تعذر تصدير الحركات: " +
          transactionsError.message
      );
      return;
    }

    const office = state.offices.find(
      (item) =>
        item.id === state.currentOfficeId
    );

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),

      office: office || {
        id: state.currentOfficeId
      },

      people: people || [],

      transactions: transactions || []
    };

    const blob = new Blob(
      [
        JSON.stringify(
          backup,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

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

  // ============================================================
  // IMPORT
  // ============================================================

  function importData() {
    const fileInput = $("importFile");

    if (!fileInput) return;

    fileInput.click();
  }

  async function handleImportFile(file) {
    if (!file) return;

    if (!state.currentOfficeId) {
      alert("لم يتم تحديد المكتب");
      return;
    }

    try {
      const text = await file.text();

      const backup =
        JSON.parse(text);

      if (
        !backup ||
        !Array.isArray(backup.people) ||
        !Array.isArray(backup.transactions)
      ) {
        alert("ملف النسخة الاحتياطية غير صحيح");
        return;
      }

      const ok = confirm(
        "سيتم استيراد البيانات إلى المكتب الحالي.\n\nهل تريد المتابعة؟"
      );

      if (!ok) return;

      const personIdMap = {};

      for (const oldPerson of backup.people) {
        const {
          data: newPerson,
          error
        } = await supabase
          .from("people")
          .insert({
            office_id: state.currentOfficeId,
            name: oldPerson.name || "",
            phone: oldPerson.phone || "",
            details: oldPerson.details || ""
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        personIdMap[oldPerson.id] =
          newPerson.id;
      }

      for (const oldTxn of backup.transactions) {
        const newPersonId =
          personIdMap[
            oldTxn.person_id
          ];

        if (!newPersonId) continue;

        const {
          error
        } = await supabase
          .from("transactions")
          .insert({
            office_id:
              state.currentOfficeId,

            person_id:
              newPersonId,

            type:
              oldTxn.type === "payment"
                ? "payment"
                : "purchase",

            amount:
              Number(oldTxn.amount),

            details:
              oldTxn.details || "",

            date:
              oldTxn.date ||
              new Date().toISOString()
          });

        if (error) {
          throw error;
        }
      }

      await loadPeople();

      alert(
        "تم استيراد البيانات وحفظها في Supabase"
      );
    } catch (error) {
      console.error(error);

      alert(
        "تعذر استيراد النسخة: " +
          error.message
      );
    }
  }

  // ============================================================
  // EVENTS
  // ============================================================

  function setupEvents() {
    // Login
    const loginForm = $("loginForm");

    if (loginForm) {
      loginForm.addEventListener(
        "submit",
        async function (event) {
          event.preventDefault();

          await login(
            $("loginEmail").value,
            $("loginPassword").value
          );
        }
      );
    }

    // Logout
    $("logoutBtn")?.addEventListener(
      "click",
      logout
    );

    $("adminLogoutBtn")?.addEventListener(
      "click",
      logout
    );

    // Back admin
    $("backToAdminBtn")?.addEventListener(
      "click",
      backToAdmin
    );

    // Modal
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

    // Add office
    $("addOfficeBtn")?.addEventListener(
      "click",
      openAddOfficeModal
    );

    // Office search
    $("officeSearch")?.addEventListener(
      "input",
      renderOffices
    );

    // Add person
    $("addPersonBtn")?.addEventListener(
      "click",
      openAddPersonModal
    );

    // Person search
    $("searchInput")?.addEventListener(
      "input",
      function () {
        state.searchQuery =
          $("searchInput").value || "";

        renderPeople();
      }
    );

    // Back people
    $("backBtn")?.addEventListener(
      "click",
      showPeopleView
    );

    // Payment
    $("payBtn")?.addEventListener(
      "click",
      function () {
        openTransactionModal("payment");
      }
    );

    // Purchase
    $("purchaseBtn")?.addEventListener(
      "click",
      function () {
        openTransactionModal("purchase");
      }
    );

    // Edit person
    $("editPersonBtn")?.addEventListener(
      "click",
      function () {
        if (state.currentPersonId) {
          openEditPersonModal(
            state.currentPersonId
          );
        }
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
      importData
    );

    // Import file
    $("importFile")?.addEventListener(
      "change",
      async function () {
        const file =
          this.files?.[0];

        if (file) {
          await handleImportFile(file);
        }

        this.value = "";
      }
    );

    // Offices delegation
    $("officesList")?.addEventListener(
      "click",
      async function (event) {
        const openBtn =
          event.target.closest(
            ".office-open-btn"
          );

        if (openBtn) {
          await enterOfficeFromAdmin(
            openBtn.dataset.officeId
          );
          return;
        }

        const editBtn =
          event.target.closest(
            ".office-edit-btn"
          );

        if (editBtn) {
          openEditOfficeModal(
            editBtn.dataset.officeId
          );
          return;
        }

        const deleteBtn =
          event.target.closest(
            ".office-delete-btn"
          );

        if (deleteBtn) {
          await deleteOffice(
            deleteBtn.dataset.officeId
          );
        }
      }
    );

    // People delegation
    $("peopleList")?.addEventListener(
      "click",
      async function (event) {
        const openBtn =
          event.target.closest(
            ".person-open-btn"
          );

        if (openBtn) {
          showPersonView(
            openBtn.dataset.personId
          );
          return;
        }

        const editBtn =
          event.target.closest(
            ".person-edit-btn"
          );

        if (editBtn) {
          openEditPersonModal(
            editBtn.dataset.personId
          );
          return;
        }

        const deleteBtn =
          event.target.closest(
            ".person-delete-btn"
          );

        if (deleteBtn) {
          await deletePerson(
            deleteBtn.dataset.personId
          );
          return;
        }

        const item =
          event.target.closest(
            ".person-item"
          );

        if (
          item &&
          !event.target.closest("button")
        ) {
          showPersonView(
            item.dataset.personId
          );
        }
      }
    );

    // Transactions delegation
    $("transactionsList")?.addEventListener(
      "click",
      async function (event) {
        const deleteBtn =
          event.target.closest(
            ".txn-delete-btn"
          );

        if (!deleteBtn) return;

        await deleteTransaction(
          deleteBtn.dataset.txnId
        );
      }
    );
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function init() {
    setupEvents();

    // لا نستخدم localStorage إطلاقًا

    hide($("adminView"));
    hide($("appView"));
    show($("loginView"));

    await checkConnection();

    try {
      const {
        data,
        error
      } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
        return;
      }

      const session =
        data?.session;

      if (!session) {
        return;
      }

      state.user =
        session.user;

      const profile =
        await loadProfile(
          state.user.id
        );

      if (!profile) {
        await supabase.auth.signOut();
        return;
      }

      state.role =
        profile.role;

      state.currentOfficeId =
        profile.office_id || null;

      if (state.role === "admin") {
        await enterAdmin();
      } else if (
        state.role === "office" &&
        state.currentOfficeId
      ) {
        await enterOffice(
          state.currentOfficeId
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  // ============================================================
  // AUTH STATE
  // ============================================================

  supabase.auth.onAuthStateChange(
    function (event, session) {
      console.log(
        "Supabase Auth:",
        event
      );

      if (!session) {
        state.user = null;
      }
    }
  );

  // ============================================================
  // START
  // ============================================================

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