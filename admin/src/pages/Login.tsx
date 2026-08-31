import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fromPath = (location.state as any)?.from?.pathname || "/dashboard";

  // Password requirements calculation
  const passReqs = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please provide an admin email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your admin password.");
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      navigate(fromPath, { replace: true });
    } catch (err: any) {
      const msg = err?.message || "Authentication failed. Please check your credentials.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 border border-brand-500/30 shadow-xl shadow-brand-500/10 mb-2">
            <ShieldCheck className="w-8 h-8 text-brand-400" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Orviohub Admin</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Secure multi-tenant platform infrastructure and system control
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Super Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@orviohub.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-xs text-white placeholder-slate-500 transition outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-xs text-white placeholder-slate-500 transition outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements Guide */}
            {password.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1.5 text-slate-400">
                <span className="font-semibold text-slate-300 block">Password Criteria:</span>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span className={`flex items-center gap-1 ${passReqs.length ? "text-emerald-400" : "text-slate-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> Min 12 Characters
                  </span>
                  <span className={`flex items-center gap-1 ${passReqs.upper ? "text-emerald-400" : "text-slate-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> Uppercase (A-Z)
                  </span>
                  <span className={`flex items-center gap-1 ${passReqs.lower ? "text-emerald-400" : "text-slate-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> Lowercase (a-z)
                  </span>
                  <span className={`flex items-center gap-1 ${passReqs.number ? "text-emerald-400" : "text-slate-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> Number (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${passReqs.special ? "text-emerald-400" : "text-slate-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> Special Character
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Super Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Banner */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Rate limiting & lockout enabled</span>
            <span className="text-brand-400 font-medium">Convex DB Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
