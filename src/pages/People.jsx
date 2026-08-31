import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Eye,
  Trash2,
  Loader2,
  User,
  Phone,
  Wallet,
  X,
  CreditCard,
  Banknote,
  MapPin,
  AlertTriangle,
  Pencil,
} from "lucide-react";

import { supabase } from "../services/supabase";
import { getCurrentOffice, updatePerson } from "../services/people";

function formatAmount(value) {
  return Math.abs(Number(value) || 0).toLocaleString("en-US");
}

function getTransactionType(transaction) {
  return (
    transaction.transaction_type ||
    transaction.type ||
    ""
  )
    .toString()
    .toLowerCase();
}

function isDebt(transaction) {
  return getTransactionType(transaction) === "debt";
}

function isPayment(transaction) {
  return getTransactionType(transaction) === "payment";
}

function People() {
  const navigate = useNavigate();

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [transactionType, setTransactionType] = useState("debt");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    amount: "",
    notes: "",
  });

  const [transactionForm, setTransactionForm] = useState({
    amount: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });

  async function loadPeople() {
    try {
      setLoading(true);
      setError("");

      const office = await getCurrentOffice();
      if (!office) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("*")
        .eq("office_id", office.id)
        .order("created_at", { ascending: false });

      if (peopleError) throw peopleError;

      const { data: transactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("id, person_id, amount, type, transaction_type")
        .eq("office_id", office.id);

      if (transactionsError) throw transactionsError;

      const peopleWithBalance = (peopleData || []).map((person) => {
        const personTransactions = (transactions || []).filter(
          (t) => t.person_id === person.id
        );

        const totalDebt = personTransactions
          .filter(isDebt)
          .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        const totalPayments = personTransactions
          .filter(isPayment)
          .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        const balance = Math.max(0, totalDebt - totalPayments);

        return {
          ...person,
          totalDebt,
          totalPayments,
          balance,
        };
      });

      setPeople(peopleWithBalance);
    } catch (err) {
      console.error("خطأ في تحميل الأشخاص:", err);
      setError(err?.message || "حدث خطأ أثناء تحميل الأشخاص");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  // إضافة شخص جديد
  async function handleCreatePerson(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("يرجى كتابة اسم الشخص");
      return;
    }

    try {
      setSaving(true);
      const office = await getCurrentOffice();
      if (!office) return;

      const amount = Math.abs(Number(form.amount) || 0);

      const { data: person, error: personError } = await supabase
        .from("people")
        .insert({
          office_id: office.id,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          amount,
          balance: amount,
          notes: form.notes.trim() || null,
          account_type: "debtor",
          person_type: "customer",
        })
        .select()
        .single();

      if (personError) throw personError;

      // تسجيل الرصيد الافتتاحي كدين
      if (amount > 0) {
        const { error: transactionError } = await supabase
          .from("transactions")
          .insert({
            office_id: office.id,
            person_id: person.id,
            type: "debt",
            transaction_type: "debt",
            amount,
            note: "الرصيد الافتتاحي",
            transaction_date: new Date().toISOString().split("T")[0],
          });

        if (transactionError) console.error(transactionError);
      }

      setForm({
        name: "",
        phone: "",
        address: "",
        amount: "",
        notes: "",
      });

      setShowCreate(false);
      await loadPeople();
    } catch (err) {
      console.error("خطأ في إضافة الشخص:", err);
      alert(err?.message || "تعذر إضافة الشخص");
    } finally {
      setSaving(false);
    }
  }

  function openEditPerson(person) {
    setSelectedPerson(person);
    setForm({
      name: person.name || "",
      phone: person.phone || "",
      address: person.address || "",
      amount: "",
      notes: person.notes || "",
    });
    setShowEdit(true);
  }

  async function handleUpdatePerson(e) {
    e.preventDefault();
    if (!form.name.trim() || !selectedPerson) {
      alert("يرجى كتابة اسم الشخص");
      return;
    }

    try {
      setSaving(true);
      await updatePerson(selectedPerson.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      });
      setShowEdit(false);
      setSelectedPerson(null);
      await loadPeople();
    } catch (err) {
      console.error("خطأ في تعديل الشخص:", err);
      alert(err?.message || "تعذر تعديل الشخص");
    } finally {
      setSaving(false);
    }
  }

  function openTransaction(person, type) {
    setSelectedPerson(person);
    setTransactionType(type);
    setTransactionForm({
      amount: "",
      note: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowTransaction(true);
  }

  // إضافة دين أو تسديد
  async function handleTransaction(e) {
    e.preventDefault();

    const amount = Math.abs(Number(transactionForm.amount) || 0);

    if (amount <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }

    if (!selectedPerson) return;

    try {
      setSaving(true);
      const office = await getCurrentOffice();
      if (!office) return;

      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          office_id: office.id,
          person_id: selectedPerson.id,
          type: transactionType,
          transaction_type: transactionType,
          amount,
          note: transactionForm.note.trim() || null,
          transaction_date: transactionForm.date,
        });

      if (transactionError) throw transactionError;

      const currentBalance = Math.abs(Number(selectedPerson.balance) || 0);
      let newBalance = currentBalance;

      if (transactionType === "debt") {
        newBalance = currentBalance + amount;
      } else if (transactionType === "payment") {
        newBalance = Math.max(0, currentBalance - amount);
      }

      const { error: balanceError } = await supabase
        .from("people")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPerson.id)
        .eq("office_id", office.id);

      if (balanceError) console.error("خطأ في تحديث الرصيد:", balanceError);

      setShowTransaction(false);
      setSelectedPerson(null);
      await loadPeople();
    } catch (err) {
      console.error("خطأ في إضافة الحركة:", err);
      alert(err?.message || "تعذر حفظ الحركة");
    } finally {
      setSaving(false);
    }
  }

  // حذف شخص
  async function handleDeletePerson(person) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف "${person.name}"؟\n\nسيتم حذف الشخص وجميع حركاته المالية بشكل نهائي.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(person.id);
      setError("");

      const office = await getCurrentOffice();
      if (!office) return;

      const { error: transactionError } = await supabase
        .from("transactions")
        .delete()
        .eq("office_id", office.id)
        .eq("person_id", person.id);

      if (transactionError) throw transactionError;

      const { error: personError } = await supabase
        .from("people")
        .delete()
        .eq("office_id", office.id)
        .eq("id", person.id);

      if (personError) throw personError;

      setPeople((current) => current.filter((item) => item.id !== person.id));
    } catch (err) {
      console.error("خطأ في حذف الشخص:", err);
      alert(err?.message || "تعذر حذف الشخص");
      await loadPeople();
    } finally {
      setDeletingId(null);
    }
  }

  const filteredPeople = people.filter((person) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      person.name?.toLowerCase().includes(query) ||
      person.phone?.toLowerCase().includes(query) ||
      person.address?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filterType === "with_debt") return person.balance > 0;
    if (filterType === "settled") return person.balance === 0;

    return true;
  });

  return (
    <div dir="rtl" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
            الأشخاص والديون
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            إدارة الحسابات، تسجيل الديون والتسديدات، واستخراج التقارير
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-98"
        >
          <Plus size={19} />
          <span>إضافة شخص جديد</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو العنوان..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-11 pl-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              filterType === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            الكل ({people.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("with_debt")}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              filterType === "with_debt"
                ? "bg-white text-rose-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            عليهم ديون ({people.filter((p) => p.balance > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("settled")}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              filterType === "settled"
                ? "bg-white text-emerald-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            خالصة ({people.filter((p) => p.balance === 0).length})
          </button>
        </div>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          <AlertTriangle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* People Grid */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="text-sm font-semibold">جاري تحميل بيانات الأشخاص...</span>
          </div>
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <User size={48} className="mx-auto text-slate-300" />
          <h3 className="mt-4 font-bold text-slate-800 text-lg">
            {search ? "لا توجد نتائج مطابقة لبحثك" : "لا يوجد أشخاص مسجلين"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search
              ? "جرّب البحث باسم آخر أو تأكد من صحة رقم الهاتف."
              : "ابدأ بإضافة أول شخص في دفتر الديون لمتابعة حسابه."}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
            >
              <Plus size={18} />
              إضافة شخص الآن
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPeople.map((person) => (
            <div
              key={person.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:border-blue-200 hover:shadow-md"
            >
              {/* Header Info */}
              <div>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 font-extrabold text-base">
                        {person.name?.[0] || "ش"}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-slate-900 text-base">
                          {person.name}
                        </h2>
                        {person.phone ? (
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Phone size={13} className="text-slate-400" />
                            <span dir="ltr">{person.phone}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-normal">لا يوجد هاتف</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {person.address && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 rounded-md px-2 py-0.5 truncate max-w-[100px]">
                          <MapPin size={11} />
                          {person.address}
                        </span>
                      )}
                      <button
                        type="button"
                        title="تعديل البيانات"
                        onClick={() => openEditPerson(person)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                </div>

                {/* Balance Badge */}
                <div
                  className={`mt-4 flex items-center justify-between rounded-xl p-3.5 ${
                    person.balance > 0
                      ? "bg-rose-50/80 border border-rose-100"
                      : "bg-emerald-50/80 border border-emerald-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wallet
                      size={18}
                      className={person.balance > 0 ? "text-rose-600" : "text-emerald-600"}
                    />
                    <span
                      className={`text-xs font-bold ${
                        person.balance > 0 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {person.balance > 0 ? "المبلغ المطلوب عليه" : "الحساب خالص"}
                    </span>
                  </div>

                  <span
                    className={`text-lg font-extrabold ${
                      person.balance > 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {formatAmount(person.balance)}
                  </span>
                </div>

                {/* Totals Summary */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                    <p className="text-[11px] font-bold text-slate-400">إجمالي الدين</p>
                    <p className="mt-0.5 text-xs font-extrabold text-rose-600">
                      {formatAmount(person.totalDebt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                    <p className="text-[11px] font-bold text-slate-400">إجمالي التسديد</p>
                    <p className="mt-0.5 text-xs font-extrabold text-emerald-600">
                      {formatAmount(person.totalPayments)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openTransaction(person, "debt")}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 active:scale-98"
                  >
                    <CreditCard size={15} />
                    <span>+ دين جديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openTransaction(person, "payment")}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-100 active:scale-98"
                  >
                    <Banknote size={15} />
                    <span>+ تسديد</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/people/${person.id}/report`)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-600 active:scale-98"
                  >
                    <Eye size={15} />
                    <span>كشف الحساب</span>
                  </button>

                  <button
                    type="button"
                    disabled={deletingId === person.id}
                    onClick={() => handleDeletePerson(person)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 active:scale-98"
                  >
                    {deletingId === person.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    <span>{deletingId === person.id ? "جاري الحذف..." : "حذف"}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Person Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onMouseDown={() => setShowCreate(false)}
        >
          <div
            dir="rtl"
            onMouseDown={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  إضافة شخص جديد
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  سجل بيانات العميل والرصيد الافتتاحي إن وجد
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePerson} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  الاسم الكامل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: أحمد محمد علي"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none text-right focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    العنوان أو المنطقة
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="المدينة / الحي"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  الرصيد الافتتاحي (دين سابق)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  اتركه 0 إذا لم يكن هناك دين سابق مسجل.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  ملاحظات إضافية
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="ملاحظات حول الشخص أو الاتفاق..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-60 shadow-md shadow-blue-500/20"
                >
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  <span>{saving ? "جاري الحفظ..." : "حفظ الشخص"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && selectedPerson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onMouseDown={() => setShowEdit(false)}
        >
          <div
            dir="rtl"
            onMouseDown={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">تعديل بيانات الشخص</h2>
                <p className="mt-0.5 text-xs text-slate-400">{selectedPerson.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePerson} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  الاسم الكامل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">رقم الهاتف</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none text-right focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">العنوان أو المنطقة</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">ملاحظات إضافية</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-60 shadow-md shadow-blue-500/20"
                >
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  <span>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal (Debt / Payment) */}
      {showTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onMouseDown={() => setShowTransaction(false)}
        >
          <div
            dir="rtl"
            onMouseDown={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <span
                  className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-extrabold ${
                    transactionType === "debt"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {transactionType === "debt" ? "إضافة دين جديد" : "تسجيل عملية تسديد"}
                </span>
                <h2 className="mt-1 text-base font-extrabold text-slate-900">
                  {selectedPerson?.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowTransaction(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransaction} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  المبلغ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={transactionForm.amount}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, amount: e.target.value })
                  }
                  placeholder="0"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-extrabold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  التاريخ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, date: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  ملاحظة أو وصف الحركة
                </label>
                <textarea
                  rows={2}
                  value={transactionForm.note}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, note: e.target.value })
                  }
                  placeholder="مثلاً: شراء بضاعة، دفعة نقدية، تحويل بنكي..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransaction(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:opacity-60 shadow-md ${
                    transactionType === "debt"
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                  }`}
                >
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  <span>
                    {saving
                      ? "جاري الحفظ..."
                      : transactionType === "debt"
                      ? "تأكيد إضافة الدين"
                      : "تأكيد التسديد"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default People;
