import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  Mail,
  Compass,
  Package,
  CreditCard,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  RefreshCw,
  Menu,
  X,
  Lock,
  Trash2,
  Phone,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export const AdminLayout: React.FC = () => {
  const { admin, logout, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Click outside listener for profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout();
    navigate("/login");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/users", label: "Users & Admins", icon: Users },
    { to: "/organizations", label: "Organizations", icon: Building2 },
    { to: "/subscriptions", label: "Subscriptions", icon: CreditCard },
    { to: "/plans", label: "Plans & Pricing", icon: Package },
    { to: "/invitations", label: "Invitations", icon: Mail },
    { to: "/onboarding", label: "Onboarding Funnel", icon: Compass },
    { to: "/products", label: "Products Catalog", icon: Package },
    { to: "/phone-challenges", label: "Phone Challenges", icon: Phone },
    { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
    { to: "/deletions", label: "Deletion Queue", icon: Trash2 },
    { to: "/settings", label: "System & Flags", icon: Settings },
  ];

  const adminAvatar = admin?.avatarUrl || admin?.avatar;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-600/20 border border-brand-500/30">
            <Lock className="w-4 h-4 text-brand-400" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">Orviohub Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md overflow-hidden shrink-0 border border-slate-700">
            {adminAvatar ? (
              <img
                src={adminAvatar}
                alt={admin?.name || "Admin"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : admin?.name ? (
              admin.name.substring(0, 2).toUpperCase()
            ) : (
              "SA"
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">Orviohub</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Super
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Administration Portal</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Current Admin Card & Actions */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 space-y-3">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md overflow-hidden shrink-0 border border-slate-700">
              {adminAvatar ? (
                <img
                  src={adminAvatar}
                  alt={admin?.name || "Admin"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : admin?.name ? (
                admin.name.substring(0, 2).toUpperCase()
              ) : (
                "SA"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{admin?.name || "Admin"}</p>
              <p className="text-[11px] text-slate-400 truncate">{admin?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              title="Refresh session token"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-brand-400" : ""}`} />
              <span>Extend</span>
            </button>
            <button
              onClick={handleLogout}
              title="Sign out of admin console"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-medium border border-rose-500/20 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link to="/dashboard" className="hover:text-slate-200">Orviohub Admin</Link>
            <span>/</span>
            <span className="text-slate-200 capitalize">Portal</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Super Admin Active</span>
            </div>

            {/* Admin Header Avatar & Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition text-xs text-white cursor-pointer shadow-sm"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center font-bold text-white text-[11px] shadow-sm overflow-hidden shrink-0 border border-slate-600">
                  {adminAvatar ? (
                    <img
                      src={adminAvatar}
                      alt={admin?.name || "Admin"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : admin?.name ? (
                    admin.name.substring(0, 2).toUpperCase()
                  ) : (
                    "SA"
                  )}
                </div>
                <div className="text-left">
                  <span className="font-semibold block leading-none max-w-[120px] truncate">
                    {admin?.name?.split(" ")[0] || "Admin"}
                  </span>
                  <span className="text-[10px] text-brand-400 block leading-tight font-medium">Super Admin</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileDropdownOpen ? "rotate-180 text-white" : ""}`} />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-800/80 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0 shadow-sm border border-slate-700">
                      {adminAvatar ? (
                        <img
                          src={adminAvatar}
                          alt={admin?.name || "Admin"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : admin?.name ? (
                        admin.name.substring(0, 2).toUpperCase()
                      ) : (
                        "SA"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-xs truncate">{admin?.name || "Super Admin"}</p>
                      <p className="text-[10px] text-slate-400 truncate">{admin?.email}</p>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-lg transition"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-brand-400" /> Dashboard Overview
                    </Link>
                    <Link
                      to="/users"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-lg transition"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-400" /> Users & Admins
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-lg transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" /> System Settings
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-800/80 space-y-1">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-lg transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-brand-400" : ""}`} />
                        <span>Extend Session</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">24h</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

