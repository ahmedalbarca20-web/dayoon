(() => {
    "use strict";

    /* =====================================================
       SUPABASE
    ===================================================== */

    const CFG = window.SUPABASE_CONFIG || {};

    const SUPABASE_URL =
        CFG.SUPABASE_URL || "";

    const SUPABASE_ANON_KEY =
        CFG.SUPABASE_ANON_KEY || "";

    let supabaseClient = null;

    if (
        window.supabase &&
        SUPABASE_URL &&
        SUPABASE_ANON_KEY
    ) {
        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: false
                    }
                }
            );

        console.log(
            "Supabase connected"
        );

    } else {

        console.error(
            "Supabase configuration missing"
        );
    }


    /* =====================================================
       STATE
    ===================================================== */

    const state = {

        user: null,

        role: null,

        office: null,

        people: [],

        transactions: [],

        offices: [],

        currentPerson: null,

        editingPerson: null,

        search: ""
    };


    /* =====================================================
       DOM
    ===================================================== */

    const $ = id =>
        document.getElementById(id);


    /* =====================================================
       UI
    ===================================================== */

    function show(id) {

        const el = $(id);

        if (el) {
            el.classList.remove(
                "hidden"
            );
        }
    }


    function hide(id) {

        const el = $(id);

        if (el) {
            el.classList.add(
                "hidden"
            );
        }
    }


    function toast(message) {

        const el =
            $("toast");

        if (!el) {
            alert(message);
            return;
        }

        el.textContent =
            message;

        show("toast");

        clearTimeout(
            toast.timer
        );

        toast.timer =
            setTimeout(
                () => hide("toast"),
                2500
            );
    }


    function setLoading(value) {

        if (value) {
            show("loadingScreen");
        } else {
            hide("loadingScreen");
        }
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


    function money(value) {

        const number =
            Number(value || 0);

        return number.toLocaleString(
            "ar-IQ",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );
    }


    function today() {

        return new Date()
            .toISOString()
            .slice(0, 10);
    }


    /* =====================================================
       SESSION
    ===================================================== */

    async function getSession() {

        if (!supabaseClient) {
            throw new Error(
                "Supabase غير متصل"
            );
        }

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getSession();

        if (error) {
            throw error;
        }

        return data.session;
    }


    /* =====================================================
       ADMIN CHECK
    ===================================================== */

    async function checkAdmin(
        userId
    ) {

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
    }


    /* =====================================================
       CURRENT OFFICE
    ===================================================== */

    async function loadCurrentOffice(
        userId
    ) {

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

            throw error;
        }

        return data;
    }


    /* =====================================================
       AUTH USER
    ===================================================== */

    async function loadCurrentUser() {

        const session =
            await getSession();

        if (!session) {

            state.user = null;
            state.role = null;
            state.office = null;

            return null;
        }

        state.user =
            session.user;

        const admin =
            await checkAdmin(
                session.user.id
            );

        if (admin) {

            state.role =
                "admin";

            state.office =
                null;

            return session.user;
        }


        const office =
            await loadCurrentOffice(
                session.user.id
            );

        if (!office) {

            await supabaseClient
                .auth
                .signOut();

            throw new Error(
                "الحساب غير مرتبط بمكتب"
            );
        }


        if (!office.active) {

            await supabaseClient
                .auth
                .signOut();

            throw new Error(
                "حساب المكتب متوقف"
            );
        }


        state.role =
            "office";

        state.office =
            office;

        return session.user;
    }


    /* =====================================================
       LOGIN
    ===================================================== */

    async function login(
        email,
        password
    ) {

        if (!supabaseClient) {

            toast(
                "Supabase غير متصل"
            );

            return false;
        }


        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .auth
                    .signInWithPassword({
                        email:
                            String(email)
                                .trim(),
                        password:
                            String(password)
                    });


            if (error) {

                console.error(
                    "Auth login failed:",
                    error
                );

                $("loginError").textContent =
                    "البريد الإلكتروني أو كلمة المرور غير صحيحة";

                show("loginError");

                return false;
            }


            state.user =
                data.user;

            await loadCurrentUser();

            await renderApp();

            return true;

        } catch (error) {

            console.error(
                "Login:",
                error
            );

            $("loginError").textContent =
                error.message ||
                "حدث خطأ أثناء تسجيل الدخول";

            show("loginError");

            return false;
        }
    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logout() {

        if (!supabaseClient) {
            return;
        }

        try {

            await supabaseClient
                .auth
                .signOut();

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

        show("loginScreen");

        hide("officeScreen");

        hide("adminScreen");
    }


    /* =====================================================
       PEOPLE
    ===================================================== */

    async function loadPeople() {

        if (
            !state.office
        ) {
            state.people = [];
            return [];
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
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Load people:",
                error
            );

            toast(
                "تعذر تحميل الأشخاص"
            );

            return [];
        }


        state.people =
            data || [];

        return state.people;
    }


    /* =====================================================
       ADD PERSON
    ===================================================== */

    async function addPerson() {

        if (!state.office) {

            toast(
                "لا يوجد مكتب"
            );

            return;
        }


        const name =
            $("personInputName")
                .value
                .trim();

        const phone =
            $("personInputPhone")
                .value
                .trim();

        const address =
            $("personInputAddress")
                .value
                .trim();

        const notes =
            $("personInputNotes")
                .value
                .trim();

        const balance =
            Number(
                $("personInputBalance")
                    .value || 0
            );

        const debtDate =
            $("personInputDate")
                .value ||
            today();


        if (!name) {

            toast(
                "اكتب اسم الشخص"
            );

            return;
        }


        const {
            data: person,
            error
        } =
            await supabaseClient
                .from("people")
                .insert({
                    office_id:
                        state.office.id,

                    name,

                    phone:
                        phone ||
                        null,

                    address:
                        address ||
                        null,

                    notes:
                        notes ||
                        null,

                    balance,

                    debt_date:
                        debtDate
                })
                .select()
                .single();


        if (error) {

            console.error(
                "Add person:",
                error
            );

            toast(
                "تعذر إضافة الشخص: " +
                error.message
            );

            return;
        }


        /*
         * إذا كان له رصيد افتتاحي،
         * نحفظه أيضاً كسجل حركة.
         */

        if (balance !== 0) {

            const type =
                balance < 0
                    ? "debt"
                    : "payment";

            const {
                error:
                    transactionError
            } =
                await supabaseClient
                    .from("transactions")
                    .insert({
                        office_id:
                            state.office.id,

                        person_id:
                            person.id,

                        type,

                        amount:
                            Math.abs(
                                balance
                            ),

                        note:
                            "الرصيد الافتتاحي",

                        transaction_date:
                            new Date()
                                .toISOString()
                    });


            if (transactionError) {

                console.error(
                    "Initial transaction:",
                    transactionError
                );

                /*
                 * لا نحذف الشخص هنا؛
                 * الرصيد محفوظ ويمكن إصلاح الحركة
                 * من سجل الحركات.
                 */

                toast(
                    "تمت إضافة الشخص لكن تعذر حفظ الحركة الأولى"
                );
            }
        }


        $("addPersonForm").reset();

        $("personInputDate").value =
            today();

        hide(
            "addPersonModal"
        );

        await loadPeople();

        renderDashboard();

        toast(
            "تمت إضافة الشخص"
        );
    }


    /* =====================================================
       UPDATE PERSON
    ===================================================== */

    async function updatePerson() {

        const person =
            state.editingPerson;

        if (!person) {
            return;
        }


        const updates = {

            name:
                $("editPersonName")
                    .value
                    .trim(),

            phone:
                $("editPersonPhone")
                    .value
                    .trim() ||
                null,

            address:
                $("editPersonAddress")
                    .value
                    .trim() ||
                null,

            notes:
                $("editPersonNotes")
                    .value
                    .trim() ||
                null,

            debt_date:
                $("editPersonDate")
                    .value ||
                null
        };


        if (!updates.name) {

            toast(
                "الاسم مطلوب"
            );

            return;
        }


        const {
            error
        } =
            await supabaseClient
                .from("people")
                .update(
                    updates
                )
                .eq(
                    "id",
                    person.id
                )
                .eq(
                    "office_id",
                    state.office.id
                );


        if (error) {

            console.error(
                "Update person:",
                error
            );

            toast(
                "تعذر تعديل الشخص"
            );

            return;
        }


        hide(
            "editPersonModal"
        );

        state.editingPerson =
            null;

        await loadPeople();

        renderDashboard();

        if (
            state.currentPerson
        ) {

            state.currentPerson =
                state.people.find(
                    p =>
                        p.id ===
                        person.id
                );

            await openPerson(
                person.id
            );
        }

        toast(
            "تم تعديل البيانات"
        );
    }


    /* =====================================================
       DELETE PERSON
    ===================================================== */

    async function deletePerson() {

        const person =
            state.currentPerson;

        if (!person) {
            return;
        }


        const ok =
            confirm(
                `هل تريد حذف ${person.name} وجميع حركاته؟`
            );


        if (!ok) {
            return;
        }


        const {
            error
        } =
            await supabaseClient
                .from("people")
                .delete()
                .eq(
                    "id",
                    person.id
                )
                .eq(
                    "office_id",
                    state.office.id
                );


        if (error) {

            console.error(
                "Delete person:",
                error
            );

            toast(
                "تعذر حذف الشخص"
            );

            return;
        }


        state.currentPerson =
            null;

        hide(
            "personModal"
        );

        await loadPeople();

        renderDashboard();

        toast(
            "تم حذف الشخص"
        );
    }


    /* =====================================================
       TRANSACTIONS
    ===================================================== */

    async function loadTransactions(
        personId
    ) {

        if (!state.office) {
            return [];
        }


        const {
            data,
            error
        } =
            await supabaseClient
                .from("transactions")
                .select("*")
                .eq(
                    "person_id",
                    personId
                )
                .eq(
                    "office_id",
                    state.office.id
                )
                .order(
                    "transaction_date",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Load transactions:",
                error
            );

            toast(
                "تعذر تحميل سجل الحركات"
            );

            return [];
        }


        state.transactions =
            data || [];

        return state.transactions;
    }


    /* =====================================================
       ADD TRANSACTION
    ===================================================== */

    async function addTransaction(
        type,
        amount,
        note
    ) {

        const person =
            state.currentPerson;

        if (!person) {

            toast(
                "لم يتم تحديد الشخص"
            );

            return;
        }


        const value =
            Number(amount);


        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            toast(
                "المبلغ غير صحيح"
            );

            return;
        }


        /*
         * الرصيد:
         *
         * debt:
         * -100
         *
         * payment:
         * +100
         */

        const oldBalance =
            Number(
                person.balance || 0
            );


        const newBalance =
            type === "debt"
                ? oldBalance - value
                : oldBalance + value;


        /*
         * أولاً نسجل الحركة
         */

        const {
            data: transaction,
            error:
                transactionError
        } =
            await supabaseClient
                .from("transactions")
                .insert({

                    office_id:
                        state.office.id,

                    person_id:
                        person.id,

                    type,

                    amount:
                        value,

                    note:
                        note
                            ?.trim() ||
                        null,

                    transaction_date:
                        new Date()
                            .toISOString()

                })
                .select()
                .single();


        if (transactionError) {

            console.error(
                "Add transaction:",
                transactionError
            );

            toast(
                "تعذر حفظ الحركة: " +
                transactionError.message
            );

            return;
        }


        /*
         * بعدها نحدث الرصيد
         */

        const {
            error:
                balanceError
        } =
            await supabaseClient
                .from("people")
                .update({
                    balance:
                        newBalance
                })
                .eq(
                    "id",
                    person.id
                )
                .eq(
                    "office_id",
                    state.office.id
                );


        if (balanceError) {

            console.error(
                "Update balance:",
                balanceError
            );


            /*
             * نحاول حذف الحركة التي
             * سجلناها إذا فشل تحديث الرصيد.
             */

            await supabaseClient
                .from("transactions")
                .delete()
                .eq(
                    "id",
                    transaction.id
                );


            toast(
                "تعذر تحديث الرصيد"
            );

            return;
        }


        await loadPeople();

        state.currentPerson =
            state.people.find(
                p =>
                    p.id ===
                    person.id
            );


        await loadTransactions(
            person.id
        );

        renderDashboard();

        renderPerson();


        hide(
            type === "payment"
                ? "paymentModal"
                : "debtModal"
        );


        if (type === "payment") {

            $("paymentForm")
                .reset();

            toast(
                "تم تسجيل التسديد"
            );

        } else {

            $("debtForm")
                .reset();

            toast(
                "تمت إضافة الدين"
            );
        }
    }


    /* =====================================================
       DASHBOARD
    ===================================================== */

    function renderDashboard() {

        if (!state.office) {
            return;
        }


        $("officeTitle")
            .textContent =
            state.office.name;


        $("officePhone")
            .textContent =
            state.office.phone ||
            "";


        const people =
            filterPeople();


        $("peopleCount")
            .textContent =
            `${state.people.length} شخص`;


        /*
         * Totals
         */

        let totalDebt = 0;

        let totalCredit = 0;


        state.people.forEach(
            person => {

                const balance =
                    Number(
                        person.balance ||
                        0
                    );


                if (balance < 0) {

                    totalDebt +=
                        Math.abs(
                            balance
                        );

                } else if (
                    balance > 0
                ) {

                    totalCredit +=
                        balance;
                }
            }
        );


        $("totalDebt")
            .textContent =
            money(totalDebt);


        $("totalCredit")
            .textContent =
            money(totalCredit);


        const net =
            totalCredit -
            totalDebt;


        $("totalNet")
            .textContent =
            net > 0
                ? "+" + money(net)
                : money(net);


        $("totalNet")
            .className =
            net < 0
                ? "negative"
                : net > 0
                    ? "positive"
                    : "zero";


        /*
         * People
         */

        const container =
            $("peopleList");


        if (!people.length) {

            container.innerHTML = `
                <div class="empty">
                    لا يوجد أشخاص
                </div>
            `;

            return;
        }


        container.innerHTML =
            people.map(
                person => {

                    const balance =
                        Number(
                            person.balance ||
                            0
                        );


                    const color =
                        balance < 0
                            ? "negative"
                            : balance > 0
                                ? "positive"
                                : "zero";


                    const sign =
                        balance > 0
                            ? "+"
                            : "";


                    return `
                        <button
                            type="button"
                            class="person-card"
                            data-person="${escapeHtml(person.id)}"
                        >

                            <div class="person-main">

                                <strong>
                                    ${escapeHtml(
                                        person.name
                                    )}
                                </strong>

                                <span class="person-phone">
                                    ${escapeHtml(
                                        person.phone || ""
                                    )}
                                </span>

                            </div>

                            <div class="person-balance ${color}">
                                ${sign}${money(balance)}
                            </div>

                        </button>
                    `;
                }
            )
            .join("");


        container
            .querySelectorAll(
                "[data-person]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            openPerson(
                                button.dataset
                                    .person
                            );
                        }
                    );
                }
            );
    }


    /* =====================================================
       FILTER
    ===================================================== */

    function filterPeople() {

        const q =
            state.search
                .trim()
                .toLowerCase();


        if (!q) {
            return state.people;
        }


        return state.people.filter(
            person => {

                return (
                    String(
                        person.name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(q)

                    ||

                    String(
                        person.phone ||
                        ""
                    )
                        .toLowerCase()
                        .includes(q)
                );
            }
        );
    }


    /* =====================================================
       PERSON
    ===================================================== */

    async function openPerson(
        personId
    ) {

        const person =
            state.people.find(
                p =>
                    p.id ===
                    personId
            );


        if (!person) {
            return;
        }


        state.currentPerson =
            person;


        await loadTransactions(
            personId
        );


        renderPerson();

        show(
            "personModal"
        );
    }


    function renderPerson() {

        const person =
            state.currentPerson;


        if (!person) {
            return;
        }


        $("personName")
            .textContent =
            person.name;


        const balance =
            Number(
                person.balance || 0
            );


        $("personBalance")
            .textContent =
            balance > 0
                ? "+" + money(balance)
                : money(balance);


        $("personBalance")
            .className =
            "person-big-balance " +
            (
                balance < 0
                    ? "negative"
                    : balance > 0
                        ? "positive"
                        : "zero"
            );


        $("personPhone")
            .textContent =
            person.phone ||
            "-";


        $("personAddress")
            .textContent =
            person.address ||
            "-";


        $("personNotes")
            .textContent =
            person.notes ||
            "-";


        renderHistory();
    }


    function closePerson() {

        hide(
            "personModal"
        );

        state.currentPerson =
            null;
    }


    /* =====================================================
       HISTORY
    ===================================================== */

    function renderHistory() {

        const container =
            $("transactionHistory");


        if (!state.transactions.length) {

            container.innerHTML = `
                <div class="empty">
                    لا توجد حركات لهذا الشخص
                </div>
            `;

            return;
        }


        container.innerHTML =
            state.transactions
                .map(
                    transaction => {

                        const date =
                            new Date(
                                transaction
                                    .transaction_date
                            );


                        const dateText =
                            date.toLocaleDateString(
                                "ar-IQ"
                            );


                        const timeText =
                            date.toLocaleTimeString(
                                "ar-IQ",
                                {
                                    hour:
                                        "2-digit",
                                    minute:
                                        "2-digit"
                                }
                            );


                        const payment =
                            transaction.type ===
                            "payment";


                        return `
                            <div class="transaction-row">

                                <div>

                                    <strong>
                                        ${
                                            payment
                                                ? "تسديد"
                                                : "دين"
                                        }
                                    </strong>

                                    <small>
                                        ${dateText}
                                        -
                                        ${timeText}
                                    </small>

                                </div>

                                <div class="${
                                    payment
                                        ? "positive"
                                        : "negative"
                                }">

                                    ${
                                        payment
                                            ? "+"
                                            : "-"
                                    }${money(
                                        transaction.amount
                                    )}

                                </div>

                                <div>
                                    ${escapeHtml(
                                        transaction.note ||
                                        ""
                                    )}
                                </div>

                            </div>
                        `;
                    }
                )
                .join("");
    }


    /* =====================================================
       OFFICES - ADMIN
    ===================================================== */

    async function loadOffices() {

        if (
            state.role !==
            "admin"
        ) {
            return;
        }


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
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Load offices:",
                error
            );

            toast(
                "تعذر تحميل المكاتب"
            );

            return;
        }


        state.offices =
            data || [];


        renderOffices();
    }


    function renderOffices() {

        const container =
            $("officesList");


        if (!state.offices.length) {

            container.innerHTML = `
                <div class="empty">
                    لا توجد مكاتب
                </div>
            `;

            return;
        }


        container.innerHTML =
            state.offices
                .map(
                    office => {

                        return `
                            <div class="office-card">

                                <div class="office-info">

                                    <strong>
                                        ${escapeHtml(
                                            office.name
                                        )}
                                    </strong>

                                    <small>
                                        ${escapeHtml(
                                            office.username ||
                                            ""
                                        )}
                                    </small>

                                    <small>
                                        ${escapeHtml(
                                            office.phone ||
                                            ""
                                        )}
                                    </small>

                                    <span class="office-status ${
                                        office.active
                                            ? "status-active"
                                            : "status-disabled"
                                    }">
                                        ${
                                            office.active
                                                ? "فعال"
                                                : "متوقف"
                                        }
                                    </span>

                                </div>


                                <div class="office-actions">

                                    <button
                                        type="button"
                                        class="${
                                            office.active
                                                ? "danger-btn"
                                                : "success-btn"
                                        }"
                                        data-office-status="${escapeHtml(
                                            office.id
                                        )}"
                                    >
                                        ${
                                            office.active
                                                ? "تعطيل"
                                                : "تفعيل"
                                        }
                                    </button>

                                </div>

                            </div>
                        `;
                    }
                )
                .join("");


        container
            .querySelectorAll(
                "[data-office-status]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const office =
                                state.offices.find(
                                    o =>
                                        o.id ===
                                        button.dataset
                                            .officeStatus
                                );

                            if (
                                office
                            ) {

                                updateOfficeStatus(
                                    office.id,
                                    !office.active
                                );
                            }
                        }
                    );
                }
            );
    }


    async function updateOfficeStatus(
        officeId,
        active
    ) {

        const {
            error
        } =
            await supabaseClient
                .from("offices")
                .update({
                    active:
                        Boolean(active)
                })
                .eq(
                    "id",
                    officeId
                );


        if (error) {

            console.error(
                "Update office:",
                error
            );

            toast(
                "تعذر تغيير حالة المكتب"
            );

            return;
        }


        await loadOffices();

        toast(
            active
                ? "تم تفعيل المكتب"
                : "تم تعطيل المكتب"
        );
    }


    /* =====================================================
       CREATE OFFICE
    ===================================================== */

    async function createOffice(
        event
    ) {

        event.preventDefault();


        const name =
            $("officeNameInput")
                .value
                .trim();

        const email =
            $("officeEmailInput")
                .value
                .trim();

        const password =
            $("officePasswordInput")
                .value;

        const phone =
            $("officePhoneInput")
                .value
                .trim();


        if (
            !name ||
            !email ||
            !password
        ) {

            toast(
                "أكمل بيانات المكتب"
            );

            return;
        }


        try {

            /*
             * إنشاء الحساب يجب أن يتم عبر
             * Edge Function في السيرفر.
             */

            const {
                data,
                error
            } =
                await supabaseClient
                    .functions
                    .invoke(
                        "create-office-user",
                        {
                            body: {
                                name,
                                email,
                                password,
                                phone
                            }
                        }
                    );


            if (error) {
                throw error;
            }


            if (
                !data ||
                !data.success
            ) {

                throw new Error(
                    data?.error ||
                    "فشل إنشاء المكتب"
                );
            }


            $("createOfficeForm")
                .reset();


            hide(
                "createOfficeModal"
            );


            await loadOffices();


            toast(
                "تم إنشاء المكتب وحساب الدخول"
            );


        } catch (error) {

            console.error(
                "Create office:",
                error
            );


            toast(
                error.message ||
                "تعذر إنشاء المكتب"
            );
        }
    }


    /* =====================================================
       EDIT PERSON OPEN
    ===================================================== */

    function openEditPerson() {

        const person =
            state.currentPerson;

        if (!person) {
            return;
        }


        state.editingPerson =
            person;


        $("editPersonName")
            .value =
            person.name ||
            "";


        $("editPersonPhone")
            .value =
            person.phone ||
            "";


        $("editPersonAddress")
            .value =
            person.address ||
            "";


        $("editPersonDate")
            .value =
            person.debt_date ||
            "";


        $("editPersonNotes")
            .value =
            person.notes ||
            "";


        show(
            "editPersonModal"
        );
    }


    /* =====================================================
       MODAL EVENTS
    ===================================================== */

    function setupModalEvents() {

        /*
         * Create office
         */

        $("openCreateOfficeBtn")
            ?.addEventListener(
                "click",
                () => {

                    show(
                        "createOfficeModal"
                    );
                }
            );


        $("closeCreateOfficeBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "createOfficeModal"
                    )
            );


        $("cancelCreateOfficeBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "createOfficeModal"
                    )
            );


        $("createOfficeForm")
            ?.addEventListener(
                "submit",
                createOffice
            );


        /*
         * Add person
         */

        $("openAddPersonBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("personInputDate")
                        .value =
                        today();

                    show(
                        "addPersonModal"
                    );
                }
            );


        $("closeAddPersonBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "addPersonModal"
                    )
            );


        $("cancelAddPersonBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "addPersonModal"
                    )
            );


        $("addPersonForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    try {
                        await addPerson();
                    } catch (
                        error
                    ) {

                        console.error(
                            "Add person:",
                            error
                        );

                        toast(
                            "تعذر إضافة الشخص"
                        );
                    }
                }
            );


        /*
         * Person
         */

        $("closePersonBtn")
            ?.addEventListener(
                "click",
                closePerson
            );


        $("openPaymentBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("paymentAmount")
                        .value =
                        "";

                    show(
                        "paymentModal"
                    );
                }
            );


        $("openDebtBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("debtAmount")
                        .value =
                        "";

                    show(
                        "debtModal"
                    );
                }
            );


        $("openEditPersonBtn")
            ?.addEventListener(
                "click",
                openEditPerson
            );


        $("deletePersonBtn")
            ?.addEventListener(
                "click",
                deletePerson
            );


        /*
         * Payment
         */

        $("closePaymentBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "paymentModal"
                    )
            );


        $("cancelPaymentBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "paymentModal"
                    )
            );


        $("paymentForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    await addTransaction(
                        "payment",

                        $("paymentAmount")
                            .value,

                        $("paymentNote")
                            .value
                    );
                }
            );


        /*
         * Debt
         */

        $("closeDebtBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "debtModal"
                    )
            );


        $("cancelDebtBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "debtModal"
                    )
            );


        $("debtForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    await addTransaction(
                        "debt",

                        $("debtAmount")
                            .value,

                        $("debtNote")
                            .value
                    );
                }
            );


        /*
         * Edit
         */

        $("closeEditPersonBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "editPersonModal"
                    )
            );


        $("cancelEditPersonBtn")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        "editPersonModal"
                    )
            );


        $("editPersonForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    await updatePerson();
                }
            );


        /*
         * Click outside modal
         */

        document
            .querySelectorAll(
                ".modal"
            )
            .forEach(
                modal => {

                    modal.addEventListener(
                        "click",
                        event => {

                            if (
                                event.target ===
                                modal
                            ) {
                                hide(
                                    modal.id
                                );
                            }
                        }
                    );
                }
            );
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    function setupSearch() {

        $("peopleSearch")
            ?.addEventListener(
                "input",
                event => {

                    state.search =
                        event.target.value;

                    renderDashboard();
                }
            );
    }


    /* =====================================================
       LOGIN EVENTS
    ===================================================== */

    function setupAuthEvents() {

        $("loginForm")
            ?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    hide(
                        "loginError"
                    );

                    await login(
                        $("loginEmail")
                            .value,

                        $("loginPassword")
                            .value
                    );
                }
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
    }


    /* =====================================================
       RENDER APP
    ===================================================== */

    async function renderApp() {

        hide(
            "loginScreen"
        );

        hide(
            "adminScreen"
        );

        hide(
            "officeScreen"
        );


        if (
            state.role ===
            "admin"
        ) {

            show(
                "adminScreen"
            );

            await loadOffices();

            return;
        }


        if (
            state.role ===
            "office"
        ) {

            show(
                "officeScreen"
            );

            await loadPeople();

            renderDashboard();

            return;
        }


        show(
            "loginScreen"
        );
    }


    /* =====================================================
       START
    ===================================================== */

    async function start() {

        setLoading(true);


        try {

            if (!supabaseClient) {

                hide(
                    "loadingScreen"
                );

                show(
                    "loginScreen"
                );

                return;
            }


            const session =
                await getSession();


            if (!session) {

                show(
                    "loginScreen"
                );

                return;
            }


            await loadCurrentUser();

            await renderApp();


        } catch (error) {

            console.error(
                "Starting Debt Book:",
                error
            );


            show(
                "loginScreen"
            );


        } finally {

            setLoading(false);
        }
    }


    /* =====================================================
       AUTH STATE
    ===================================================== */

    if (supabaseClient) {

        supabaseClient
            .auth
            .onAuthStateChange(
                (
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

                        state.user =
                            null;

                        state.role =
                            null;

                        state.office =
                            null;

                        state.people =
                            [];

                        state.currentPerson =
                            null;


                        hide(
                            "officeScreen"
                        );

                        hide(
                            "adminScreen"
                        );

                        show(
                            "loginScreen"
                        );
                    }
                }
            );
    }


    /* =====================================================
       INIT
    ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupAuthEvents();

            setupModalEvents();

            setupSearch();

            start();
        }
    );


    /* =====================================================
       DEBUG API
    ===================================================== */

    window.DebtBook = {

        login,

        logout,

        loadPeople,

        loadTransactions,

        addPerson,

        addTransaction,

        openPerson,

        closePerson,

        getState: () =>
            state
    };

})();