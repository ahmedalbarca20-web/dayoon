import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LockKeyhole, Mail, AlertCircle, ShieldCheck } from "lucide-react";
import { supabase } from "../services/supabase";
import { isUserAdmin } from "../services/admin";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function redirectIfLoggedIn() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data?.user) {
        navigate(isUserAdmin(data.user) ? "/admin" : "/dashboard", { replace: true });
        return;
      }
      setCheckingSession(false);
    }

    redirectIfLoggedIn();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleLogin(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        throw loginError;
      }

      navigate(isUserAdmin(data.user) ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 p-4"
    >
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/60 border border-slate-100">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-2xl font-black text-white shadow-xl shadow-blue-500/25">
              د
            </div>

            <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">
              دفتر الديون
            </h1>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              نظام إدارة ومتابعة الحسابات والديون
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700">
              <AlertCircle size={17} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                البريد الإلكتروني
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  dir="ltr"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pr-11 pl-4 text-sm font-medium outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 text-right"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                كلمة المرور
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pr-11 pl-4 text-sm font-medium outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 text-right"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>نظام محمي ومشفر بالكامل عبر Supabase</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
