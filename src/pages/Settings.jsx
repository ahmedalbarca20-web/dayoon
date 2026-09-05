import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Database, LogOut, Check, LockKeyhole, Loader2 } from "lucide-react";
import { supabase } from "../services/supabase";
import { getCurrentOffice, updateOfficeProfile } from "../services/people";

export default function Settings() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState("");
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data?.user?.email) {
          setUserEmail(data.user.email);
        }

        const office = await getCurrentOffice();
        if (!office) {
          throw new Error("لم يتم العثور على بيانات المكتب الحالية");
        }

        if (!cancelled) {
          setConnectionStatus("connected");
        }
        if (!cancelled && office?.name) {
          setOfficeName(office.name);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setConnectionStatus("error");
          setError(err?.message || "تعذر الاتصال بقاعدة البيانات");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      await supabase.auth.signOut();
      navigate("/login");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!officeName.trim()) {
      setError("يرجى إدخال اسم المكتب");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await updateOfficeProfile({ name: officeName.trim() });
      setSavedSuccess("تم حفظ اسم المكتب بنجاح");
      setTimeout(() => setSavedSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر حفظ التغييرات");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق");
      return;
    }

    try {
      setSavingPassword(true);
      setError("");
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setSavedSuccess("تم تغيير كلمة المرور بنجاح");
      setTimeout(() => setSavedSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err?.message || "تعذر تغيير كلمة المرور");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
          الإعدادات
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          إعدادات الحساب والمكتب والخيارات العامة للنظام
        </p>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-700">
          <Check size={16} />
          <span>{savedSuccess}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <User size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">بيانات الحساب</h2>
            <p className="text-xs text-slate-400">معلومات الدخول والمكتب المسجل</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              البريد الإلكتروني
            </label>
            <input
              type="text"
              disabled
              value={loading ? "..." : userEmail || "—"}
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500 outline-none text-right"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              اسم المتجر أو المكتب
            </label>
            <input
              type="text"
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
              placeholder="مثال: مؤسسة الأمانة التجارية"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-98 transition disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>{saving ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">تغيير كلمة المرور</h2>
            <p className="text-xs text-slate-400">تحديث كلمة مرور حساب الدخول</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {savingPassword && <Loader2 size={14} className="animate-spin" />}
            <span>{savingPassword ? "جاري التحديث..." : "تغيير كلمة المرور"}</span>
          </button>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Database size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">حالة النظام وقاعدة البيانات</h2>
            <p className="text-xs text-slate-400">اتصال Supabase والمزامنة السحابية</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : connectionStatus === "checking"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-xs font-bold text-slate-700">اتصال السحابة (Supabase)</span>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                connectionStatus === "connected"
                  ? "text-emerald-600 bg-emerald-50"
                  : connectionStatus === "checking"
                  ? "text-amber-600 bg-amber-50"
                  : "text-rose-600 bg-rose-50"
              }`}
            >
              {connectionStatus === "connected"
                ? "متصل ونشط"
                : connectionStatus === "checking"
                ? "جاري الفحص..."
                : "تعذر الاتصال"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-bold text-slate-700">نسخة التطبيق</span>
            <span className="text-xs font-bold text-slate-500" dir="ltr">v1.2.0</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-rose-100 bg-rose-50/40 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">تسجيل الخروج</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إنهاء الجلسة الحالية والعودة لصفحة تسجيل الدخول
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 hover:bg-rose-700 active:scale-98 transition"
          >
            <LogOut size={16} />
            <span>تسجيل الخروج الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
