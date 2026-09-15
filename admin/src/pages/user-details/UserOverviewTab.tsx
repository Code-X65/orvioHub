import {
  Building,
  CreditCard,
  Shield,
  Layers,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Lock,
} from "lucide-react";

interface UserOverviewTabProps {
  data: any;
  onNavigateTab: (tab: string) => void;
}

export const UserOverviewTab: React.FC<UserOverviewTabProps> = ({ data, onNavigateTab }) => {
  if (!data) return null;

  const { user, onboarding, organizations, access, billing, security } = data;

  return (
    <div className="space-y-6">
      {/* Risk / Warning Banner if anomalies exist */}
      {(billing?.mismatches > 0 || security?.isLocked || !user.emailVerified) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-200">Account Attention Required</h4>
            <div className="space-y-0.5 text-[11px] text-amber-300/90">
              {!user.emailVerified && <p>• User email has not been verified yet.</p>}
              {billing?.mismatches > 0 && (
                <p>• {billing.mismatches} billing / subscription mismatch(es) detected across owned organizations.</p>
              )}
              {security?.isLocked && <p>• Account is temporarily locked due to excessive failed logins.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Organizations */}
        <div
          onClick={() => onNavigateTab("organizations")}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Organizations</span>
            <Building className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {organizations.owned + organizations.joined}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{organizations.owned} Owned / {organizations.joined} Joined</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        {/* Active Apps & Branches */}
        <div
          onClick={() => onNavigateTab("access")}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Access & Branches</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{access.branches}</div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>{access.applications} Active Apps / {access.branches} Branches</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        {/* Billing State */}
        <div
          onClick={() => onNavigateTab("billing")}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Subscriptions</span>
            <CreditCard className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{billing.activeSubscriptions}</div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span className={billing.mismatches > 0 ? "text-amber-400 font-bold" : "text-emerald-400"}>
              {billing.mismatches > 0 ? "Mismatch detected" : "Consistent"}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        {/* Security & Sessions */}
        <div
          onClick={() => onNavigateTab("security")}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Sessions</span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{security.activeSessions}</div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>2FA: {security.twoFactorEnabled ? "Enabled" : "Disabled"}</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Grid: Onboarding & Identity Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Onboarding Health */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Onboarding Lifecycle</h3>
            </div>
            <button
              onClick={() => onNavigateTab("onboarding")}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              View Full Answers &rarr;
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Personal Onboarding</span>
                <span className="text-[11px] text-slate-500">Global account setup & use case profiling</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  onboarding.personalStatus === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}
              >
                {onboarding.personalStatus}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Organization Onboardings</span>
                <span className="text-[11px] text-slate-500">
                  {onboarding.organizations.completed} completed, {onboarding.organizations.incomplete} pending
                </span>
              </div>
              <span className="font-bold text-white text-xs">
                {onboarding.organizations.total} total
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Inventory App Activation</span>
                <span className="text-[11px] text-slate-500">Retail store profiling & initial stock setup</span>
              </div>
              <span className="font-bold text-indigo-400 text-xs">
                {onboarding.applications.inventory.activeCount} active
              </span>
            </div>
          </div>
        </div>

        {/* Security & Authentication Health */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Security & Integrity</h3>
            </div>
            <button
              onClick={() => onNavigateTab("security")}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
            >
              Security Settings &rarr;
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Two-Factor Authentication (2FA)</span>
                <span className="text-[11px] text-slate-500">TOTP authenticator app verification</span>
              </div>
              {security.twoFactorEnabled ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Enabled
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                  Disabled
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Account Lockout Status</span>
                <span className="text-[11px] text-slate-500">
                  {security.recentFailedLogins} recent failed login attempt(s)
                </span>
              </div>
              {security.isLocked ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Normal
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Active Devices</span>
                <span className="text-[11px] text-slate-500">Connected browser sessions</span>
              </div>
              <span className="font-bold text-white text-xs">
                {security.activeSessions} active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserOverviewTab;
