import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import { supabase } from "../services/supabase";
import {
  isUserAdmin,
  getAllOffices,
  createOffice,
  updateOffice,
  deleteOffice,
  getPlatformStats,
} from "../services/admin";

function formatDate(date) {
  if (!date) return "مفتوح / دائم";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getContractStatus(contractEnd) {
  if (!contractEnd) {
    return { label: "عقد دائم", color: "text-slate-700 bg-slate-100", state: "permanent" };
  }
  const today = new Date();
  const end = new Date(contractEnd);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "منتهي الصلاحية", color: "text-rose-700 bg-rose-50 border border-rose-200", state: "expired" };
  }
  if (diffDays <= 15) {
    return { label: `ينتهي خلال ${diffDays} يوم`, color: "text-amber-700 bg-amber-50 border border-amber-200", state: "warning" };
  }
  return { label: "نشط وساري", color: "text-emerald-700 bg-emerald-50 border border-emerald-200", state: "active" };
}

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [offices, setOffices] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    contract_start: new Date().toISOString().split("T")[0],
    contract_end: "",
    active: true,
  });

  async function checkAdminAccessAndLoad() {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        navigate("/login");
        return;
      }

      const adminRole = isUserAdmin(userData.user);
      if (!adminRole) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await refreshData();
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshData() {
    const [officesList, platformStats] = await Promise.all([
      getAllOffices(),
      getPlatformStats(),
    ]);
    setOffices(officesList);
    setStats(platformStats);
  }

  useEffect(() => {
    checkAdminAccessAndLoad();
  }, []);

  async function handleToggleActive(office) {
    try {
      setTogglingId(office.id);
      const newActive = !office.active;
      await updateOffice(office.id, { active: newActive });
      setOffices((prev) =>
        prev.map((o) => (o.id === office.id ? { ...o, active: newActive } : o))
      );
      await refreshData();
    } catch (err) {
      console.error(err);
      alert("تعذر تعديل حالة تفعيل المكتب");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreateOffice(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("يرجى إدخال اسم المكتب");
      return;
    }
    if (!form.email.trim()) {
      alert("يرجى إدخال البريد الإلكتروني لحساب الدخول");
      return;
    }
    if (!form.password || form.password.length < 6) {
      alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    try {
      setSaving(true);
      await createOffice(form);
      setShowCreateModal(false);
      setForm({
        name: "",
        username: "",
        email: "",
        password: "",
        contract_start: new Date().toISOString().split("T")[0],
        contract_end: "",
        active: true,
      });
      await refreshData();
    } catch (err) {
      console.error(err);
      alert(err?.message || "تعذر إضافة المكتب");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditOffice(e) {
    e.preventDefault();
    if (!selectedOffice) return;

    try {
      setSaving(true);
      await updateOffice(selectedOffice.id, {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email ? form.email.trim() : null,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        active: form.active,
      });
      setShowEditModal(false);
      setSelectedOffice(null);
      await refreshData();
    } catch (err) {
      console.error(err);
      alert(err?.message || "تعذر تحديث بيانات المكتب");
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(office) {
    setSelectedOffice(office);
    setForm({
      name: office.name || "",
      username: office.username || "",
      email: office.email || "",
      contract_start: office.contract_start || "",
      contract_end: office.contract_end || "",
      active: office.active !== undefined ? office.active : true,
    });
    setShowEditModal(true);
  }

  async function handleDeleteOffice(office) {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف مكتب "${office.name}" من النظام؟`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(office.id);
      await deleteOffice(office.id);
      setOffices((prev) => prev.filter((o) => o.id !== office.id));
      await refreshData();
    } catch (err) {
      console.error(err);
      alert("تعذر حذف المكتب");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredOffices = offices.filter((office) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      office.name?.toLowerCase().includes(query) ||
      office.username?.toLowerCase().includes(query) ||
      office.email?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (statusFilter === "active") return office.active;
    if (statusFilter === "inactive") return !office.active;
    if (statusFilter === "expired") {
      const contractStatus = getContractStatus(office.contract_end);
      return contractStatus.state === "expired";
    }

    return true;
  });

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 size={28} className="animate-spin text-blue-600" />
          <span className="text-sm font-bold">جاري تحميل لوحة إدارة المكاتب...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div dir="rtl" className="my-12 max-w-xl mx-auto rounded-3xl bg-white p-8 border border-slate-200 text-center shadow-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">غير مصرح بالدخول</h2>
        <p className="mt-2 text-sm text-slate-500">
          هذه الصفحة مخصصة لمدير النظام لإدارة الاشتراكات والمكاتب فقط.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8">
      {/* Top Admin Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30">
              <Building2 size={28} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/20 px-2.5 py-0.5 text-xs font-extrabold text-blue-300 border border-blue-400/30 mb-1">
                <span>إدارة المشتركين والمكاتب</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                لوحة المشرف العام
              </h1>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                إدارة تراخيص المكاتب، تفعيل الحسابات، ومتابعة فترات الاشتراكات والعقود
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refreshData}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-xs hover:bg-white/20 transition"
            >
              <RefreshCw size={15} />
              <span>تحديث</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({
                  name: "",
                  username: "",
                  email: "",
                  password: "",
                  contract_start: new Date().toISOString().split("T")[0],
                  contract_end: "",
                  active: true,
                });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 active:scale-98 transition"
            >
              <Plus size={16} />
              <span>إضافة مكتب جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subscription & Offices Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              إجمالي المكاتب
            </span>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {stats.totalOffices}
            </p>
            <p className="mt-1 text-xs text-slate-400 font-medium">
              العدد الإجمالي للمنظومات المسجلة
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              المكاتب النشطة
            </span>
            <p className="mt-2 text-3xl font-black text-emerald-600">
              {stats.activeOffices}
            </p>
            <p className="mt-1 text-xs text-slate-400 font-medium">
              حسابات مفعلة ومتاحة للاستخدام
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              المكاتب المعطلة
            </span>
            <p className="mt-2 text-3xl font-black text-rose-600">
              {stats.inactiveOffices}
            </p>
            <p className="mt-1 text-xs text-slate-400 font-medium">
              حسابات تم إيقافها مؤقتاً
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              العقود المنتهية
            </span>
            <p className="mt-2 text-3xl font-black text-amber-600">
              {stats.expiredContracts}
            </p>
            <p className="mt-1 text-xs text-slate-400 font-medium">
              مكاتب انتهت فترة اشتراكها
            </p>
          </div>
        </div>
      )}

      {/* Offices Table */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              قائمة المكاتب المسجلة ({offices.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة تفعيل الحسابات وتحديث تواريخ العقود
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن مكتب..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pr-9 pl-4 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === "active" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-500"
                }`}
              >
                النشطة
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === "inactive" ? "bg-white text-rose-600 shadow-xs" : "text-slate-500"
                }`}
              >
                المعطلة
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("expired")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === "expired" ? "bg-white text-amber-600 shadow-xs" : "text-slate-500"
                }`}
              >
                منتهية العقد
              </button>
            </div>
          </div>
        </div>

        {filteredOffices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
            <Building2 size={44} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-slate-700">لا توجد مكاتب مسجلة تطابق البحث</h3>
            <p className="mt-1 text-xs text-slate-400">تأكد من كتابة الاسم أو الإيميل بشكل صحيح</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[750px] text-right text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                  <th className="px-4 py-3.5">اسم المكتب / المنظومة</th>
                  <th className="px-4 py-3.5">اسم المستخدم / البريد</th>
                  <th className="px-4 py-3.5">حالة الحساب</th>
                  <th className="px-4 py-3.5">تاريخ البداية</th>
                  <th className="px-4 py-3.5">نهاية العقد</th>
                  <th className="px-4 py-3.5">صلاحية الاشتراك</th>
                  <th className="px-4 py-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOffices.map((office) => {
                  const contractInfo = getContractStatus(office.contract_end);

                  return (
                    <tr key={office.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-extrabold text-sm">
                            {office.name?.[0] || "م"}
                          </div>
                          <span>{office.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-slate-500" dir="ltr">
                        {office.email || office.username || "—"}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          disabled={togglingId === office.id}
                          onClick={() => handleToggleActive(office)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 ${
                            office.active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {togglingId === office.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : office.active ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <XCircle size={14} className="text-rose-500" />
                          )}
                          <span>{office.active ? "مفعّل" : "معطّل"}</span>
                        </button>
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-slate-600">
                        {formatDate(office.contract_start || office.created_at)}
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-slate-600">
                        {formatDate(office.contract_end)}
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${contractInfo.color}`}>
                          {contractInfo.label}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            title="تعديل المكتب والعقد"
                            onClick={() => openEditModal(office)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            <Edit size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === office.id}
                            title="حذف المكتب"
                            onClick={() => handleDeleteOffice(office)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition disabled:opacity-50"
                          >
                            {deletingId === office.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Office Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onMouseDown={() => setShowCreateModal(false)}
        >
          <div
            dir="rtl"
            onMouseDown={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">إضافة مكتب جديد</h2>
                <p className="text-xs text-slate-400 mt-0.5">تسجيل منظومة جديدة وتحديد فترة الاشتراك</p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOffice} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  اسم المكتب / المنظومة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: منظومة الأمانة"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    اسم المستخدم (Username)
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="user1"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    البريد الإلكتروني <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="office@example.com"
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none text-right focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  كلمة مرور الدخول <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="6 أحرف على الأقل"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    تاريخ بداية العقد
                  </label>
                  <input
                    type="date"
                    value={form.contract_start}
                    onChange={(e) => setForm({ ...form, contract_start: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    تاريخ نهاية العقد (اختياري)
                  </label>
                  <input
                    type="date"
                    value={form.contract_end}
                    onChange={(e) => setForm({ ...form, contract_end: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="active-create"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active-create" className="text-xs font-bold text-slate-700 cursor-pointer">
                  تفعيل الحساب فوراً
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  <span>{saving ? "جاري الإضافة..." : "حفظ المكتب"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Office Modal */}
      {showEditModal && selectedOffice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          onMouseDown={() => setShowEditModal(false)}
        >
          <div
            dir="rtl"
            onMouseDown={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">تعديل بيانات المكتب والاشتراك</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedOffice.name}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditOffice} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  اسم المكتب / المنظومة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    اسم المستخدم (Username)
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="text"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none text-right focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    تاريخ بداية العقد
                  </label>
                  <input
                    type="date"
                    value={form.contract_start}
                    onChange={(e) => setForm({ ...form, contract_start: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    تاريخ نهاية العقد (اختياري)
                  </label>
                  <input
                    type="date"
                    value={form.contract_end}
                    onChange={(e) => setForm({ ...form, contract_end: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="active-edit"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active-edit" className="text-xs font-bold text-slate-700 cursor-pointer">
                  حالة المكتب مفعّلة
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  <span>{saving ? "جاري التحديث..." : "حفظ التعديلات"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
