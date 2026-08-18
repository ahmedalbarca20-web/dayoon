(function () {

  "use strict";

  console.log("Debt Book starting...");


  /* =====================================================
     STATE
  ===================================================== */

  const state = {

    db: null,

    user: null,

    session: null,

    office: null,

    people: [],

    transactions: [],

    currentPerson: null

  };


  /* =====================================================
     DOM
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


  function loadingDone() {

    hide("loadingScreen");

  }


  /* =====================================================
     FORMAT
  ===================================================== */

  function money(value) {

    return Number(value || 0)
      .toLocaleString("ar-IQ") + " د.ع";

  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  function formatDate(value) {

    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleString(
      "ar-IQ",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  }


  /* =====================================================
     TOAST
  ===================================================== */

  function toast(
    message,
    type = "success"
  ) {

    const el = $("toast");

    if (!el) return;

    el.textContent = message;

    el.className =
      "toast " +
      (type === "error"
        ? "error"
        : "");

    clearTimeout(
      toast.timer
    );

    toast.timer =
      setTimeout(
        () => {
          el.classList.add(
            "hidden"
          );
        },
        3000
      );

  }


  /* =====================================================
     SUPABASE CONNECTION
  ===================================================== */

  function createDatabase() {

    if (
      !window.supabase ||
      typeof window.supabase.createClient !==
      "function"
    ) {

      console.error(
        "Supabase JS not loaded"
      );

      return null;
    }


    const cfg =
      window.SUPABASE_CONFIG;


    if (!cfg) {

      console.error(
        "supabase-config.js لم يتم تحميله"
      );

      return null;
    }


    const url =
      cfg.SUPABASE_URL ||
      cfg.supabaseUrl ||
      "";


    const key =
      cfg.SUPABASE_ANON_KEY ||
      cfg.supabaseAnonKey ||
      cfg.SUPABASE_PUBLISHABLE_KEY ||
      "";


    if (!url || !key) {

      console.error(
        "Supabase configuration missing"
      );

      return null;
    }


    try {

      return window.supabase.createClient(
        url,
        key,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

    } catch (error) {

      console.error(
        "Supabase createClient:",
        error
      );

      return null;
    }

  }


  /* =====================================================
     LOGIN SCREEN
  ===================================================== */

  function showLogin() {

    loadingDone();

    show("loginScreen");

    hide("appScreen");

    hide("personDetails");

  }


  function showApp() {

    loadingDone();

    hide("loginScreen");

    show("appScreen");

  }


  /* =====================================================
     LOGIN
  ===================================================== */

  async function login(
    email,
    password
  ) {

    if (!state.db) {

      toast(
        "Supabase غير متصل",
        "error"
      );

      return;
    }


    try {

      const {
        data,
        error
      } =
        await state.db.auth
          .signInWithPassword({
            email:
              email.trim(),
            password
          });


      if (error) {

        console.error(
          "Auth login:",
          error
        );

        toast(
          "البريد أو كلمة المرور غير صحيحة",
          "error"
        );

        return;
      }


      state.session =
        data.session;

      state.user =
        data.user;


      await loadOffice();

      await loadData();


      showApp();


    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      toast(
        "حدث خطأ أثناء تسجيل الدخول",
        "error"
      );

    }

  }


  /* =====================================================
     LOGOUT
  ===================================================== */

  async function logout() {

    if (!state.db) return;

    try {

      await state.db.auth.signOut();

    } catch (error) {

      console.error(
        "Logout:",
        error
      );

    }


    state.user = null;
    state.session = null;
    state.office = null;
    state.people = [];
    state.transactions = [];


    showLogin();

  }


  /* =====================================================
     AUTH LISTENER
  ===================================================== */

  function setupAuth() {

    if (!state.db) return;


    state.db.auth.onAuthStateChange(
      (event, session) => {

        console.log(
          "Supabase Auth:",
          event
        );


        if (
          event === "SIGNED_OUT"
        ) {

          state.user = null;
          state.session = null;

          showLogin();

        }

      }
    );

  }


  /* =====================================================
     OFFICE
  ===================================================== */

  async function loadOffice() {

    if (
      !state.db ||
      !state.user
    ) {
      return;
    }


    try {

      const {
        data,
        error
      } =
        await state.db
          .from("offices")
          .select("*")
          .eq(
            "user_id",
            state.user.id
          )
          .maybeSingle();


      if (error) {

        console.warn(
          "Office load:",
          error
        );

        state.office = null;

        return;
      }


      state.office =
        data || null;


    } catch (error) {

      console.error(
        "loadOffice:",
        error
      );

      state.office = null;

    }

  }


  /* =====================================================
     LOAD DATA
  ===================================================== */

  async function loadData() {

    if (!state.db) return;


    try {

      let peopleQuery =
        state.db
          .from("people")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          );


      /*
        إذا الحساب مربوط بمكتب،
        نعرض بيانات هذا المكتب فقط.
      */

      if (
        state.office &&
        state.office.id
      ) {

        peopleQuery =
          peopleQuery.eq(
            "office_id",
            state.office.id
          );

      }


      const {
        data: people,
        error: peopleError
      } =
        await peopleQuery;


      if (peopleError) {

        console.error(
          "People:",
          peopleError
        );

        toast(
          "تعذر تحميل الأشخاص",
          "error"
        );

        return;
      }


      state.people =
        people || [];


      /*
        تحميل حركات الأشخاص
      */

      const ids =
        state.people.map(
          person => person.id
        );


      if (!ids.length) {

        state.transactions = [];

        calculateBalances();

        renderPeople();

        return;
      }


      const {
        data: transactions,
        error: transactionError
      } =
        await state.db
          .from("transactions")
          .select("*")
          .in(
            "person_id",
            ids
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );


      if (transactionError) {

        console.error(
          "Transactions:",
          transactionError
        );

        state.transactions = [];

      } else {

        state.transactions =
          transactions || [];

      }


      calculateBalances();

      renderPeople();


    } catch (error) {

      console.error(
        "loadData:",
        error
      );

    }

  }


  /* =====================================================
     BALANCES
  ===================================================== */

  function calculateBalances() {

    state.people.forEach(
      person => {

        let debt = 0;

        let payments = 0;


        const movements =
          state.transactions.filter(
            transaction =>
              transaction.person_id ===
              person.id
          );


        movements.forEach(
          transaction => {

            const amount =
              Number(
                transaction.amount || 0
              );


            if (
              transaction.type ===
              "debt"
            ) {

              debt += amount;

            }


            if (
              transaction.type ===
              "payment"
            ) {

              payments += amount;

            }

          }
        );


        /*
          السالب = مطلوب
          الموجب = دائن
        */

        person.totalDebt =
          debt;

        person.totalPayments =
          payments;

        person.balance =
          payments - debt;

      }
    );

  }


  /* =====================================================
     DASHBOARD
  ===================================================== */

  function renderPeople() {

    const list =
      $("peopleList");


    if (!list) return;


    if (!state.people.length) {

      list.innerHTML = `

        <div class="empty">

          <div class="empty-icon">
            👥
          </div>

          <h3>
            لا يوجد أشخاص
          </h3>

          <p>
            اضغط على إضافة شخص للبدء
          </p>

        </div>

      `;

      return;
    }


    list.innerHTML =
      state.people.map(
        person => {

          const balance =
            Number(
              person.balance || 0
            );


          let balanceHTML;


          if (balance < 0) {

            balanceHTML = `

              <div class="person-balance balance-debt">

                <span class="balance-icon">
                  🔴
                </span>

                <strong>
                  -${money(
                    Math.abs(balance)
                  )}
                </strong>

              </div>

            `;

          } else if (balance > 0) {

            balanceHTML = `

              <div class="person-balance balance-credit">

                <span class="balance-icon">
                  🟢
                </span>

                <strong>
                  +${money(balance)}
                </strong>

              </div>

            `;

          } else {

            balanceHTML = `

              <div class="person-balance balance-clear">

                <span class="balance-icon">
                  ⚪
                </span>

                <strong>
                  0 د.ع
                </strong>

              </div>

            `;

          }


          return `

            <div
              class="person-card"
              data-person-id="${escapeHTML(
                person.id
              )}"
            >

              <div class="person-main">

                <div class="avatar">
                  ${escapeHTML(
                    (
                      person.name ||
                      "؟"
                    ).charAt(0)
                  )}
                </div>


                <div class="person-data">

                  <h3>
                    ${escapeHTML(
                      person.name
                    )}
                  </h3>

                  ${
                    person.phone
                      ? `
                        <div class="person-phone">
                          ${escapeHTML(
                            person.phone
                          )}
                        </div>
                      `
                      : ""
                  }

                </div>

              </div>


              ${balanceHTML}


              <button
                class="open-person"
                type="button"
                data-open-person="${escapeHTML(
                  person.id
                )}"
              >
                فتح
              </button>

            </div>

          `;

        }
      ).join("");


    list
      .querySelectorAll(
        "[data-open-person]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              openPerson(
                button.dataset.openPerson
              );

            }
          );

        }
      );

  }


  /* =====================================================
     PERSON DETAILS
  ===================================================== */

  function openPerson(
    personId
  ) {

    const person =
      state.people.find(
        item =>
          item.id === personId
      );


    if (!person) {

      toast(
        "الشخص غير موجود",
        "error"
      );

      return;
    }


    state.currentPerson =
      person;


    renderPersonDetails();

    show("personDetails");

  }


  function renderPersonDetails() {

    const container =
      $("personDetails");


    const person =
      state.currentPerson;


    if (
      !container ||
      !person
    ) {
      return;
    }


    const transactions =
      state.transactions
        .filter(
          item =>
            item.person_id ===
            person.id
        )
        .sort(
          (a, b) =>
            new Date(
              b.created_at
            ) -
            new Date(
              a.created_at
            )
        );


    let debt = 0;

    let payments = 0;


    transactions.forEach(
      transaction => {

        const amount =
          Number(
            transaction.amount || 0
          );


        if (
          transaction.type ===
          "debt"
        ) {
          debt += amount;
        }


        if (
          transaction.type ===
          "payment"
        ) {
          payments += amount;
        }

      }
    );


    const balance =
      payments - debt;


    let status;

    if (balance < 0) {

      status = {
        text: "مطلوب",
        amount:
          "-" +
          money(
            Math.abs(balance)
          ),
        className:
          "details-debt"
      };

    } else if (balance > 0) {

      status = {
        text: "دائن",
        amount:
          "+" +
          money(balance),
        className:
          "details-credit"
      };

    } else {

      status = {
        text: "مسدد",
        amount:
          "0 د.ع",
        className:
          "details-clear"
      };

    }


    container.innerHTML = `

      <div class="details-header">

        <button
          id="closeDetails"
          class="icon-btn"
          type="button"
        >
          ×
        </button>


        <div class="big-avatar">
          ${escapeHTML(
            (
              person.name ||
              "؟"
            ).charAt(0)
          )}
        </div>


        <div class="details-person-info">

          <h2>
            ${escapeHTML(
              person.name
            )}
          </h2>

          ${
            person.phone
              ? `
                <div>
                  📱 ${escapeHTML(
                    person.phone
                  )}
                </div>
              `
              : ""
          }

          ${
            person.notes
              ? `
                <div>
                  📝 ${escapeHTML(
                    person.notes
                  )}
                </div>
              `
              : ""
          }

        </div>

      </div>


      <div
        class="person-status-card ${status.className}"
      >

        <span>
          ${status.text}
        </span>

        <strong>
          ${status.amount}
        </strong>

      </div>


      <div class="summary-grid">

        <div class="summary-box">

          <span>
            مجموع الديون
          </span>

          <strong>
            ${money(debt)}
          </strong>

        </div>


        <div class="summary-box">

          <span>
            مجموع التسديدات
          </span>

          <strong>
            ${money(payments)}
          </strong>

        </div>


        <div class="summary-box ${status.className}">

          <span>
            المتبقي
          </span>

          <strong>
            ${status.amount}
          </strong>

        </div>


        <div class="summary-box">

          <span>
            عدد الحركات
          </span>

          <strong>
            ${transactions.length}
          </strong>

        </div>

      </div>


      <div class="action-row">

        <button
          id="addDebtBtn"
          class="btn btn-danger"
          type="button"
        >
          + إضافة دين
        </button>


        <button
          id="addPaymentBtn"
          class="btn btn-success"
          type="button"
        >
          + تسجيل سداد
        </button>


        <button
          id="editPersonBtn"
          class="btn btn-secondary"
          type="button"
        >
          تعديل البيانات
        </button>


        <button
          id="deletePersonBtn"
          class="btn btn-secondary"
          type="button"
        >
          حذف الشخص
        </button>

      </div>


      <div class="history">

        <div class="history-title">

          <h3>
            سجل الحركات
          </h3>

          <span>
            ${transactions.length} حركة
          </span>

        </div>


        ${
          transactions.length
            ?
            transactions
              .map(
                renderTransaction
              )
              .join("")
            :
            `
              <div class="empty-history">
                لا توجد حركات
              </div>
            `
        }

      </div>

    `;


    $("closeDetails")
      ?.addEventListener(
        "click",
        () => {

          hide(
            "personDetails"
          );

        }
      );


    $("addDebtBtn")
      ?.addEventListener(
        "click",
        () => {

          openTransactionModal(
            "debt"
          );

        }
      );


    $("addPaymentBtn")
      ?.addEventListener(
        "click",
        () => {

          openTransactionModal(
            "payment"
          );

        }
      );


    $("editPersonBtn")
      ?.addEventListener(
        "click",
        () => {

          openPersonModal(
            person
          );

        }
      );


    $("deletePersonBtn")
      ?.addEventListener(
        "click",
        () => {

          deletePerson(
            person.id
          );

        }
      );


    container
      .querySelectorAll(
        "[data-edit-transaction]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const transaction =
                transactions.find(
                  item =>
                    item.id ===
                    button.dataset
                      .editTransaction
                );


              if (transaction) {

                editTransaction(
                  transaction
                );

              }

            }
          );

        }
      );


    container
      .querySelectorAll(
        "[data-delete-transaction]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              deleteTransaction(
                button.dataset
                  .deleteTransaction
              );

            }
          );

        }
      );

  }


  /* =====================================================
     TRANSACTION HTML
  ===================================================== */

  function renderTransaction(
    transaction
  ) {

    const payment =
      transaction.type ===
      "payment";


    return `

      <div class="
        transaction
        ${
          payment
            ? "transaction-payment"
            : "transaction-debt"
        }
      ">

        <div class="transaction-icon">
          ${payment ? "✓" : "!"}
        </div>


        <div class="transaction-info">

          <strong>
            ${
              payment
                ? "سداد"
                : "إضافة دين"
            }
          </strong>

          <span>
            ${formatDate(
              transaction.created_at
            )}
          </span>

          ${
            transaction.note
              ? `
                <small>
                  ${escapeHTML(
                    transaction.note
                  )}
                </small>
              `
              : ""
          }

        </div>


        <div class="transaction-amount">

          <strong>

            ${
              payment
                ? "-"
                : "+"
            }

            ${money(
              transaction.amount
            )}

          </strong>


          <div class="transaction-actions">

            <button
              type="button"
              data-edit-transaction="${escapeHTML(
                transaction.id
              )}"
            >
              تعديل
            </button>


            <button
              type="button"
              data-delete-transaction="${escapeHTML(
                transaction.id
              )}"
            >
              حذف
            </button>

          </div>

        </div>

      </div>

    `;

  }


  /* =====================================================
     PERSON MODAL
  ===================================================== */

  function openPersonModal(
    person = null
  ) {

    const modal =
      $("personModal");


    if (!modal) return;


    const editing =
      !!person;


    modal.innerHTML = `

      <div class="modal-backdrop"></div>


      <div class="modal">

        <button
          id="personClose"
          class="modal-close"
          type="button"
        >
          ×
        </button>


        <h2>
          ${
            editing
              ? "تعديل بيانات الشخص"
              : "إضافة شخص"
          }
        </h2>


        <form id="personForm">

          <label>
            الاسم
          </label>

          <input
            name="name"
            required
            value="${escapeHTML(
              person?.name || ""
            )}"
            placeholder="اسم الشخص"
          >


          <label>
            رقم الهاتف
          </label>

          <input
            name="phone"
            value="${escapeHTML(
              person?.phone || ""
            )}"
            placeholder="رقم الهاتف"
          >


          <label>
            الملاحظات
          </label>

          <textarea
            name="notes"
            placeholder="ملاحظات"
          >${escapeHTML(
            person?.notes || ""
          )}</textarea>


          <button
            type="submit"
            class="btn btn-primary"
          >
            ${
              editing
                ? "حفظ التعديل"
                : "إضافة الشخص"
            }
          </button>

        </form>

      </div>

    `;


    show("personModal");


    $("personClose")
      ?.addEventListener(
        "click",
        () => {

          closeModal(
            "personModal"
          );

        }
      );


    modal
      .querySelector(
        ".modal-backdrop"
      )
      ?.addEventListener(
        "click",
        () => {

          closeModal(
            "personModal"
          );

        }
      );


    $("personForm")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const form =
            event.target;


          const data = {

            name:
              form.name.value.trim(),

            phone:
              form.phone.value.trim(),

            notes:
              form.notes.value.trim()

          };


          if (editing) {

            await updatePerson(
              person.id,
              data
            );

          } else {

            await addPerson(
              data
            );

          }

        }
      );

  }


  /* =====================================================
     ADD PERSON
  ===================================================== */

  async function addPerson(
    data
  ) {

    if (!state.db) return;


    try {

      const row = {

        name:
          data.name,

        phone:
          data.phone,

        notes:
          data.notes

      };


      /*
        إذا المكتب موجود،
        اربط الشخص بالمكتب.
      */

      if (
        state.office &&
        state.office.id
      ) {

        row.office_id =
          state.office.id;

      }


      const {
        data: created,
        error
      } =
        await state.db
          .from("people")
          .insert(row)
          .select("*")
          .single();


      if (error) {

        console.error(
          "Add person:",
          error
        );

        toast(
          "تعذر إضافة الشخص",
          "error"
        );

        return;
      }


      state.people.unshift(
        created
      );


      created.balance = 0;

      created.totalDebt = 0;

      created.totalPayments = 0;


      closeModal(
        "personModal"
      );


      calculateBalances();

      renderPeople();


      toast(
        "تمت إضافة الشخص"
      );


    } catch (error) {

      console.error(
        "addPerson:",
        error
      );

      toast(
        "حدث خطأ",
        "error"
      );

    }

  }


  /* =====================================================
     UPDATE PERSON
  ===================================================== */

  async function updatePerson(
    personId,
    data
  ) {

    try {

      const {
        data: updated,
        error
      } =
        await state.db
          .from("people")
          .update({
            name:
              data.name,

            phone:
              data.phone,

            notes:
              data.notes
          })
          .eq(
            "id",
            personId
          )
          .select("*")
          .single();


      if (error) {

        console.error(
          "Update:",
          error
        );

        toast(
          "تعذر تعديل البيانات",
          "error"
        );

        return;
      }


      const index =
        state.people.findIndex(
          item =>
            item.id ===
            personId
        );


      if (index !== -1) {

        updated.balance =
          state.people[index]
            .balance || 0;

        updated.totalDebt =
          state.people[index]
            .totalDebt || 0;

        updated.totalPayments =
          state.people[index]
            .totalPayments || 0;


        state.people[index] =
          updated;

      }


      state.currentPerson =
        updated;


      closeModal(
        "personModal"
      );


      renderPeople();

      renderPersonDetails();


      toast(
        "تم تعديل البيانات"
      );


    } catch (error) {

      console.error(error);

    }

  }


  /* =====================================================
     DELETE PERSON
  ===================================================== */

  async function deletePerson(
    personId
  ) {

    if (
      !confirm(
        "هل تريد حذف الشخص؟"
      )
    ) {
      return;
    }


    try {

      const {
        error
      } =
        await state.db
          .from("people")
          .delete()
          .eq(
            "id",
            personId
          );


      if (error) {

        console.error(
          "Delete:",
          error
        );

        toast(
          "تعذر حذف الشخص",
          "error"
        );

        return;
      }


      state.people =
        state.people.filter(
          item =>
            item.id !==
            personId
        );


      state.transactions =
        state.transactions.filter(
          item =>
            item.person_id !==
            personId
        );


      hide(
        "personDetails"
      );


      renderPeople();


      toast(
        "تم حذف الشخص"
      );


    } catch (error) {

      console.error(error);

    }

  }


  /* =====================================================
     TRANSACTION MODAL
  ===================================================== */

  function openTransactionModal(
    type
  ) {

    const modal =
      $("transactionModal");


    if (!modal) return;


    const payment =
      type === "payment";


    modal.innerHTML = `

      <div class="modal-backdrop"></div>


      <div class="modal">

        <button
          id="transactionClose"
          class="modal-close"
          type="button"
        >
          ×
        </button>


        <h2>
          ${
            payment
              ? "تسجيل سداد"
              : "إضافة دين"
          }
        </h2>


        <form
          id="transactionForm"
        >

          <label>
            المبلغ
          </label>

          <input
            id="transactionAmount"
            type="number"
            min="1"
            step="1"
            required
            placeholder="مثال: 100000"
          >


          <label>
            الملاحظة
          </label>

          <textarea
            id="transactionNote"
            placeholder="ملاحظة اختيارية"
          ></textarea>


          <button
            type="submit"
            class="btn ${
              payment
                ? "btn-success"
                : "btn-danger"
            }"
          >
            حفظ الحركة
          </button>

        </form>

      </div>

    `;


    show(
      "transactionModal"
    );


    $("transactionClose")
      ?.addEventListener(
        "click",
        () => {

          closeModal(
            "transactionModal"
          );

        }
      );


    modal
      .querySelector(
        ".modal-backdrop"
      )
      ?.addEventListener(
        "click",
        () => {

          closeModal(
            "transactionModal"
          );

        }
      );


    $("transactionForm")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const amount =
            Number(
              $("transactionAmount")
                .value
            );


          const note =
            $("transactionNote")
              .value
              .trim();


          await addTransaction(
            type,
            amount,
            note
          );

        }
      );

  }


  /* =====================================================
     ADD TRANSACTION
  ===================================================== */

  async function addTransaction(
    type,
    amount,
    note
  ) {

    if (
      !state.currentPerson
    ) {
      return;
    }


    if (
      !amount ||
      amount <= 0
    ) {

      toast(
        "أدخل مبلغ صحيح",
        "error"
      );

      return;
    }


    try {

      const {
        data,
        error
      } =
        await state.db
          .from("transactions")
          .insert({
            person_id:
              state.currentPerson.id,

            type:
              type,

            amount:
              amount,

            note:
              note || ""
          })
          .select("*")
          .single();


      if (error) {

        console.error(
          "Add transaction:",
          error
        );

        toast(
          "تعذر حفظ الحركة",
          "error"
        );

        return;
      }


      state.transactions.unshift(
        data
      );


      closeModal(
        "transactionModal"
      );


      calculateBalances();

      renderPeople();

      renderPersonDetails();


      toast(
        type === "payment"
          ? "تم تسجيل السداد"
          : "تمت إضافة الدين"
      );


    } catch (error) {

      console.error(
        "Transaction:",
        error
      );

    }

  }


  /* =====================================================
     EDIT TRANSACTION
  ===================================================== */

  async function editTransaction(
    transaction
  ) {

    const amount =
      prompt(
        "المبلغ:",
        transaction.amount
      );


    if (
      amount === null
    ) {
      return;
    }


    const value =
      Number(amount);


    if (
      !value ||
      value <= 0
    ) {

      toast(
        "المبلغ غير صحيح",
        "error"
      );

      return;
    }


    const note =
      prompt(
        "الملاحظة:",
        transaction.note || ""
      );


    try {

      const {
        data,
        error
      } =
        await state.db
          .from("transactions")
          .update({
            amount:
              value,

            note:
              note || ""
          })
          .eq(
            "id",
            transaction.id
          )
          .select("*")
          .single();


      if (error) {

        console.error(
          error
        );

        toast(
          "تعذر تعديل الحركة",
          "error"
        );

        return;
      }


      const index =
        state.transactions.findIndex(
          item =>
            item.id ===
            transaction.id
        );


      if (index !== -1) {

        state.transactions[index] =
          data;

      }


      calculateBalances();

      renderPeople();

      renderPersonDetails();


      toast(
        "تم تعديل الحركة"
      );


    } catch (error) {

      console.error(error);

    }

  }


  /* =====================================================
     DELETE TRANSACTION
  ===================================================== */

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

      const {
        error
      } =
        await state.db
          .from("transactions")
          .delete()
          .eq(
            "id",
            transactionId
          );


      if (error) {

        console.error(
          error
        );

        toast(
          "تعذر حذف الحركة",
          "error"
        );

        return;
      }


      state.transactions =
        state.transactions.filter(
          item =>
            item.id !==
            transactionId
        );


      calculateBalances();

      renderPeople();

      renderPersonDetails();


      toast(
        "تم حذف الحركة"
      );


    } catch (error) {

      console.error(error);

    }

  }


  /* =====================================================
     CLOSE MODAL
  ===================================================== */

  function closeModal(
    id
  ) {

    const modal =
      $(id);

    if (!modal) return;

    hide(id);

    modal.innerHTML = "";

  }


  /* =====================================================
     SEARCH
  ===================================================== */

  function searchPeople(
    value
  ) {

    const query =
      String(
        value || ""
      )
        .trim()
        .toLowerCase();


    document
      .querySelectorAll(
        ".person-card"
      )
      .forEach(
        card => {

          const text =
            card.textContent
              .toLowerCase();


          card.style.display =
            !query ||
            text.includes(query)
              ? ""
              : "none";

        }
      );

  }


  /* =====================================================
     EVENTS
  ===================================================== */

  function setupEvents() {


    $("loginForm")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const email =
            $("loginEmail")
              .value
              .trim();


          const password =
            $("loginPassword")
              .value;


          await login(
            email,
            password
          );

        }
      );


    $("logoutBtn")
      ?.addEventListener(
        "click",
        logout
      );


    $("addPersonBtn")
      ?.addEventListener(
        "click",
        () => {

          openPersonModal();

        }
      );


    $("searchInput")
      ?.addEventListener(
        "input",
        event => {

          searchPeople(
            event.target.value
          );

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


    setupEvents();


    state.db =
      createDatabase();


    if (!state.db) {

      loadingDone();

      showLogin();

      toast(
        "تعذر الاتصال بـ Supabase",
        "error"
      );

      return;
    }


    console.log(
      "Supabase connected"
    );


    setupAuth();


    /*
      مهلة حماية حتى لا تبقى
      شاشة جار التحميل للأبد.
    */

    let finished = false;


    const timeout =
      setTimeout(
        () => {

          if (!finished) {

            finished = true;

            loadingDone();

            showLogin();

          }

        },
        8000
      );


    try {

      const {
        data,
        error
      } =
        await state.db.auth
          .getSession();


      if (error) {

        console.error(
          "getSession:",
          error
        );

        clearTimeout(
          timeout
        );

        finished = true;

        showLogin();

        return;
      }


      if (
        !data ||
        !data.session
      ) {

        clearTimeout(
          timeout
        );

        finished = true;

        showLogin();

        return;
      }


      state.session =
        data.session;


      state.user =
        data.session.user;


      console.log(
        "Existing Supabase session"
      );


      await loadOffice();

      await loadData();


      clearTimeout(
        timeout
      );


      finished = true;


      showApp();


    } catch (error) {

      console.error(
        "START:",
        error
      );


      clearTimeout(
        timeout
      );


      finished = true;


      showLogin();

    }

  }


  /* =====================================================
     START AFTER DOM
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


  /* =====================================================
     GLOBAL
  ===================================================== */

  window.openPerson =
    openPerson;

  window.openPersonModal =
    openPersonModal;

  window.openTransactionModal =
    openTransactionModal;

})();