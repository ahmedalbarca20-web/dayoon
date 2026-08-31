import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "../services/supabase";
import { isUserAdmin } from "../services/admin";

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email || "");
        setIsAdminUser(isUserAdmin(data.user));
      }
    });
  }, []);

  async function handleLogout() {
    if (window.confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
      await supabase.auth.signOut();
      navigate("/login");
    }
  }

  // Admin only sees /admin route
  const adminMenuItems = [
    {
      label: "لوحة إدارة المكاتب",
      icon: ShieldAlert,
      path: "/admin",
    },
  ];

  // Regular office menu
  const officeMenuItems = [
    {
      label: "لوحة التحكم",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "الأشخاص والديون",
      icon: Users,
      path: "/people",
    },
    {
      label: "التقارير",
      icon: FileText,
      path: "/reports",
    },
    {
      label: "الإعدادات",
      icon: Settings,
      path: "/settings",
    },
  ];

  const menuItems = isAdminUser ? adminMenuItems : officeMenuItems;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-800 antialiased">
      {/* Mobile Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 active:scale-95"
          aria-label="فتح القائمة"
        >
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl font-extrabold text-white shadow-md ${
              isAdminUser
                ? "bg-gradient-to-tr from-indigo-700 to-indigo-500 shadow-indigo-500/20"
                : "bg-gradient-to-tr from-blue-700 to-blue-500 shadow-blue-500/20"
            }`}
          >
            {isAdminUser ? "A" : "د"}
          </div>
          <span className="font-extrabold text-base text-slate-900 tracking-tight">
            {isAdminUser ? "لوحة المشرف" : "دفتر الديون"}
          </span>
        </div>

        <div className="w-10" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") setSidebarOpen(false);
          }}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden print:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed right-0 top-0 z-50
          flex h-screen w-72 flex-col
          border-l border-slate-200/80
          bg-white shadow-xl shadow-slate-200/50 lg:shadow-none
          transition-transform duration-300 ease-in-out
          print:hidden
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Logo Header */}
        <div
          className={`flex h-20 items-center justify-between border-b border-slate-100 px-6 ${
            isAdminUser ? "bg-indigo-950" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-lg ${
                isAdminUser
                  ? "bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-500/25"
                  : "bg-gradient-to-tr from-blue-700 to-blue-500 shadow-blue-500/25"
              }`}
            >
              {isAdminUser ? "A" : "د"}
            </div>
            <div>
              <h1
                className={`font-extrabold text-base leading-tight ${
                  isAdminUser ? "text-white" : "text-slate-900"
                }`}
              >
                {isAdminUser ? "لوحة المشرف العام" : "دفتر الديون"}
              </h1>
              <p
                className={`text-xs font-medium mt-0.5 ${
                  isAdminUser ? "text-indigo-300" : "text-slate-400"
                }`}
              >
                {isAdminUser ? "Super Admin" : "نظام إدارة الحسابات"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition lg:hidden active:scale-95 ${
              isAdminUser
                ? "text-indigo-300 hover:bg-indigo-800 hover:text-white"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {isAdminUser && (
            <p className="mb-3 px-3 text-xs font-extrabold text-indigo-600 tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={13} />
              <span>صلاحيات المشرف</span>
            </p>
          )}

          {!isAdminUser && (
            <p className="mb-3 px-3 text-xs font-bold text-slate-400 tracking-wider">
              القائمة الرئيسية
            </p>
          )}

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  group relative flex w-full items-center justify-between
                  rounded-xl px-3.5 py-3 text-sm font-semibold
                  transition-all duration-200
                  ${
                    isActive
                      ? isAdminUser
                        ? "bg-indigo-50 text-indigo-600 shadow-xs"
                        : "bg-blue-50/90 text-blue-600 shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? isAdminUser
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-700"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <span>{item.label}</span>
                </div>

                {isActive && (
                  <ChevronLeft
                    size={16}
                    className={isAdminUser ? "text-indigo-500" : "text-blue-500"}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom User info & Logout */}
        <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/50">
          {userEmail && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-400">الحساب</p>
                {isAdminUser && (
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700">
                    مشرف عام
                  </span>
                )}
              </div>
              <p className="truncate text-xs font-bold text-slate-700 mt-0.5" dir="ltr">
                {userEmail}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-98"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100/70 text-rose-600">
              <LogOut size={17} />
            </div>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-h-screen transition-all lg:mr-72 print:mr-0 print:pt-0">
        <div className="pt-16 lg:pt-0 print:pt-0">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-none">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Layout;
