import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Printer,
  User,
  Phone,
  CalendarDays,
  CreditCard,
  Banknote,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Wallet,
} from "lucide-react";

import { supabase } from "../services/supabase";
import { getCurrentOffice } from "../services/people";

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

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PersonReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [person, setPerson] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTransaction, setShowTransaction] = useState(false);
  const [transactionType, setTransactionType] = useState("debt");
  const [saving, setSaving] = useState(false);
  const [txForm, setTxForm] = useState({
    amount: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });



  async function loadReport() {
    try {
      setLoading(true);
      setError("");

      const office = await getCurrentOffice();
      if (!office) return;

      const { data: personData, error: personError } = await supabase
        .from("people")
        .select("*")
        .eq("id", id)
        .eq("office_id", office.id)
        .maybeSingle();

      if (personError) throw personError;
      if (!personData) throw new Error("الشخص غير موجود");

      const { data: transactionData, error: transactionError } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("person_id", id)
          .eq("office_id", office.id)
          .order("transaction_date", { ascending: true })
          .order("created_at", { ascending: true });

      if (transactionError) throw transactionError;

      setPerson(personData);
      setTransactions(transactionData || []);
    } catch (err) {
      console.error("خطأ في تقرير الشخص:", err);
      setError(err?.message || "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [id]);

  async function handleAddTransaction(e) {
    e.preventDefault();
    const amount = Math.abs(Number(txForm.amount) || 0);
    if (amount <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }

    try {
      setSaving(true);
      const office = await getCurrentOffice();
      if (!office) return;

      const { error: txError } = await supabase.from("transactions").insert({
        office_id: office.id,
        person_id: id,
        type: transactionType,
        transaction_type: transactionType,
        amount,
        note: txForm.note.trim() || null,
        transaction_date: txForm.date,
      });

      if (txError) throw txError;

      // Update person balance
      const currentBalance = Math.abs(Number(person.balance) || 0);
      let newBalance = currentBalance;
      if (transactionType === "debt") newBalance = currentBalance + amount;
      if (transactionType === "payment") newBalance = Math.max(0, currentBalance - amount);

      await supabase
        .from("people")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("office_id", office.id);

      setShowTransaction(false);
      setTxForm({
        amount: "",
        note: "",
        date: new Date().toISOString().split("T")[0],
      });
      await loadReport();
    } catch (err) {
      console.error(err);
      alert(err?.message || "تعذر إضافة الحركة");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span className="text-sm font-semibold">جاري تحميل كشف الحساب...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/people")}
          className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
        >
          <ArrowRight size={18} />
          العودة للأشخاص
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!person) return null;

  const totalDebt = transactions
    .filter(isDebt)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

  const totalPayments = transactions
    .filter(isPayment)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

  const balance = Math.max(0, totalDebt - totalPayments);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <button
          type="button"
          onClick={() => navigate("/people")}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 active:scale-98 transition"
        >
          <ArrowRight size={18} />
          <span>العودة للأشخاص</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setTransactionType("debt");
              setShowTransaction(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 active:scale-98 transition"
          >
            <CreditCard size={16} />
            <span>+ إضافة دين</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTransactionType("payment");
              setShowTransaction(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100 active:scale-98 transition"
          >
            <Banknote size={16} />
            <span>+ تسجيل تسديد</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-98 transition"
          >
            <Printer size={18} />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div
        id="person-report"
        className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xs print:border-0 print:p-0 print:shadow-none"
      >
        {/* Report Header */}
        <div className="mb-8 flex flex-col items-center justify-between border-b border-slate-200 pb-6 sm:flex-row text-center sm:text-right gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-extrabold text-white print:bg-slate-900">
              د
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                كشف حساب عميل
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                دفتر الديون - تقرير العمليات والحسابات التفصيلي
              </p>
            </div>
          </div>

          <div className="text-center sm:text-left text-xs font-medium text-slate-500">
            <p>تاريخ استخراج التقرير:</p>
            <p className="font-bold text-slate-700 mt-0.5" dir="ltr">
              {new Date().toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        {/* Customer Information Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 print:border-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <User size={15} />
              <span>اسم العميل</span>
            </div>
            <p className="mt-1.5 font-bold text-slate-900 text-base">
              {person.name}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 print:border-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Phone size={15} />
              <span>رقم الهاتف</span>
            </div>
            <p className="mt-1.5 font-bold text-slate-900 text-base" dir="ltr">
              {person.phone || "غير مسجل"}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 print:border-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <CalendarDays size={15} />
              <span>تاريخ فتح الحساب</span>
            </div>
            <p className="mt-1.5 font-bold text-slate-900 text-base">
              {formatDate(person.created_at)}
            </p>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total Debt */}
          <div className="rounded-2xl bg-rose-50/80 p-5 border border-rose-100 print:border-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
              <CreditCard size={17} />
              <span>إجمالي المبالغ المطلوبة (الديون)</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-700">
              {formatAmount(totalDebt)}
            </p>
          </div>

          {/* Total Payments */}
          <div className="rounded-2xl bg-emerald-50/80 p-5 border border-emerald-100 print:border-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <Banknote size={17} />
              <span>إجمالي المبالغ المسددة</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">
              {formatAmount(totalPayments)}
            </p>
          </div>

          {/* Current Remaining Balance */}
          <div className="rounded-2xl bg-blue-50/80 p-5 border border-blue-100 print:border-slate-300">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
              <Wallet size={17} />
              <span>صافي المبلغ المطلوب (المتبقي)</span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-700">
              {formatAmount(balance)}
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-slate-400" />
              <span>جدول العمليات والحركات التفصيلية ({transactions.length})</span>
            </h2>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500 bg-slate-50">
              لا توجد عمليات مسجلة لهذا الشخص حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[650px] text-right text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                    <th className="px-4 py-3.5 w-12 text-center">#</th>
                    <th className="px-4 py-3.5">التاريخ</th>
                    <th className="px-4 py-3.5">نوع الحركة</th>
                    <th className="px-4 py-3.5">المبلغ</th>
                    <th className="px-4 py-3.5">الرصيد بعد الحركة</th>
                    <th className="px-4 py-3.5">البيان / الملاحظة</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    let running = 0;
                    return transactions.map((transaction, index) => {
                    const debt = isDebt(transaction);
                    const amt = Math.abs(Number(transaction.amount) || 0);
                    running = debt ? running + amt : Math.max(0, running - amt);

                    return (
                      <tr key={transaction.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700 text-xs">
                          {formatDate(transaction.transaction_date || transaction.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                              debt
                                ? "bg-rose-50 text-rose-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {debt ? "دين مطلوب" : "تسديد دفعة"}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 font-extrabold text-sm ${
                            debt ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {formatAmount(transaction.amount)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 text-sm">
                          {formatAmount(running)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs font-medium">
                          {transaction.note || "-"}
                        </td>
                      </tr>
                    );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Final Outstanding Total Box */}
        <div className="mt-8 flex items-center justify-between rounded-2xl bg-slate-900 px-6 py-5 text-white shadow-sm print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300">
          <div>
            <span className="text-sm font-bold opacity-80">
              إجمالي المبلغ النهائي المستحق
            </span>
            <p className="text-xs text-slate-300 print:text-slate-500 mt-0.5">
              {balance === 0 ? "الحساب خالص تماماً" : "مطلوب سداده"}
            </p>
          </div>

          <span className="text-2xl sm:text-3xl font-black text-amber-400 print:text-slate-900">
            {formatAmount(balance)}
          </span>
        </div>

        {/* Signatures for Print Mode */}
        <div className="mt-20 hidden grid-cols-2 gap-16 print:grid">
          <div className="text-center">
            <p className="font-bold text-sm text-slate-800">توقيع وختم الإدارة</p>
            <div className="mt-14 border-b border-slate-400" />
          </div>

          <div className="text-center">
            <p className="font-bold text-sm text-slate-800">توقيع المستلم / العميل</p>
            <div className="mt-14 border-b border-slate-400" />
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto print:hidden"
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
                  {person.name}
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

            <form onSubmit={handleAddTransaction} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  المبلغ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={txForm.amount}
                  onChange={(e) =>
                    setTxForm({ ...txForm, amount: e.target.value })
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
                  value={txForm.date}
                  onChange={(e) =>
                    setTxForm({ ...txForm, date: e.target.value })
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
                  value={txForm.note}
                  onChange={(e) =>
                    setTxForm({ ...txForm, note: e.target.value })
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
