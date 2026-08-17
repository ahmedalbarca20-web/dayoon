(function () {
  "use strict";

  /* =====================================================
     SUPABASE
     ===================================================== */

  const CFG = window.SUPABASE_CONFIG || {};

  const SUPABASE_URL = CFG.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";

  let supabaseClient = null;

  if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY
  ) {
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
  } else {
    console.error("Supabase configuration missing");
  }


  /* =====================================================
     STATE
     ===================================================== */

  const state = {
    user: null,
    role: null,

    office: null,

    offices: [],
    people: [],
    transactions: [],

    currentPerson: null,

    search: ""
  };


  /* =====================================================
     HELPERS
     ===================================================== */

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


  function today() {
    const d = new Date();

    const month =
      String(d.getMonth() + 1).padStart(2, "0");

    const day =
      String(d.getDate()).padStart(2, "0");

    return `${d.getFullYear()}-${month}-${day}`;
  }


  function money(value) {
    const number =
      Number(value || 0);

    return new Intl.NumberFormat(
      "ar-IQ"
    ).format(number) + " د.ع";
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatDate(value) {
    if (!value) return "-";

    const d =
      new Date(value + "T00:00:00");

    if (Number.isNaN(d.getTime())) {
      return value;
    }

    return d.toLocaleDateString(
      "ar-IQ",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    );
  }


  function message(
    elementId,
    text,
    type = "info"
  ) {
    const el = $(elementId);

    if (!el) return;

    el.textContent = text;

    el.className =
      "login-message " + type;
  }


  function clearMessage(elementId) {
    const el = $(elementId);

    if (!el) return;

    el.textContent = "";
    el.className = "login-message";
  }


  function hideAllPages() {
    hide("loginPage");
    hide("adminPage");
    hide("officePage");
  }


  function setLoading(value) {
    const el = $("loadingScreen");

    if (!el) return;

    if (value) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }


  /* =====================================================
     ADMIN CHECK
     ===================================================== */

  async function checkAdmin(userId) {

    if (!supabaseClient || !userId) {
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


  /* =====================================================
     GET OFFICE
     ===================================================== */

  async function getOffice(userId) {

    if (!supabaseClient || !userId) {
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

    return data || null;
  }


  /* =====================================================
     CONTRACT CHECK
     ===================================================== */

  function contractIsValid(office) {

    if (!office) {
      return false;
    }

    if (office.active === false) {
      return false;
    }

    const now = new Date();

    if (office.contract_start) {

      const start =
        new Date(
          office.contract_start +
          "T00:00:00"
        );

      if (now < start) {
        return false;
      }
    }

    if (office.contract_end) {

      const end =
        new Date(
          office.contract_end +
          "T23:59:59"
        );

      if (now > end) {
        return false;
      }
    }

    return true;
  }


  function contractStatus(office) {

    if (!office.active) {
      return "معطل";
    }

    const now = new Date();

    if (
      office.contract_start &&
      now <
      new Date(
        office.contract_start +
        "T00:00:00"
      )
    ) {
      return "لم يبدأ";
    }

    if (
      office.contract_end &&
      now >
      new Date(
        office.contract_end +
        "T23:59:59"
      )
    ) {
      return "منتهي";
    }

    return "فعال";
  }


  /* =====================================================
     SHOW LOGIN
     ===================================================== */

  function showLogin() {

    hideAllPages();

    show("loginPage");

    clearMessage("loginMessage");

    const form =
      $("loginForm");

    if (form) {
      form.reset();
    }
  }


  /* =====================================================
     SHOW ADMIN
     ===================================================== */

  async function showAdmin() {

    state.role = "admin";

    hideAllPages();

    show("adminPage");

    await loadOffices();
  }


  /* =====================================================
     SHOW OFFICE
     ===================================================== */

  async function showOffice(office) {

    if (!office) {
      await logout();
      return;
    }

    state.office = office;

    state.role = "office";

    hideAllPages();

    show("officePage");

    if ($("officeTitle")) {
      $("officeTitle").textContent =
        office.name || "دفتر الديون";
    }

    if ($("officeStatus")) {

      $("officeStatus").textContent =
        `حساب المكتب • ${contractStatus(office)}`;
    }

    if ($("debtDate")) {
      $("debtDate").value = today();
    }

    if ($("paymentDate")) {
      $("paymentDate").value = today();
    }

    await loadPeople();
    await loadTransactions();

    renderStatistics();
    renderPeople();
  }


  /* =====================================================
     LOGIN
     ===================================================== */

  async function handleLogin(event) {

    event.preventDefault();

    if (!supabaseClient) {

      message(
        "loginMessage",
        "Supabase غير مربوط بشكل صحيح.",
        "error"
      );

      return;
    }

    const email =
      $("loginEmail")?.value
        .trim();

    const password =
      $("loginPassword")?.value || "";

    if (!email || !password) {

      message(
        "loginMessage",
        "أدخل البريد الإلكتروني وكلمة المرور.",
        "error"
      );

      return;
    }

    message(
      "loginMessage",
      "جارٍ تسجيل الدخول...",
      "info"
    );

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
        throw error;
      }

      const user =
        data?.user;

      if (!user) {
        throw new Error(
          "لم يتم العثور على المستخدم."
        );
      }

      state.user = user;

      /* ADMIN */

      const isAdmin =
        await checkAdmin(user.id);

      if (isAdmin) {

        await showAdmin();

        return;
      }

      /* OFFICE */

      const office =
        await getOffice(user.id);

      if (!office) {

        await supabaseClient.auth.signOut();

        message(
          "loginMessage",
          "هذا الحساب غير مرتبط بمكتب.",
          "error"
        );

        return;
      }

      if (!contractIsValid(office)) {

        await supabaseClient.auth.signOut();

        message(
          "loginMessage",
          "حساب المكتب غير فعال أو انتهت مدة العقد.",
          "error"
        );

        return;
      }

      await showOffice(office);

    } catch (error) {

      console.error(
        "Login:",
        error
      );

      message(
        "loginMessage",
        error.message ===
        "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : "تعذر تسجيل الدخول.",
        "error"
      );
    }
  }


  /* =====================================================
     LOGOUT
     ===================================================== */

  async function logout() {

    try {

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }

    } catch (error) {

      console.error(
        "Logout:",
        error
      );
    }

    state.user = null;
    state.role = null;
    state.office = null;

    state.people = [];
    state.transactions = [];

    state.currentPerson = null;

    showLogin();
  }


  /* =====================================================
     LOAD OFFICES
     ===================================================== */

  async function loadOffices() {

    if (!supabaseClient) return;

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

      message(
        "officeMessage",
        "تعذر تحميل المكاتب.",
        "error"
      );

      return;
    }

    state.offices =
      data || [];

    renderOffices();
  }


  /* =====================================================
     RENDER OFFICES
     ===================================================== */

  function renderOffices() {

    const container =
      $("officesList");

    if (!container) return;

    if (!state.offices.length) {

      container.innerHTML = `
        <div class="empty-state">
          لا توجد مكاتب حالياً.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.offices
        .map(office => {

          const status =
            contractStatus(office);

          const active =
            status === "فعال";

          return `
            <div class="office-card">

              <div class="office-card-header">

                <h3>
                  ${escapeHtml(
                    office.name
                  )}
                </h3>

                <span class="${
                  active
                    ? "status-active"
                    : "status-disabled"
                }">
                  ${status}
                </span>

              </div>

              <p>
                <strong>البريد:</strong>
                ${escapeHtml(
                  office.email
                )}
              </p>

              <p>
                <strong>بداية العقد:</strong>
                ${formatDate(
                  office.contract_start
                )}
              </p>

              <p>
                <strong>نهاية العقد:</strong>
                ${formatDate(
                  office.contract_end
                )}
              </p>

              <div class="office-actions">

                <button
                  type="button"
                  onclick="window.toggleOffice('${office.id}')"
                >
                  ${
                    office.active
                      ? "تعطيل المكتب"
                      : "تفعيل المكتب"
                  }
                </button>

              </div>

            </div>
          `;
        })
        .join("");
  }


  /* =====================================================
     CREATE OFFICE
     ===================================================== */

  async function createOffice(event) {

    event.preventDefault();

    if (!supabaseClient) {
      return;
    }

    const name =
      $("officeName")?.value.trim();

    const email =
      $("officeEmail")?.value.trim();

    const password =
      $("officePassword")?.value;

    const contractStart =
      $("contractStart")?.value || null;

    const contractEnd =
      $("contractEnd")?.value || null;

    if (!name || !email || !password) {

      message(
        "officeMessage",
        "أكمل بيانات المكتب.",
        "error"
      );

      return;
    }

    if (
      contractStart &&
      contractEnd &&
      contractEnd < contractStart
    ) {

      message(
        "officeMessage",
        "تاريخ نهاية العقد يجب أن يكون بعد البداية.",
        "error"
      );

      return;
    }

    message(
      "officeMessage",
      "جارٍ إنشاء حساب المكتب...",
      "info"
    );

    try {

      /*
       * ملاحظة:
       * signUp من المتصفح يستخدم لإنشاء مستخدم Auth.
       *
       * إذا كان Email Confirmation مفعلاً
       * في Supabase، يجب تأكيد البريد قبل تسجيل الدخول.
       */

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .signUp({
            email,
            password
          });

      if (error) {
        throw error;
      }

      const user =
        data?.user;

      if (!user) {
        throw new Error(
          "لم يتم إنشاء حساب Auth."
        );
      }

      const {
        error: officeError
      } =
        await supabaseClient
          .from("offices")
          .insert({
            user_id: user.id,
            name,
            email,
            active: true,
            contract_start:
              contractStart,
            contract_end:
              contractEnd
          });

      if (officeError) {
        throw officeError;
      }

      message(
        "officeMessage",
        "تم إنشاء المكتب بنجاح.",
        "success"
      );

      $("officeForm")?.reset();

      /*
       * signUp قد يغير جلسة المستخدم.
       * لذلك نخرج ونرجع المستخدم لصفحة الدخول.
       */

      await supabaseClient.auth.signOut();

      await loadOffices();

    } catch (error) {

      console.error(
        "Create office:",
        error
      );

      message(
        "officeMessage",
        error.message ||
        "تعذر إنشاء المكتب.",
        "error"
      );
    }
  }


  /* =====================================================
     TOGGLE OFFICE
     ===================================================== */

  async function toggleOffice(id) {

    const office =
      state.offices.find(
        x => x.id === id
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
        .eq("id", id);

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

    await loadOffices();
  }


  window.toggleOffice =
    toggleOffice;


  /* =====================================================
     LOAD PEOPLE
     ===================================================== */

  async function loadPeople() {

    if (!state.office) return;

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
        "تعذر تحميل الأشخاص."
      );

      return;
    }

    state.people =
      data || [];
  }


  /* =====================================================
     LOAD TRANSACTIONS
     ===================================================== */

  async function loadTransactions() {

    if (!state.office) return;

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
          "transaction_date",
          {
            ascending: false
          }
        );

    if (error) {

      console.error(
        "Load transactions:",
        error
      );

      state.transactions = [];

      return;
    }

    state.transactions =
      data || [];
  }


  /* =====================================================
     ADD / UPDATE PERSON
     ===================================================== */

  async function savePerson(event) {

    event.preventDefault();

    if (!state.office) {
      return;
    }

    const id =
      $("personId")?.value || "";

    const name =
      $("personName")?.value.trim();

    const phone =
      $("personPhone")?.value.trim();

    const accountType =
      $("accountType")?.value;

    const amount =
      Number(
        $("personAmount")?.value || 0
      );

    const debtDate =
      $("debtDate")?.value ||
      today();

    const dueDate =
      $("dueDate")?.value ||
      null;

    const notes =
      $("personNotes")?.value.trim() ||
      null;

    if (!name) {

      alert(
        "أدخل اسم الشخص."
      );

      return;
    }

    if (amount < 0) {

      alert(
        "المبلغ غير صحيح."
      );

      return;
    }

    const payload = {

      name,

      phone,

      account_type:
        accountType,

      amount,

      debt_date:
        debtDate,

      due_date:
        dueDate,

      notes,

      updated_at:
        new Date().toISOString()
    };


    try {

      if (id) {

        const {
          error
        } =
          await supabaseClient
            .from("people")
            .update(payload)
            .eq("id", id)
            .eq(
              "office_id",
              state.office.id
            );

        if (error) {
          throw error;
        }

      } else {

        const {
          error
        } =
          await supabaseClient
            .from("people")
            .insert({
              office_id:
                state.office.id,

              ...payload
            });

        if (error) {
          throw error;
        }
      }


      resetPersonForm();

      await loadPeople();
      await loadTransactions();

      renderStatistics();
      renderPeople();

      closePersonDetails();

    } catch (error) {

      console.error(
        "Save person:",
        error
      );

      alert(
        error.message ||
        "تعذر حفظ الشخص."
      );
    }
  }


  /* =====================================================
     EDIT PERSON
     ===================================================== */

  function editPerson(id) {

    const person =
      state.people.find(
        x => x.id === id
      );

    if (!person) return;

    $("personId").value =
      person.id;

    $("personName").value =
      person.name || "";

    $("personPhone").value =
      person.phone || "";

    $("accountType").value =
      person.account_type ||
      "debtor";

    $("personAmount").value =
      person.amount || 0;

    $("debtDate").value =
      person.debt_date ||
      today();

    $("dueDate").value =
      person.due_date || "";

    $("personNotes").value =
      person.notes || "";

    $("personFormTitle").textContent =
      "تعديل بيانات الشخص";

    show("cancelEditBtn");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  window.editPerson =
    editPerson;


  /* =====================================================
     DELETE PERSON
     ===================================================== */

  async function deletePerson(id) {

    const person =
      state.people.find(
        x => x.id === id
      );

    if (!person) return;

    const ok =
      confirm(
        `هل تريد حذف ${person.name}؟`
      );

    if (!ok) return;

    try {

      const {
        error
      } =
        await supabaseClient
          .from("people")
          .delete()
          .eq("id", id)
          .eq(
            "office_id",
            state.office.id
          );

      if (error) {
        throw error;
      }

      if (
        state.currentPerson?.id === id
      ) {
        closePersonDetails();
      }

      await loadPeople();
      await loadTransactions();

      renderStatistics();
      renderPeople();

    } catch (error) {

      console.error(
        "Delete person:",
        error
      );

      alert(
        "تعذر حذف الشخص."
      );
    }
  }


  window.deletePerson =
    deletePerson;


  /* =====================================================
     RESET PERSON FORM
     ===================================================== */

  function resetPersonForm() {

    const form =
      $("personForm");

    if (form) {
      form.reset();
    }

    if ($("personId")) {
      $("personId").value = "";
    }

    if ($("debtDate")) {
      $("debtDate").value =
        today();
    }

    $("personFormTitle").textContent =
      "إضافة شخص";

    hide("cancelEditBtn");
  }


  /* =====================================================
     RENDER PEOPLE
     ===================================================== */

  function renderPeople() {

    const container =
      $("peopleList");

    if (!container) return;

    let people =
      [...state.people];

    const search =
      state.search
        .trim()
        .toLowerCase();

    if (search) {

      people =
        people.filter(person => {

          const name =
            String(
              person.name || ""
            ).toLowerCase();

          const phone =
            String(
              person.phone || ""
            ).toLowerCase();

          return (
            name.includes(search) ||
            phone.includes(search)
          );
        });
    }


    if (!people.length) {

      container.innerHTML = `
        <div class="empty-state">
          لا توجد حسابات.
        </div>
      `;

      return;
    }


    container.innerHTML =
      people.map(person => {

        const debtor =
          person.account_type ===
          "debtor";

        const typeText =
          debtor
            ? "مديون لي"
            : "أنا مديون له";

        const typeClass =
          debtor
            ? "status-active"
            : "status-disabled";


        const payments =
          getPersonPayments(
            person.id
          );

        const paid =
          payments.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          );

        const original =
          Number(
            person.amount || 0
          );

        const remaining =
          Math.max(
            original - paid,
            0
          );


        return `
          <div class="person-card">

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                align-items:center;
              "
            >

              <h3>
                ${escapeHtml(
                  person.name
                )}
              </h3>

              <span class="${typeClass}">
                ${typeText}
              </span>

            </div>


            ${
              person.phone
                ? `
                  <p>
                    📱
                    ${escapeHtml(
                      person.phone
                    )}
                  </p>
                `
                : ""
            }


            <p>
              <strong>
                المبلغ:
              </strong>

              ${money(original)}
            </p>


            <p>
              <strong>
                المتبقي:
              </strong>

              ${money(remaining)}
            </p>


            <p>
              <strong>
                تاريخ الدين:
              </strong>

              ${formatDate(
                person.debt_date
              )}
            </p>


            <p>
              <strong>
                الاستحقاق:
              </strong>

              ${formatDate(
                person.due_date
              )}
            </p>


            ${
              person.notes
                ? `
                  <p>
                    <strong>
                      ملاحظات:
                    </strong>

                    ${escapeHtml(
                      person.notes
                    )}
                  </p>
                `
                : ""
            }


            <div
              style="
                display:grid;
                grid-template-columns:
                  repeat(2, 1fr);
                gap:8px;
                margin-top:15px;
              "
            >

              <button
                type="button"
                onclick="
                  window.openPerson('${person.id}')
                "
              >
                فتح
              </button>


              <button
                type="button"
                onclick="
                  window.editPerson('${person.id}')
                "
              >
                تعديل
              </button>


              <button
                type="button"
                onclick="
                  window.deletePerson('${person.id}')
                "
                style="
                  color:#dc2626;
                  background:#fef2f2;
                "
              >
                حذف
              </button>

            </div>

          </div>
        `;

      }).join("");
  }


  /* =====================================================
     PERSON PAYMENTS
     ===================================================== */

  function getPersonPayments(
    personId
  ) {

    return state.transactions
      .filter(
        transaction =>
          transaction.person_id ===
          personId &&
          transaction.type ===
          "payment"
      );
  }


  /* =====================================================
     OPEN PERSON
     ===================================================== */

  async function openPerson(id) {

    const person =
      state.people.find(
        x => x.id === id
      );

    if (!person) return;

    state.currentPerson =
      person;

    const payments =
      getPersonPayments(id);

    const original =
      Number(
        person.amount || 0
      );

    const paid =
      payments.reduce(
        (sum, item) =>
          sum +
          Number(
            item.amount || 0
          ),
        0
      );

    const remaining =
      Math.max(
        original - paid,
        0
      );


    $("detailsName").textContent =
      person.name;


    $("detailsType").textContent =
      person.account_type ===
      "debtor"
        ? "مديون لي"
        : "أنا مديون له";


    $("personDetails").innerHTML = `

      <div class="cards">

        <div class="person-card">

          <h3>
            المبلغ الأصلي
          </h3>

          <p>
            ${money(original)}
          </p>

        </div>


        <div class="person-card">

          <h3>
            المدفوع
          </h3>

          <p>
            ${money(paid)}
          </p>

        </div>


        <div class="person-card">

          <h3>
            المتبقي
          </h3>

          <p>
            ${money(remaining)}
          </p>

        </div>

      </div>


      <div
        style="
          margin-top:20px;
          padding:18px;
          background:#f8fafc;
          border-radius:14px;
        "
      >

        <p>
          <strong>
            📅 تاريخ الدين:
          </strong>

          ${formatDate(
            person.debt_date
          )}
        </p>


        <p>
          <strong>
            📅 تاريخ الاستحقاق:
          </strong>

          ${formatDate(
            person.due_date
          )}
        </p>


        ${
          person.phone
            ? `
              <p>
                <strong>
                  📱 الهاتف:
                </strong>

                ${escapeHtml(
                  person.phone
                )}
              </p>
            `
            : ""
        }


        ${
          person.notes
            ? `
              <p>
                <strong>
                  📝 الملاحظات:
                </strong>

                ${escapeHtml(
                  person.notes
                )}
              </p>
            `
            : ""
        }

      </div>
    `;


    renderTransactions(
      person.id
    );

    show("personDetailsPanel");

    if ($("paymentDate")) {
      $("paymentDate").value =
        today();
    }

    window.scrollTo({
      top:
        document.body.scrollHeight,
      behavior: "smooth"
    });
  }


  window.openPerson =
    openPerson;


  /* =====================================================
     CLOSE PERSON
     ===================================================== */

  function closePersonDetails() {

    state.currentPerson =
      null;

    hide("personDetailsPanel");
  }


  /* =====================================================
     ADD PAYMENT
     ===================================================== */

  async function addPayment(event) {

    event.preventDefault();

    const person =
      state.currentPerson;

    if (!person) {
      return;
    }

    const amount =
      Number(
        $("paymentAmount")?.value ||
        0
      );

    const date =
      $("paymentDate")?.value ||
      today();

    const notes =
      $("paymentNotes")?.value.trim() ||
      null;

    if (amount <= 0) {

      alert(
        "أدخل مبلغ الدفعة."
      );

      return;
    }


    const payments =
      getPersonPayments(
        person.id
      );

    const paid =
      payments.reduce(
        (sum, item) =>
          sum +
          Number(
            item.amount || 0
          ),
        0
      );

    const remaining =
      Math.max(
        Number(
          person.amount || 0
        ) - paid,
        0
      );


    if (amount > remaining) {

      alert(
        `المبلغ أكبر من المتبقي (${money(
          remaining
        )}).`
      );

      return;
    }


    try {

      const {
        error
      } =
        await supabaseClient
          .from("transactions")
          .insert({

            office_id:
              state.office.id,

            person_id:
              person.id,

            type:
              "payment",

            amount,

            transaction_date:
              date,

            notes
          });

      if (error) {
        throw error;
      }


      $("paymentForm")?.reset();

      if ($("paymentDate")) {
        $("paymentDate").value =
          today();
      }


      await loadTransactions();

      renderStatistics();

      await openPerson(
        person.id
      );

      renderPeople();

    } catch (error) {

      console.error(
        "Add payment:",
        error
      );

      alert(
        error.message ||
        "تعذر تسجيل الدفعة."
      );
    }
  }


  /* =====================================================
     RENDER TRANSACTIONS
     ===================================================== */

  function renderTransactions(
    personId
  ) {

    const container =
      $("transactionsList");

    if (!container) return;

    const list =
      state.transactions
        .filter(
          item =>
            item.person_id ===
            personId
        )
        .sort(
          (a, b) =>
            String(
              b.transaction_date
            )
              .localeCompare(
                String(
                  a.transaction_date
                )
              )
        );


    if (!list.length) {

      container.innerHTML = `
        <div class="empty-state">
          لا توجد حركات لهذا الحساب.
        </div>
      `;

      return;
    }


    container.innerHTML = `

      <h2>
        الحركات
      </h2>

      <div class="cards">

        ${
          list.map(item => {

            const isPayment =
              item.type ===
              "payment";

            return `

              <div class="person-card">

                <h3>
                  ${
                    isPayment
                      ? "💵 دفعة"
                      : "📒 دين"
                  }
                </h3>

                <p>
                  <strong>
                    المبلغ:
                  </strong>

                  ${money(
                    item.amount
                  )}
                </p>

                <p>
                  <strong>
                    التاريخ:
                  </strong>

                  ${formatDate(
                    item.transaction_date
                  )}
                </p>

                ${
                  item.notes
                    ? `
                      <p>
                        <strong>
                          الملاحظات:
                        </strong>

                        ${escapeHtml(
                          item.notes
                        )}
                      </p>
                    `
                    : ""
                }

              </div>

            `;

          }).join("")
        }

      </div>
    `;
  }


  /* =====================================================
     STATISTICS
     ===================================================== */

  function renderStatistics() {

    const container =
      $("statistics");

    if (!container) return;


    let totalDebtor = 0;
    let totalCreditor = 0;

    let totalPaid = 0;


    state.people.forEach(person => {

      const amount =
        Number(
          person.amount || 0
        );

      if (
        person.account_type ===
        "debtor"
      ) {

        totalDebtor +=
          amount;

      } else {

        totalCreditor +=
          amount;
      }

    });


    state.transactions
      .filter(
        item =>
          item.type ===
          "payment"
      )
      .forEach(item => {

        totalPaid +=
          Number(
            item.amount || 0
          );

      });


    container.innerHTML = `

      <div class="person-card">

        <h3>
          👥 عدد الأشخاص
        </h3>

        <p>
          ${state.people.length}
        </p>

      </div>


      <div class="person-card">

        <h3>
          🟢 لي عند الآخرين
        </h3>

        <p>
          ${money(totalDebtor)}
        </p>

      </div>


      <div class="person-card">

        <h3>
          🔴 عليّ للآخرين
        </h3>

        <p>
          ${money(totalCreditor)}
        </p>

      </div>


      <div class="person-card">

        <h3>
          💵 إجمالي الدفعات
        </h3>

        <p>
          ${money(totalPaid)}
        </p>

      </div>

    `;
  }


  /* =====================================================
     SEARCH
     ===================================================== */

  function handleSearch(event) {

    state.search =
      event.target.value || "";

    renderPeople();
  }


  /* =====================================================
     INIT EVENTS
     ===================================================== */

  function bindEvents() {

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


    $("officeForm")
      ?.addEventListener(
        "submit",
        createOffice
      );


    $("personForm")
      ?.addEventListener(
        "submit",
        savePerson
      );


    $("cancelEditBtn")
      ?.addEventListener(
        "click",
        resetPersonForm
      );


    $("searchInput")
      ?.addEventListener(
        "input",
        handleSearch
      );


    $("closeDetailsBtn")
      ?.addEventListener(
        "click",
        closePersonDetails
      );


    $("paymentForm")
      ?.addEventListener(
        "submit",
        addPayment
      );
  }


  /* =====================================================
     AUTH STATE
     ===================================================== */

  function listenAuth() {

    if (!supabaseClient) {
      return;
    }

    supabaseClient.auth
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
            state.role = null;
            state.office = null;

            showLogin();

            return;
          }

        }
      );
  }


  /* =====================================================
     START
     ===================================================== */

  async function start() {

    console.log(
      "Starting Debt Book..."
    );

    bindEvents();

    listenAuth();

    if (!supabaseClient) {

      setLoading(false);

      showLogin();

      message(
        "loginMessage",
        "Supabase configuration missing.",
        "error"
      );

      return;
    }


    try {

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .getSession();

      if (error) {
        throw error;
      }

      const session =
        data?.session;


      if (!session) {

        console.log(
          "No Supabase session"
        );

        showLogin();

        setLoading(false);

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

        await showAdmin();

      } else {

        const office =
          await getOffice(
            session.user.id
          );

        if (
          office &&
          contractIsValid(
            office
          )
        ) {

          await showOffice(
            office
          );

        } else {

          await supabaseClient.auth
            .signOut();

          showLogin();
        }
      }

    } catch (error) {

      console.error(
        "Startup:",
        error
      );

      showLogin();

    } finally {

      setLoading(false);
    }
  }


  /* =====================================================
     DOM READY
     ===================================================== */

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