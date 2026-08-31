import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Wallet,
  CreditCard,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Clock,
  ArrowLeft,
  Loader2,
  PlusCircle,
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
    month: "short",
    day: "numeric",
  });
}

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [peopleWithDebts, setPeopleWithDebts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [statsData, setStatsData] = useState({
    peopleCount: 0,
    totalDebt: 0,
    totalPayments: 0,
    remaining: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);

        const office = await getCurrentOffice();
        if (!office) return;

        // Fetch people
        const { data: people } = await supabase
          .from("people")
          .select("*")
          .eq("office_id", office.id);

        // Fetch transactions
        const { data: transactions } = await supabase
          .from("transactions")
          .select("*, people(name)")
          .eq("office_id", office.id)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });

        const allTransactions = transactions || [];
        const allPeople = people || [];

        let totalDebt = 0;
        let totalPayments = 0;

        allTransactions.forEach((t) => {
          const type = (t.transaction_type || t.type || "").toLowerCase();
          const amt = Math.abs(Number(t.amount) || 0);
          if (type === "debt") totalDebt += amt;
          if (type === "payment") totalPayments += amt;
        });

        const remaining = Math.max(0, totalDebt - totalPayments);

        // Calculate balances per person
        const computedPeople = allPeople.map((p) => {
          const pTrans = allTransactions.filter((t) => t.person_id === p.id);
          const pDebt = pTrans
            .filter((t) => (t.transaction_type || t.type || "").toLowerCase() === "debt")
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
          const pPay = pTrans
            .filter((t) => (t.transaction_type || t.type || "").toLowerCase() === "payment")
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
          const bal = Math.max(0, pDebt - pPay);
          return { ...p, currentBalance: bal, totalDebt: pDebt, totalPayments: pPay };
        });

        const debtors = computedPeople
          .filter((p) => p.currentBalance > 0)
          .sort((a, b) => b.currentBalance - a.currentBalance)
          .slice(0, 5);

        setStatsData({
          peopleCount: allPeople.length,
          totalDebt,
          totalPayments,
          remaining,
        });

        setPeopleWithDebts(debtors);
        setRecentTransactions(allTransactions.slice(0, 5));
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const stats = [
    {
      title: "عدد الأشخاص",
      value: statsData.peopleCount,
      icon: Users,
      color: "blue",
      bgGradient: "from-blue-600 to-indigo-600",
      description: "إجمالي الأشخاص المسجلين",
    },
    {
      title: "إجمالي الديون",
      value: formatAmount(statsData.totalDebt),
      icon: Wallet,
      color: "rose",
      bgGradient: "from-rose-500 to-red-600",
      description: "إجمالي المبالغ المطلوبة",
    },
    {
      title: "إجمالي التسديدات",
      value: formatAmount(statsData.totalPayments),
      icon: CreditCard,
      color: "emerald",
      bgGradient: "from-emerald-500 to-teal-600",
      description: "إجمالي المبالغ المسددة",
    },
    {
      title: "المبلغ المتبقي",
      value: formatAmount(statsData.remaining),
      icon: AlertCircle,
      color: "amber",
      bgGradient: "from-amber-500 to-orange-600",
      description: "صافي الديون غير المسددة",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
            لوحة التحكم
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            نظرة عامة على الحسابات والديون والتحصيلات
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/people")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-98"
          >
            <PlusCircle size={18} />
            <span>إدارة الحسابات</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="relative overflow-hidden rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {stat.title}
                  </p>
                  <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {loading ? "..." : stat.value}
                  </p>
                </div>

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr ${stat.bgGradient} text-white shadow-md`}
                >
                  <Icon size={22} />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                <TrendingUp size={14} className="text-slate-400" />
                <p className="text-xs font-medium text-slate-400">
                  {stat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Debtors & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Top Debtors */}
        <div className="overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-xs xl:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-slate-900 text-base">
                  أعلى المبالغ المطلوبة
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  الأشخاص الذين لديهم أكبر مبالغ متبقية
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/people")}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
              >
                عرض الكل
                <ArrowLeft size={14} />
              </button>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                </div>
              ) : peopleWithDebts.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                  <div className="text-center">
                    <Users size={36} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-600">
                      لا توجد ديون مستحقة حالياً
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      ستظهر هنا قائمة الأشخاص المسجل عليهم ديون عند إضافتها
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {peopleWithDebts.map((person) => (
                    <div
                      key={person.id}
                      onClick={() => navigate(`/people/${person.id}/report`)}
                      className="group flex cursor-pointer items-center justify-between py-3.5 transition-colors hover:bg-slate-50/80 rounded-xl px-3 -mx-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-sm">
                          {person.name?.[0] || "ش"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {person.name}
                          </p>
                          {person.phone && (
                            <p className="text-xs text-slate-400 font-medium" dir="ltr">
                              {person.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="inline-block font-extrabold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg text-sm">
                          {formatAmount(person.currentBalance)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-bold text-slate-900 text-base">
                إجراءات سريعة
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                الوصول المباشر للعمليات الشائعة
              </p>
            </div>

            <div className="space-y-3 p-6">
              <button
                type="button"
                onClick={() => navigate("/people")}
                className="group flex w-full items-center gap-3.5 rounded-xl border border-slate-200/80 p-4 text-right transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-xs active:scale-98"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    إدارة الأشخاص
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 font-medium">
                    تسجيل شخص جديد أو تعديل بيانات
                  </p>
                </div>
                <ArrowUpRight size={18} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/people")}
                className="group flex w-full items-center gap-3.5 rounded-xl border border-slate-200/80 p-4 text-right transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-xs active:scale-98"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <CreditCard size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    تسجيل تسديد
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 font-medium">
                    إيداع دفعة أو تسديد لحساب شخص
                  </p>
                </div>
                <ArrowDownRight size={18} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/reports")}
                className="group flex w-full items-center gap-3.5 rounded-xl border border-slate-200/80 p-4 text-right transition-all hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-xs active:scale-98"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Clock size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    التقارير الشاملة
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 font-medium">
                    عرض كشوفات الحسابات والطباعة
                  </p>
                </div>
                <ArrowUpRight size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-bold text-slate-900 text-base">
              آخر الحركات والعمليات
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              سجل أحدث عمليات الشراء والتسديد المباشرة
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
          >
            سجل العمليات
            <ArrowLeft size={14} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex min-h-36 items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
              <div className="text-center">
                <Wallet size={34} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-600">
                  لا توجد حركات مسجلة حالياً
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  عند إضافة ديون أو تسديدات جديدة ستظهر في هذا السجل
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                    <th className="pb-3 pr-2">الشخص</th>
                    <th className="pb-3 px-3">النوع</th>
                    <th className="pb-3 px-3">المبلغ</th>
                    <th className="pb-3 px-3">التاريخ</th>
                    <th className="pb-3 pl-2">ملاحظة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => {
                    const isTxDebt =
                      (tx.transaction_type || tx.type || "").toLowerCase() === "debt";
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 pr-2 font-bold text-slate-900">
                          {tx.people?.name || "عميل"}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                              isTxDebt
                                ? "bg-rose-50 text-rose-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {isTxDebt ? "دين جديد" : "تسديد"}
                          </span>
                        </td>
                        <td
                          className={`py-3.5 px-3 font-extrabold ${
                            isTxDebt ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {formatAmount(tx.amount)}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-500 font-medium">
                          {formatDate(tx.transaction_date || tx.created_at)}
                        </td>
                        <td className="py-3.5 pl-2 text-xs text-slate-500 max-w-xs truncate">
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
      </div>
    </div>
  );
}

export default Dashboard;
