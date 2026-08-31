import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "../services/supabase";
import { isUserAdmin } from "../services/admin";
import { getCurrentOffice } from "../services/people";

function Blocked({ title, message }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">{message}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, role = "office" }) {
  const location = useLocation();
  const [state, setState] = useState({
    status: "loading",
    reason: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;

        if (!user) {
          if (!cancelled) setState({ status: "unauthenticated", reason: "" });
          return;
        }

        const admin = isUserAdmin(user);

        if (role === "admin") {
          if (!admin) {
            if (!cancelled) setState({ status: "office-home", reason: "" });
            return;
          }
          if (!cancelled) setState({ status: "ok", reason: "" });
          return;
        }

        if (admin) {
          if (!cancelled) setState({ status: "admin-home", reason: "" });
          return;
        }

        const office = await getCurrentOffice();

        if (!office) {
          if (!cancelled) {
            setState({
              status: "blocked",
              reason: "لم يتم ربط حسابك بمكتب. تواصل مع المشرف لإكمال التسجيل.",
            });
          }
          return;
        }

        if (office.active === false) {
          if (!cancelled) {
            setState({
              status: "blocked",
              reason: "تم إيقاف حساب المكتب. تواصل مع المشرف لتفعيله.",
            });
          }
          return;
        }

        if (office.contract_end) {
          const end = new Date(office.contract_end);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (!Number.isNaN(end.getTime()) && end < today) {
            if (!cancelled) {
              setState({
                status: "blocked",
                reason: "انتهت فترة الاشتراك. تواصل مع المشرف لتجديد العقد.",
              });
            }
            return;
          }
        }

        if (!cancelled) setState({ status: "ok", reason: "" });
      } catch (err) {
        console.error("Access check error:", err);
        if (!cancelled) {
          setState({
            status: "blocked",
            reason: "تعذر التحقق من صلاحية الدخول. حاول مرة أخرى.",
          });
        }
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [role, location.pathname]);

  if (state.status === "loading") {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span className="text-sm font-semibold">جاري التحقق من الجلسة...</span>
        </div>
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (state.status === "admin-home") {
    return <Navigate to="/admin" replace />;
  }

  if (state.status === "office-home") {
    return <Navigate to="/dashboard" replace />;
  }

  if (state.status === "blocked") {
    return (
      <Blocked
        title="غير مسموح بالدخول"
        message={state.reason}
      />
    );
  }

  return children;
}
