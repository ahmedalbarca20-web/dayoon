(function () {
  "use strict";

  var CFG = window.SUPABASE_CONFIG || {};
  var SUPABASE_URL = CFG.SUPABASE_URL || "";
  var SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
  var LOCAL_ADMIN_USER = CFG.LOCAL_ADMIN_USER || "admin";
  var LOCAL_ADMIN_PASS = CFG.LOCAL_ADMIN_PASS || "admin123";

  var isSupabaseConfigured =
    !!window.supabase &&
    SUPABASE_URL.indexOf("YOUR-PROJECT") === -1 &&
    SUPABASE_ANON_KEY.indexOf("YOUR-SUPABASE") === -1;

  var OFFICES_KEY = "debtBookOffices";
  var SESSION_KEY = "debtBookSession";
  var LEGACY_DATA_KEY = "debtBookData";

  var supabase = null;
  if (isSupabaseConfigured) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  var state = {
    role: null, // "admin" | "office"
    offices: [],
    currentOfficeId: null,
    people: [],
    currentPersonId: null,
    searchQuery: ""
  };

  /* ===================== Helpers ===================== */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fmtMoney(n) {
    return Number(n || 0).toLocaleString("ar-EG") + " د.د";
  }

  function fmtDate(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    var opts = { year: "numeric", month: "short", day: "numeric" };
    return d.toLocaleDateString("ar", opts) + " - " + d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  }

  function personBalance(person) {
    var total = 0;
    (person.transactions || []).forEach(function (t) {
      total += t.type === "purchase" ? Number(t.amount) : -Number(t.amount);
    });
    return total;
  }

  function currentPerson() {
    return state.people.find(function (p) {
      return p.id === state.currentPersonId;
    });
  }

  function currentOffice() {
    return state.offices.find(function (o) {
      return o.id === state.currentOfficeId;
    });
  }

  function notify(msg, type) {
    var el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2500);
  }

  function openModal(title, bodyHtml) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    document.getElementById("modal").classList.remove("hidden");
  }

  function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    document.getElementById("modalBody").innerHTML = "";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function escAttr(s) {
    return esc(s);
  }

  function avatarLetter(name) {
    var n = (name || "").trim();
    return n ? n.charAt(0) : "؟";
  }

  function todayISO() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function addDaysISO(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function isContractExpired(office) {
    if (!office || !office.contract_end) return false;
    var end = new Date(office.contract_end + "T23:59:59").getTime();
    return end < Date.now();
  }

  function contractDaysLeft(office) {
    if (!office || !office.contract_end) return null;
    var end = new Date(office.contract_end + "T23:59:59").getTime();
    return Math.ceil((end - Date.now()) / 86400000);
  }

  function officeStatus(office) {
    if (office.active === false) return { label: "معطّل", cls: "badge-disabled" };
    if (isContractExpired(office)) return { label: "منتهي العقد", cls: "badge-expired" };
    return { label: "نشط", cls: "badge-active" };
  }

  function fmtDateOnly(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
  }

  function dataKey(officeId) {
    return "debtBookData_" + officeId;
  }

  /* ===================== Data Layer: Offices ===================== */

  async function loadOffices() {
    if (isSupabaseConfigured) {
      var res = await supabase.from("offices").select("*").order("created_at", { ascending: true });
      if (res.error) throw res.error;
      state.offices = res.data || [];
      return state.offices;
    }

    try {
      state.offices = JSON.parse(localStorage.getItem(OFFICES_KEY)) || [];
    } catch (e) {
      state.offices = [];
    }
    migrateLegacyData();
    return state.offices;
  }

  function saveOfficesLocal() {
    localStorage.setItem(OFFICES_KEY, JSON.stringify(state.offices));
  }

  function migrateLegacyData() {
    var legacy = localStorage.getItem(LEGACY_DATA_KEY);
    if (!legacy) return;
    if (state.offices.length > 0) {
      localStorage.removeItem(LEGACY_DATA_KEY);
      return;
    }
    var people = [];
    try {
      people = JSON.parse(legacy);
    } catch (e) {
      return;
    }
    var office = {
      id: uid(),
      name: "المكتب الرئيسي",
      username: "office1",
      password: "1234",
      phone: "",
      details: "تم ترحيله من البيانات القديمة",
      created_at: new Date().toISOString(),
      active: true,
      contract_start: todayISO(),
      contract_end: addDaysISO(365)
    };
    state.offices.push(office);
    localStorage.setItem(dataKey(office.id), JSON.stringify(people));
    saveOfficesLocal();
    localStorage.removeItem(LEGACY_DATA_KEY);
  }

  async function createOffice(office) {
    if (isSupabaseConfigured) {
      var res = await supabase
        .from("offices")
        .insert({
          name: office.name,
          username: office.username,
          password: office.password,
          phone: office.phone || "",
          details: office.details || "",
          contract_start: office.contract_start || null,
          contract_end: office.contract_end || null,
          active: office.active !== false
        })
        .select();
      if (res.error) throw res.error;
      state.offices.push(res.data[0]);
      return res.data[0];
    }

    office.id = uid();
    office.created_at = new Date().toISOString();
    office.active = office.active !== false;
    state.offices.push(office);
    if (!localStorage.getItem(dataKey(office.id))) {
      localStorage.setItem(dataKey(office.id), "[]");
    }
    saveOfficesLocal();
    return office;
  }

  async function updateOffice(office, patch) {
    if (isSupabaseConfigured) {
      var res = await supabase
        .from("offices")
        .update({
          name: patch.name,
          username: patch.username,
          password: patch.password,
          phone: patch.phone || "",
          details: patch.details || "",
          contract_start: patch.contract_start || null,
          contract_end: patch.contract_end || null,
          active: patch.active !== false
        })
        .eq("id", office.id);
      if (res.error) throw res.error;
      Object.assign(office, patch);
      office.active = patch.active !== false;
      return office;
    }

    Object.assign(office, patch);
    office.active = patch.active !== false;
    saveOfficesLocal();
    return office;
  }

  async function setOfficeActive(office, active) {
    if (isSupabaseConfigured) {
      var res = await supabase.from("offices").update({ active: active }).eq("id", office.id);
      if (res.error) throw res.error;
      office.active = active;
      return;
    }

    office.active = active;
    saveOfficesLocal();
  }

  async function deleteOffice(office) {
    if (isSupabaseConfigured) {
      var res = await supabase.from("offices").delete().eq("id", office.id);
      if (res.error) throw res.error;
      state.offices = state.offices.filter(function (o) {
        return o.id !== office.id;
      });
      return;
    }

    state.offices = state.offices.filter(function (o) {
      return o.id !== office.id;
    });
    saveOfficesLocal();
  }

  /* ===================== Data Layer: People (scoped by office) ===================== */

  async function loadPeople(officeId) {
    if (isSupabaseConfigured) {
      var res = await supabase
        .from("people")
        .select("*")
        .eq("office_id", officeId)
        .order("created_at", { ascending: true });
      if (res.error) throw res.error;
      state.people = res.data || [];

      var tres = await supabase
        .from("transactions")
        .select("*")
        .eq("office_id", officeId)
        .order("date", { ascending: true });
      if (tres.error) throw tres.error;
      var map = {};
      (tres.data || []).forEach(function (t) {
        if (!map[t.person_id]) map[t.person_id] = [];
        map[t.person_id].push(t);
      });
      state.people.forEach(function (p) {
        p.transactions = map[p.id] || [];
      });
      return state.people;
    }

    try {
      state.people = JSON.parse(localStorage.getItem(dataKey(officeId))) || [];
    } catch (e) {
      state.people = [];
    }
    return state.people;
  }

  function savePeopleLocal(officeId) {
    localStorage.setItem(dataKey(officeId), JSON.stringify(state.people));
  }

  async function createPerson(officeId, person) {
    if (isSupabaseConfigured) {
      var res = await supabase
        .from("people")
        .insert({
          office_id: officeId,
          name: person.name,
          phone: person.phone,
          details: person.details
        })
        .select();
      if (res.error) throw res.error;
      var row = res.data[0];
      row.transactions = [];
      state.people.push(row);
      return row;
    }

    person.id = uid();
    person.transactions = [];
    person.created_at = new Date().toISOString();
    person.updated_at = person.created_at;
    state.people.push(person);
    savePeopleLocal(officeId);
    return person;
  }

  async function updatePerson(officeId, person, patch) {
    if (isSupabaseConfigured) {
      var res = await supabase
        .from("people")
        .update({ name: patch.name, phone: patch.phone, details: patch.details, updated_at: new Date().toISOString() })
        .eq("id", person.id);
      if (res.error) throw res.error;
      person.name = patch.name;
      person.phone = patch.phone;
      person.details = patch.details;
      person.updated_at = new Date().toISOString();
      return person;
    }

    person.name = patch.name;
    person.phone = patch.phone;
    person.details = patch.details;
    person.updated_at = new Date().toISOString();
    savePeopleLocal(officeId);
    return person;
  }

  async function deletePerson(officeId, person) {
    if (isSupabaseConfigured) {
      var res = await supabase.from("people").delete().eq("id", person.id);
      if (res.error) throw res.error;
      state.people = state.people.filter(function (p) {
        return p.id !== person.id;
      });
      return;
    }

    state.people = state.people.filter(function (p) {
      return p.id !== person.id;
    });
    savePeopleLocal(officeId);
  }

  async function addTransaction(officeId, person, txn) {
    if (isSupabaseConfigured) {
      var res = await supabase
        .from("transactions")
        .insert({
          office_id: officeId,
          person_id: person.id,
          type: txn.type,
          amount: txn.amount,
          details: txn.details,
          date: new Date(txn.date).toISOString()
        })
        .select();
      if (res.error) throw res.error;
      var row = res.data[0];
      if (!person.transactions) person.transactions = [];
      person.transactions.push(row);
      person.updated_at = new Date().toISOString();
      return row;
    }

    txn.id = uid();
    if (!person.transactions) person.transactions = [];
    person.transactions.push(txn);
    person.updated_at = new Date().toISOString();
    savePeopleLocal(officeId);
    return txn;
  }

  /* ===================== Auth / Session ===================== */

  function saveSession() {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        role: state.role,
        currentOfficeId: state.currentOfficeId
      })
    );
  }

  function loadSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s) {
        state.role = s.role || null;
        state.currentOfficeId = s.currentOfficeId || null;
      }
    } catch (e) {
      state.role = null;
      state.currentOfficeId = null;
    }
  }

  function clearSession() {
    state.role = null;
    state.currentOfficeId = null;
    localStorage.removeItem(SESSION_KEY);
  }

  async function handleLogin(identifier, password) {
    if (isSupabaseConfigured) {
      var res = await supabase.auth.signInWithPassword({ email: identifier, password: password });
      if (res.error) throw res.error;
      state.role = "admin";
      state.currentOfficeId = null;
      return;
    }

    if (identifier === LOCAL_ADMIN_USER && password === LOCAL_ADMIN_PASS) {
      state.role = "admin";
      state.currentOfficeId = null;
      return;
    }

    if (state.offices.length === 0) {
      await loadOffices();
    }

    var office = state.offices.find(function (o) {
      return o.username === identifier && o.password === password;
    });
    if (office) {
      if (office.active === false) {
        throw new Error("هذا الحساب معطّل. راجع الإدارة");
      }
      if (isContractExpired(office)) {
        throw new Error("انتهت مدة عقد هذا المكتب. راجع الإدارة للتجديد");
      }
      state.role = "office";
      state.currentOfficeId = office.id;
      return;
    }
    throw new Error("بيانات الدخول غير صحيحة");
  }

  async function handleLogout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    clearSession();
  }

  /* ===================== Views ===================== */

  function showLogin() {
    document.getElementById("adminView").classList.add("hidden");
    document.getElementById("appView").classList.add("hidden");
    document.getElementById("loginView").classList.remove("hidden");
    var hint = document.getElementById("loginHint");
    if (isSupabaseConfigured) {
      hint.textContent = "سجّل الدخول بحساب الأدمن (البريد وكلمة المرور) في Supabase.";
      checkConnection();
    } else {
      hint.textContent = "وضع تجريبي: أدمن = " + LOCAL_ADMIN_USER + " / " + LOCAL_ADMIN_PASS +
        " — ويمكن لأي مكتب الدخول بحسابه الخاص.";
      setConnStatus("demo", "وضع تجريبي — لم يتم ربط Supabase بعد");
    }
  }

  async function checkConnection() {
    setConnStatus("checking", "جارٍ الاتصال بـ Supabase...");
    try {
      var res = await supabase.from("offices").select("id").limit(1);
      if (res.error) {
        throw res.error;
      }
      setConnStatus("ok", "✅ متصل بـ Supabase بنجاح — جاهز للاستخدام");
    } catch (err) {
      var msg = err && err.message ? err.message : "خطأ غير معروف";
      if (msg.indexOf("relation") !== -1 || msg.indexOf("does not exist") !== -1) {
        setConnStatus("warn", "✅ المفاتيح صحيحة والاتصال ناجح — لكن شغّل supabase-schema.sql في SQL Editor لإنشاء الجداول");
      } else if (msg.indexOf("Invalid API key") !== -1 || msg.indexOf("API key") !== -1) {
        setConnStatus("error", "❌ مفاتيح Supabase غير صحيحة — تأكد من supabase-config.js");
      } else if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
        setConnStatus("error", "❌ لا يوجد اتصال بالإنترنت أو رابط المشروع خاطئ");
      } else {
        setConnStatus("error", "❌ " + esc(msg));
      }
    }
  }

  function setConnStatus(kind, text) {
    var dot = document.getElementById("connDot");
    var txt = document.getElementById("connText");
    dot.className = "conn-dot " + kind;
    txt.textContent = text;
  }

  function showAdminView() {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appView").classList.add("hidden");
    document.getElementById("adminView").classList.remove("hidden");
    renderOffices();
  }

  function showOfficeView() {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("adminView").classList.add("hidden");
    document.getElementById("appView").classList.remove("hidden");

    var office = currentOffice();
    document.getElementById("appTitle").textContent = office ? office.name : "دفتر الديون";
    document.getElementById("appSubtitle").textContent = office ? "صفحة " + office.name + " الخاصة" : "إدارة الديون بسهولة";

    var banner = document.getElementById("contractBanner");
    if (office && office.contract_end) {
      var daysLeft = contractDaysLeft(office);
      var bannerMsg = "";
      var bannerCls = "banner-ok";
      if (isContractExpired(office)) {
        bannerMsg = "⏳ انتهت مدة عقدك بتاريخ " + fmtDateOnly(office.contract_end) + " — راجع الإدارة للتجديد";
        bannerCls = "banner-expired";
      } else if (daysLeft !== null && daysLeft <= 7) {
        bannerMsg = "⏳ متبقٍ على انتهاء عقدك " + daysLeft + " يوم (" + fmtDateOnly(office.contract_end) + ")";
        bannerCls = "banner-soon";
      } else {
        bannerMsg = "⏳ مدة العقد حتى " + fmtDateOnly(office.contract_end) + " (" + daysLeft + " يوم متبقٍ)";
      }
      banner.textContent = bannerMsg;
      banner.className = "contract-banner " + bannerCls;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
      banner.textContent = "";
    }

    var backBtn = document.getElementById("backToAdminBtn");
    if (state.role === "admin") {
      backBtn.classList.remove("hidden");
    } else {
      backBtn.classList.add("hidden");
    }

    state.currentPersonId = null;
    renderPeopleView();
  }

  /* ===================== Admin rendering ===================== */

  function filteredOffices() {
    var q = document.getElementById("officeSearch").value.trim().toLowerCase();
    if (!q) return state.offices.slice();
    return state.offices.filter(function (o) {
      return (
        (o.name || "").toLowerCase().indexOf(q) !== -1 ||
        (o.username || "").toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function renderOffices() {
    document.getElementById("officesCount").textContent = state.offices.length;
    var list = document.getElementById("officesList");
    var empty = document.getElementById("officesEmpty");
    var offices = filteredOffices();

    list.innerHTML = "";
    empty.classList.toggle("hidden", state.offices.length > 0);

    if (state.offices.length > 0 && offices.length === 0) {
      list.innerHTML = '<div class="empty-inner">لا توجد نتائج مطابقة للبحث.</div>';
      return;
    }

    offices.forEach(function (o) {
      var status = officeStatus(o);
      var daysLeft = contractDaysLeft(o);
      var el = document.createElement("div");
      el.className = "person-item office-item";
      el.innerHTML =
        '<div class="person-top">' +
        '<div class="person-avatar">🏢</div>' +
        '<div>' +
        '<div class="person-name">' + esc(o.name) + "</div>" +
        '<div class="person-phone">👤 ' + esc(o.username) + "</div>" +
        "</div>" +
        '<span class="status-badge ' + status.cls + '">' + status.label + "</span>" +
        "</div>" +
        (o.phone ? '<div class="person-meta">📱 ' + esc(o.phone) + "</div>" : "") +
        '<div class="contract-line">' +
        '<span>⏳ ' + fmtDateOnly(o.contract_start) + " → " + fmtDateOnly(o.contract_end) + "</span>" +
        (daysLeft !== null && o.active !== false
          ? (daysLeft < 0
              ? '<span class="text-expired">منتهي</span>'
              : daysLeft <= 7
                ? '<span class="text-soon">' + daysLeft + " يوم متبقي</span>"
                : '<span class="text-ok">' + daysLeft + " يوم متبقي</span>")
          : "") +
        "</div>" +
        '<div class="person-meta">تاريخ الإنشاء: ' + fmtDate(o.created_at) + "</div>" +
        '<div class="office-actions">' +
        '<button class="btn btn-primary btn-sm" data-act="open">فتح الصفحة</button>' +
        '<button class="btn btn-edit btn-sm" data-act="edit">تعديل</button>' +
        (o.active === false
          ? '<button class="btn btn-success btn-sm" data-act="enable">تفعيل</button>'
          : '<button class="btn btn-warning2 btn-sm" data-act="disable">تعطيل</button>') +
        '<button class="btn btn-danger btn-sm" data-act="delete">حذف</button>' +
        "</div>";

      el.addEventListener("click", function (e) {
        var act = e.target.getAttribute && e.target.getAttribute("data-act");
        if (!act) return;
        e.stopPropagation();
        if (act === "open") openOffice(o);
        else if (act === "edit") showOfficeForm(o);
        else if (act === "enable") toggleOffice(o, true);
        else if (act === "disable") toggleOffice(o, false);
        else if (act === "delete") removeOffice(o);
      });

      list.appendChild(el);
    });
  }

  async function toggleOffice(office, active) {
    try {
      await setOfficeActive(office, active);
      notify(active ? 'تم تفعيل مكتب "' + office.name + '"' : 'تم تعطيل مكتب "' + office.name + '"', "success");
      renderOffices();
    } catch (err) {
      notify("خطأ: " + err.message, "error");
    }
  }

  async function openOffice(office) {
    state.currentOfficeId = office.id;
    saveSession();
    try {
      await loadPeople(office.id);
      showOfficeView();
    } catch (err) {
      notify("خطأ: " + err.message, "error");
    }
  }

  async function removeOffice(office) {
    if (!confirm('هل أنت متأكد من حذف مكتب "' + office.name + '" مع كل بياناته؟')) return;
    try {
      await deleteOffice(office);
      notify("تم حذف المكتب", "success");
      renderOffices();
    } catch (err) {
      notify("خطأ: " + err.message, "error");
    }
  }

  function showOfficeForm(office) {
    var isEdit = !!office;
    var nameVal = office ? office.name : "";
    var userVal = office ? office.username : "";
    var passVal = office ? office.password : "";
    var phoneVal = office ? office.phone : "";
    var detailsVal = office ? office.details : "";
    var startVal = office && office.contract_start ? office.contract_start : todayISO();
    var endVal = office && office.contract_end ? office.contract_end : addDaysISO(365);
    var activeVal = office ? office.active !== false : true;

    openModal(
      isEdit ? "تعديل المكتب: " + office.name : "إضافة مكتب جديد",
      '<form id="officeForm">' +
        '<div class="form-group"><label>اسم المكتب *</label><input type="text" id="ofName" required value="' + escAttr(nameVal) + '" placeholder="مثال: مكتب الحاج كريم"></div>' +
        '<div class="form-group"><label>اسم المستخدم (للدخول) *</label><input type="text" id="ofUsername" required value="' + escAttr(userVal) + '" placeholder="مثال: office1" dir="ltr"></div>' +
        '<div class="form-group"><label>كلمة المرور *</label><input type="text" id="ofPassword" required value="' + escAttr(passVal) + '" placeholder="مثال: 1234" dir="ltr"></div>' +
        '<div class="form-group"><label>مدة العقد</label>' +
        '<div class="form-row">' +
        '<input type="date" id="ofStart" value="' + escAttr(startVal) + '">' +
        '<span class="form-sep">إلى</span>' +
        '<input type="date" id="ofEnd" value="' + escAttr(endVal) + '">' +
        "</div>" +
        "</div>" +
        '<div class="form-group"><label>حالة الحساب</label>' +
        '<select id="ofActive">' +
        '<option value="1"' + (activeVal ? " selected" : "") + '>مفعّل</option>' +
        '<option value="0"' + (!activeVal ? " selected" : "") + '>معطّل</option>' +
        "</select>" +
        "</div>" +
        '<div class="form-group"><label>رقم الهاتف</label><input type="tel" id="ofPhone" value="' + escAttr(phoneVal) + '" placeholder="مثال: 07xxxxxxx" dir="ltr"></div>' +
        '<div class="form-group"><label>تفاصيل</label><textarea id="ofDetails" placeholder="ملاحظات عن المكتب...">' + esc(detailsVal) + "</textarea></div>" +
        '<div class="form-actions">' +
        '<button type="submit" class="btn btn-primary">حفظ</button>' +
        '<button type="button" class="btn btn-ghost" id="ofCancel">إلغاء</button>' +
        "</div>" +
        "</form>"
    );

    document.getElementById("ofName").focus();

    document.getElementById("officeForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = document.getElementById("ofName").value.trim();
      var username = document.getElementById("ofUsername").value.trim();
      var password = document.getElementById("ofPassword").value;

      if (!name || !username || !password) {
        notify("الاسم واسم المستخدم وكلمة المرور مطلوبة", "error");
        return;
      }

      var startVal = document.getElementById("ofStart").value;
      var endVal = document.getElementById("ofEnd").value;
      if (startVal && endVal && new Date(endVal) < new Date(startVal)) {
        notify("تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية", "error");
        return;
      }

      var dup = state.offices.some(function (o) {
        return o.id !== (office ? office.id : null) && o.username === username;
      });
      if (dup) {
        notify("اسم المستخدم موجود مسبقاً", "error");
        return;
      }

      var patch = {
        name: name,
        username: username,
        password: password,
        phone: document.getElementById("ofPhone").value.trim(),
        details: document.getElementById("ofDetails").value.trim(),
        contract_start: startVal || null,
        contract_end: endVal || null,
        active: document.getElementById("ofActive").value === "1"
      };

      try {
        if (isEdit) {
          await updateOffice(office, patch);
          notify("تم تحديث المكتب", "success");
        } else {
          await createOffice(patch);
          notify("تم إنشاء المكتب", "success");
        }
        closeModal();
        renderOffices();
      } catch (err) {
        notify("خطأ: " + err.message, "error");
      }
    });

    document.getElementById("ofCancel").addEventListener("click", closeModal);
  }

  /* ===================== Office rendering (people) ===================== */

  function renderStats() {
    var total = state.people.reduce(function (acc, p) {
      return acc + personBalance(p);
    }, 0);
    document.getElementById("totalDebt").textContent = fmtMoney(total);
    document.getElementById("peopleCount").textContent = state.people.length;
  }

  function filteredPeople() {
    var q = state.searchQuery.trim().toLowerCase();
    if (!q) return state.people.slice();
    return state.people.filter(function (p) {
      return (
        (p.name || "").toLowerCase().indexOf(q) !== -1 ||
        (p.phone || "").toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function renderPeopleView() {
    document.getElementById("personView").classList.add("hidden");
    document.getElementById("peopleView").classList.remove("hidden");
    renderAll();
  }

  function renderAll() {
    renderStats();
    renderPeopleList();
  }

  function renderPeopleList() {
    var list = document.getElementById("peopleList");
    var empty = document.getElementById("emptyState");
    var people = filteredPeople();

    list.innerHTML = "";
    empty.classList.toggle("hidden", state.people.length > 0);

    if (state.people.length > 0 && people.length === 0) {
      list.innerHTML = '<div class="empty-inner">لا توجد نتائج مطابقة للبحث.</div>';
      return;
    }

    people.forEach(function (p) {
      var bal = personBalance(p);
      var txnCount = (p.transactions || []).length;

      var el = document.createElement("div");
      el.className = "person-item";
      el.innerHTML =
        '<div class="person-top">' +
        '<div class="person-avatar">' + esc(avatarLetter(p.name)) + "</div>" +
        '<div>' +
        '<div class="person-name">' + esc(p.name) + "</div>" +
        '<div class="person-phone">📱 ' + esc(p.phone || "—") + "</div>" +
        "</div>" +
        "</div>" +
        '<div class="person-debt ' + (bal <= 0 ? "zero" : "") + '">' +
        '<span class="debt-label">المستحق</span>' +
        '<span>' + fmtMoney(bal) + "</span>" +
        "</div>" +
        '<div class="person-meta">' + txnCount + " حركة • آخر تحديث: " + fmtDate(p.updated_at) + "</div>";

      el.addEventListener("click", function () {
        state.currentPersonId = p.id;
        renderPersonView();
      });

      list.appendChild(el);
    });
  }

  function renderPersonView() {
    var person = currentPerson();
    if (!person) {
      renderPeopleView();
      return;
    }

    var bal = personBalance(person);
    document.getElementById("peopleView").classList.add("hidden");
    document.getElementById("personView").classList.remove("hidden");

    document.getElementById("personCard").innerHTML =
      '<div class="person-hero">' +
      '<div class="person-avatar large">' + esc(avatarLetter(person.name)) + "</div>" +
      '<div>' +
      "<h2>" + esc(person.name) + "</h2>" +
      '<div class="phone-line">📱 ' + esc(person.phone || "—") + "</div>" +
      "</div>" +
      "</div>" +
      (person.details ? '<div class="details-line">' + esc(person.details) + "</div>" : "") +
      '<div class="debt-summary">' +
      '<div class="debt-col">' +
      '<span class="debt-label">إجمالي المستحق</span>' +
      '<div class="debt-big ' + (bal <= 0 ? "zero" : "") + '">' + fmtMoney(bal) + "</div>" +
      "</div>" +
      '<div class="debt-col">' +
      '<span class="debt-label">عدد الحركات</span>' +
      '<div class="debt-big" style="color:var(--muted);font-size:24px;">' + (person.transactions || []).length + "</div>" +
      "</div>" +
      '<div class="debt-col">' +
      '<span class="debt-label">تاريخ الإضافة</span>' +
      '<div class="debt-big" style="color:var(--muted);font-size:24px;">' + fmtDate(person.created_at) + "</div>" +
      "</div>" +
      "</div>";

    renderTransactions(person);
  }

  function renderTransactions(person) {
    var list = document.getElementById("transactionsList");
    var txns = (person.transactions || []).slice().reverse();

    document.getElementById("txnCount").textContent = txns.length;

    if (txns.length === 0) {
      list.innerHTML = '<div class="empty-inner">لا توجد حركات بعد. أضف "شراء مباشر" أو "تسديد".</div>';
      return;
    }

    list.innerHTML = "";
    txns.forEach(function (t) {
      var isPurchase = t.type === "purchase";
      var el = document.createElement("div");
      el.className = "txn-item";
      el.innerHTML =
        '<div class="txn-info">' +
        '<span class="txn-type ' + (isPurchase ? "purchase" : "payment") + '">' +
        (isPurchase ? "شراء مباشر" : "تسديد") +
        "</span>" +
        '<div class="txn-details">' + esc(t.details || "") + "</div>" +
        '<div class="txn-date">' + fmtDate(t.date) + "</div>" +
        "</div>" +
        '<div class="txn-amount ' + (isPurchase ? "plus" : "minus") + '">' +
        (isPurchase ? "+" : "-") + " " + fmtMoney(t.amount) +
        "</div>";

      list.appendChild(el);
    });
  }

  /* ===================== Forms (people/transactions) ===================== */

  function showPersonForm(person) {
    var isEdit = !!person;
    var nameVal = person ? person.name : "";
    var phoneVal = person ? person.phone : "";
    var detailsVal = person ? person.details : "";

    openModal(
      isEdit ? "تعديل بيانات الشخص" : "إضافة شخص جديد",
      '<form id="personForm">' +
        '<div class="form-group"><label>الاسم *</label><input type="text" id="pfName" required value="' + escAttr(nameVal) + '" placeholder="مثال: أحمد محمد"></div>' +
        '<div class="form-group"><label>رقم الهاتف</label><input type="tel" id="pfPhone" value="' + escAttr(phoneVal) + '" placeholder="مثال: 07xxxxxxx" dir="ltr"></div>' +
        '<div class="form-group"><label>تفاصيل</label><textarea id="pfDetails" placeholder="ملاحظات عن الشخص...">' + esc(detailsVal) + "</textarea></div>" +
        '<div class="form-actions">' +
        '<button type="submit" class="btn btn-primary">حفظ</button>' +
        '<button type="button" class="btn btn-ghost" id="pfCancel">إلغاء</button>' +
        (isEdit ? '<button type="button" class="btn btn-danger" id="pfDelete">حذف</button>' : "") +
        "</div>" +
        "</form>"
    );

    document.getElementById("pfName").focus();

    document.getElementById("personForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = document.getElementById("pfName").value.trim();
      if (!name) {
        notify("الاسم مطلوب", "error");
        return;
      }
      var phone = document.getElementById("pfPhone").value.trim();
      var details = document.getElementById("pfDetails").value.trim();

      try {
        if (isEdit) {
          await updatePerson(state.currentOfficeId, person, { name: name, phone: phone, details: details });
          notify("تم تحديث بيانات الشخص", "success");
        } else {
          await createPerson(state.currentOfficeId, { name: name, phone: phone, details: details });
          notify("تمت إضافة الشخص", "success");
        }
        closeModal();
        renderAll();
      } catch (err) {
        notify("خطأ: " + err.message, "error");
      }
    });

    document.getElementById("pfCancel").addEventListener("click", closeModal);

    if (isEdit) {
      document.getElementById("pfDelete").addEventListener("click", async function () {
        if (!confirm('هل أنت متأكد من حذف "' + person.name + '" مع كل حركاته؟')) return;
        try {
          await deletePerson(state.currentOfficeId, person);
          closeModal();
          notify("تم حذف الشخص", "success");
          renderPeopleView();
        } catch (err) {
          notify("خطأ: " + err.message, "error");
        }
      });
    }
  }

  function showTxnForm(type) {
    var person = currentPerson();
    if (!person) return;

    var isPurchase = type === "purchase";
    var title = isPurchase ? "شراء مباشر - " + person.name : "تسديد - " + person.name;

    var defaultAmount = "";
    if (!isPurchase) {
      var bal = personBalance(person);
      if (bal > 0) defaultAmount = bal;
    }

    var today = new Date().toISOString().slice(0, 10);

    openModal(
      title,
      '<form id="txnForm">' +
        '<div class="form-group"><label>المبلغ (' + (isPurchase ? "زاد على الدين" : "سدد من الدين") + ') *</label>' +
        '<input type="number" id="tfAmount" min="0.01" step="0.01" required value="' + escAttr(defaultAmount) + '" placeholder="0.00"></div>' +
        '<div class="form-group"><label>التاريخ *</label><input type="date" id="tfDate" required value="' + today + '"></div>' +
        '<div class="form-group"><label>التفاصيل</label><textarea id="tfDetails" placeholder="' + (isPurchase ? "مثال: بضاعة - قطعة كذا" : "مثال: دفعة نقدية") + '"></textarea></div>' +
        '<div class="form-actions">' +
        '<button type="submit" class="btn ' + (isPurchase ? "btn-danger" : "btn-success") + '">' + (isPurchase ? "تأكيد الشراء" : "تأكيد التسديد") + "</button>" +
        '<button type="button" class="btn btn-ghost" id="tfCancel">إلغاء</button>' +
        "</div>" +
        "</form>"
    );

    document.getElementById("tfAmount").focus();

    document.getElementById("txnForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var amount = parseFloat(document.getElementById("tfAmount").value);
      var dateStr = document.getElementById("tfDate").value;
      var details = document.getElementById("tfDetails").value.trim();

      if (!amount || amount <= 0) {
        notify("أدخل مبلغاً صحيحاً", "error");
        return;
      }

      var ts = dateStr ? new Date(dateStr + "T12:00:00").getTime() : Date.now();

      try {
        await addTransaction(state.currentOfficeId, person, {
          type: isPurchase ? "purchase" : "payment",
          amount: amount,
          details: details,
          date: ts
        });
        closeModal();
        renderPersonView();
        renderStats();
        notify(isPurchase ? "تم تسجيل الشراء وزيادة الدين" : "تم تسجيل التسديد", "success");
      } catch (err) {
        notify("خطأ: " + err.message, "error");
      }
    });

    document.getElementById("tfCancel").addEventListener("click", closeModal);
  }

  /* ===================== Backup ===================== */

  function exportBackup() {
    var payload = { version: 2, exportedAt: Date.now(), officeId: state.currentOfficeId, people: state.people };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    var stamp = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    a.href = url;
    a.download = "دفتر-الديون-نسخة-احتياطية-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    notify("تم تنزيل النسخة الاحتياطية بنجاح", "success");
  }

  function importBackup(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function () {
      try {
        var parsed = JSON.parse(reader.result);
        var people = parsed.people || parsed;
        if (!Array.isArray(people)) throw new Error("bad format");
        if (!confirm("سيتم استيراد البيانات إلى هذا المكتب. هل أنت متأكد؟")) return;

        for (var i = 0; i < people.length; i++) {
          var p = people[i];
          var person = await createPerson(state.currentOfficeId, {
            name: p.name,
            phone: p.phone || "",
            details: p.details || ""
          });
          var txns = p.transactions || [];
          for (var j = 0; j < txns.length; j++) {
            var t = txns[j];
            await addTransaction(state.currentOfficeId, person, {
              type: t.type,
              amount: t.amount,
              details: t.details || "",
              date: t.date
            });
          }
        }

        renderAll();
        notify("تم استيراد البيانات بنجاح", "success");
      } catch (err) {
        notify("الملف غير صالح أو حدث خطأ في الاستيراد", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  /* ===================== Init ===================== */

  async function boot() {
    try {
      await loadOffices();
      if (state.role === "office" || state.role === "admin") {
      if (state.role === "office" && state.currentOfficeId) {
        var office = currentOffice();
        if (office && office.active !== false && !isContractExpired(office)) {
          await loadPeople(state.currentOfficeId);
          showOfficeView();
          return;
        }
        clearSession();
        showLogin();
        return;
      }
        if (state.role === "admin") {
          showAdminView();
          return;
        }
      }
      showLogin();
    } catch (err) {
      notify("خطأ: " + err.message, "error");
      showLogin();
    }
  }

  function init() {
    loadSession();

    document.getElementById("addPersonBtn").addEventListener("click", function () {
      showPersonForm(null);
    });

    document.getElementById("searchInput").addEventListener("input", function (e) {
      state.searchQuery = e.target.value;
      renderPeopleList();
    });

    document.getElementById("officeSearch").addEventListener("input", renderOffices);

    document.getElementById("backBtn").addEventListener("click", renderPeopleView);

    document.getElementById("backToAdminBtn").addEventListener("click", function () {
      showAdminView();
    });

    document.getElementById("payBtn").addEventListener("click", function () {
      showTxnForm("payment");
    });

    document.getElementById("purchaseBtn").addEventListener("click", function () {
      showTxnForm("purchase");
    });

    document.getElementById("editPersonBtn").addEventListener("click", function () {
      var person = currentPerson();
      if (person) showPersonForm(person);
    });

    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", function (e) {
      if (e.target === this) closeModal();
    });

    document.getElementById("exportBtn").addEventListener("click", exportBackup);
    document.getElementById("importBtn").addEventListener("click", function () {
      document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", importBackup);

    document.getElementById("addOfficeBtn").addEventListener("click", function () {
      showOfficeForm(null);
    });

    document.getElementById("logoutBtn").addEventListener("click", async function () {
      await handleLogout();
      showLogin();
      state.people = [];
    });

    document.getElementById("adminLogoutBtn").addEventListener("click", async function () {
      await handleLogout();
      showLogin();
    });

    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var identifier = document.getElementById("loginEmail").value.trim();
      var password = document.getElementById("loginPassword").value;
      var msgBox = document.getElementById("loginMessage");
      var btn = document.getElementById("loginBtn");

      msgBox.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "جارٍ الدخول...";

      try {
        await handleLogin(identifier, password);
        saveSession();
        if (state.role === "admin") {
          showAdminView();
        } else {
          await loadPeople(state.currentOfficeId);
          showOfficeView();
        }
      } catch (err) {
        msgBox.textContent = err.message || "خطأ في تسجيل الدخول";
        msgBox.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "دخول";
      }
    });

    boot();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
