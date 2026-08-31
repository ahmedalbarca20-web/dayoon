import { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  Download,
  Search,
  Wallet,
  CreditCard,
  AlertCircle,
  Percent,
  Loader2,
  Users,
} from "lucide-react";
import { supabase } from "../services/supabase";
import { getCurrentOffice } from "../services/people";

function formatAmount(value) {
  return Math.abs(Number(value) || 0).toLocaleString("en-US");
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, debt, payment
  const [dateFilter, setDateFilter] = useState("all"); // all, month, year

  useEffect(() => {
    async function loadReportsData() {
      try {
        setLoading(true);
        const office = await getCurrentOffice();
        if (!office) return;

        const { data: peopleData } = await supabase
          .from("people")
          .select("*")
          .eq("office_id", office.id);

        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*, people(name, phone)")
          .eq("office_id", office.id)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });

        setPeople(peopleData || []);
        setTransactions(transactionsData || []);
      } catch (err) {
        console.error("Reports loading error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadReportsData();
  }, []);

  // Filter calculations
  const filteredTransactions = transactions.filter((t) => {
    const type = (t.transaction_type || t.type || "").toLowerCase();
    if (filterType !== "all" && type !== filterType) return false;

    if (dateFilter === "month") {
      const txDate = new Date(t.transaction_date || t.created_at);
      const now = new Date();
      if (
        txDate.getMonth() !== now.getMonth() ||
        txDate.getFullYear() !== now.getFullYear()
      ) {
        return false;
      }
    } else if (dateFilter === "year") {
      const txDate = new Date(t.transaction_date || t.created_at);
      const now = new Date();
      if (txDate.getFullYear() !== now.getFullYear()) return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const personName = t.people?.name?.toLowerCase() || "";
      const personPhone = t.people?.phone || "";
      const note = t.note?.toLowerCase() || "";
      if (!personName.includes(q) && !personPhone.includes(q) && !note.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const totalDebt = transactions
    .filter((t) => (t.transaction_type || t.type || "").toLowerCase() === "debt")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

  const totalPayments = transactions
    .filter((t) => (t.transaction_type || t.type || "").toLowerCase() === "payment")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

  const remaining = Math.max(0, totalDebt - totalPayments);
  const collectionRate = totalDebt > 0 ? Math.round((totalPayments / totalDebt) * 100) : 0;

  const peopleBalances = people
    .map((p) => {
      const pTrans = transactions.filter((t) => t.person_id === p.id);
      const pDebt = pTrans
        .filter((t) => (t.transaction_type || t.type || "").toLowerCase() === "debt")
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
      const pPay = pTrans
        .filter((t) => (t.transaction_type || t.type || "").toLowerCase() === "payment")
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
      return { ...p, remaining: Math.max(0, pDebt - pPay) };
    })
    .filter((p) => p.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  function exportCsv() {
    const rows = [
      ["الشخص", "النوع", "المبلغ", "التاريخ", "الملاحظة"],
      ...filteredTransactions.map((tx) => {
        const isTxDebt = (tx.transaction_type || tx.type || "").toLowerCase() === "debt";
        return [
          tx.people?.name || "",
          isTxDebt ? "دين" : "تسديد",
          String(Math.abs(Number(tx.amount) || 0)),
          tx.transaction_date || tx.created_at || "",
          tx.note || "",
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "debt-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
            التقارير والإحصائيات
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            كشوفات الحسابات الإجمالية ونسب السداد والتحصيل
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 active:scale-98 transition"
          >
            <Download size={18} />
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-98 transition"
          >
            <Printer size={18} />
            <span>طباعة التقرير الشامل</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              إجمالي الديون المسجلة
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Wallet size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-rose-600 tracking-tight">
            {formatAmount(totalDebt)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            مجموع كل عمليات الشراء والديون
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              إجمالي التحصيلات
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600 tracking-tight">
            {formatAmount(totalPayments)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            مجموع كل الدفعات المسددة
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              المبالغ المتبقية في السوق
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-600 tracking-tight">
            {formatAmount(remaining)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            صافي المستحقات غير المحصلة
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              نسبة التحصيل
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Percent size={20} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-blue-600 tracking-tight">
            {collectionRate}%
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Report Document Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs print:border-0 print:p-0 print:shadow-none">
        {/* Printable Report Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 pb-5 gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              سجل العمليات والحركات الشامل
            </h2>
            <p className="mt-0.5 text-xs text-slate-400 font-medium">
              عرض تفصيلي لجميع حركات الديون والتسديدات
            </p>
          </div>

          {/* Filter Tools */}
          <div className="flex flex-wrap items-center gap-2 print:hidden w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في السجل..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pr-9 pl-4 text-xs outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">كل الحركات</option>
              <option value="debt">ديون فقط</option>
              <option value="payment">تسديدات فقط</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">كل الفترات</option>
              <option value="month">الشهر الحالي</option>
              <option value="year">السنة الحالية</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="text-sm font-semibold">جاري تجهيز بيانات التقرير...</span>
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
            <FileText size={42} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-slate-700">
              لا توجد عمليات تطابق البحث
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              قم بتغيير خيارات التصفية أو البحث لعرض الحركات
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[700px] text-right text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">العميل / الشخص</th>
                  <th className="px-4 py-3.5">نوع الحركة</th>
                  <th className="px-4 py-3.5">المبلغ</th>
                  <th className="px-4 py-3.5">التاريخ</th>
                  <th className="px-4 py-3.5">البيان / الملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx, idx) => {
                  const isTxDebt =
                    (tx.transaction_type || tx.type || "").toLowerCase() === "debt";

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {tx.people?.name || "عميل"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                            isTxDebt
                              ? "bg-rose-50 text-rose-600"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {isTxDebt ? "دين" : "تسديد"}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-black ${
                          isTxDebt ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatAmount(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                        {formatDate(tx.transaction_date || tx.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {tx.note || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && peopleBalances.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs print:border-0">
          <div className="mb-5 flex items-center gap-2">
            <Users size={18} className="text-slate-400" />
            <h2 className="text-lg font-extrabold text-slate-900">الأشخاص الذين عليهم مبالغ متبقية</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th className="px-4 py-3">الشخص</th>
                  <th className="px-4 py-3">الهاتف</th>
                  <th className="px-4 py-3">المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {peopleBalances.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500" dir="ltr">{p.phone || "—"}</td>
                    <td className="px-4 py-3 font-extrabold text-rose-600">{formatAmount(p.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
