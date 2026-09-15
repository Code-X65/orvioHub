import React, { useState } from "react";
import {
  Shield,
  Key,
  Laptop,
  LogOut,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  PhoneOff,
  CheckCheck,
} from "lucide-react";
import { adminUsersApi } from "../../api/adminUsers";
import ConfirmDialog from "../../components/ConfirmDialog";

interface UserSecurityTabProps {
  sessionToken: string;
  userId: string;
  authSummary: any;
  securitySummary: any;
  onRefresh: () => Promise<void>;
}

export const UserSecurityTab: React.FC<UserSecurityTabProps> = ({
  sessionToken,
  userId,
  authSummary,
  securitySummary,
  onRefresh,
}) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedSessionToRevoke, setSelectedSessionToRevoke] = useState<any>(null);
  const [isRevokeAllOpen, setIsRevokeAllOpen] = useState(false);
  const [isUnlinkPhoneOpen, setIsUnlinkPhoneOpen] = useState(false);
  const [isVerifyPhoneOpen, setIsVerifyPhoneOpen] = useState(false);

  if (!authSummary || !securitySummary) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading security and authentication diagnostics...
      </div>
    );
  }

  const { primaryLoginMethod, connectedProviders, twoFactor, stats, phone } = authSummary;
  const { metrics, sessions, recentSecurityEvents } = securitySummary;

  const handleRevokeSpecificSession = async () => {
    if (!selectedSessionToRevoke) return;
    setActionLoading(true);
    try {
      await adminUsersApi.revokeSpecificSession(
        sessionToken,
        userId,
        selectedSessionToRevoke.id,
        "Superadmin dashboard revocation"
      );
      setSelectedSessionToRevoke(null);
      await onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    setActionLoading(true);
    try {
      await adminUsersApi.revokeUserSessions(
        sessionToken,
        userId,
        "Superadmin bulk session revocation"
      );
      setIsRevokeAllOpen(false);
      await onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlinkPhone = async () => {
    setActionLoading(true);
    try {
      await adminUsersApi.unlinkUserPhone(
        sessionToken,
        userId,
        "Superadmin administrative phone unlinking"
      );
      setIsUnlinkPhoneOpen(false);
      await onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    setActionLoading(true);
    try {
      await adminUsersApi.overrideUserPhoneVerified(
        sessionToken,
        userId,
        "Superadmin administrative phone verification override"
      );
      setIsVerifyPhoneOpen(false);
      await onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Security Health Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 2FA Status */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Two-Factor Authentication</span>
          <div className="flex items-center gap-1.5">
            {twoFactor?.enabled ? (
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Enabled
              </span>
            ) : (
              <span className="text-slate-400 font-bold text-sm flex items-center gap-1">
                <XCircle className="w-4 h-4 text-slate-500" /> Disabled
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block">
            {twoFactor?.backupCodesRemaining} backup code(s) remaining
          </span>
        </div>

        {/* Lockout State */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Account Lockout</span>
          <div className="flex items-center gap-1.5">
            {stats?.isLocked ? (
              <span className="text-rose-400 font-bold text-sm flex items-center gap-1">
                <Lock className="w-4 h-4" /> Locked
              </span>
            ) : (
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                <Unlock className="w-4 h-4" /> Normal
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block">
            {stats?.failedLoginsCount || 0} failed login attempts
          </span>
        </div>

        {/* Active Sessions */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Active Sessions</span>
          <div className="text-lg font-bold text-white">
            {metrics?.activeSessionsCount || 0} <span className="text-xs text-slate-500 font-normal">devices</span>
          </div>
          <span className="text-[10px] text-slate-500 block">
            {metrics?.revokedSessionsCount || 0} previously revoked
          </span>
        </div>

        {/* Total Logins */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Total Sign-ins</span>
          <div className="text-lg font-bold text-white">{stats?.totalLogins || 0}</div>
          <span className="text-[10px] text-slate-500 block">
            {stats?.suspiciousLoginsCount || 0} suspicious flags
          </span>
        </div>
      </div>

      {/* Grid: Auth Providers & Phone Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linked Authentication Methods */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Key className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Authentication Providers</h3>
          </div>

          <div className="space-y-3 text-xs">
            {connectedProviders.map((provider: any, idx: number) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white uppercase text-xs">{provider.provider}</span>
                    {provider.provider === primaryLoginMethod && (
                      <span className="px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-300 text-[9px] font-bold border border-brand-500/30">
                        Primary
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    {provider.providerEmail}
                  </span>
                </div>

                <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                  <div>Linked: {new Date(provider.connectedAt).toLocaleDateString()}</div>
                  {provider.lastUsedAt && (
                    <div>Last Used: {new Date(provider.lastUsedAt).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone Identity & Recovery Security */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Phone Verification & Recovery</h3>
            </div>
            {phone?.phoneStatus === "verified" ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : phone?.phone ? (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Unverified
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-700">
                Not Linked
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Personal Phone (E.164)</span>
                <span className="font-mono text-slate-200 font-semibold text-[11px]">
                  {phone?.phoneNormalized || phone?.phone || "None registered"}
                </span>
              </div>
              {phone?.phone && phone?.phoneNormalized && phone.phone !== phone.phoneNormalized && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Raw input:</span>
                  <span className="font-mono">{phone.phone}</span>
                </div>
              )}
              {phone?.phoneVerifiedAt && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Verified at:</span>
                  <span>{new Date(phone.phoneVerifiedAt).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span>Account Recovery Allowed:</span>
                <span className={phone?.phoneUsedForRecovery ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                  {phone?.phoneUsedForRecovery ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>SMS MFA Allowed:</span>
                <span className={phone?.phoneUsedForMfa ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                  {phone?.phoneUsedForMfa ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            {/* Admin Phone Actions */}
            {phone?.phone && (
              <div className="flex items-center gap-2 pt-1">
                {phone.phoneStatus !== "verified" && (
                  <button
                    onClick={() => setIsVerifyPhoneOpen(true)}
                    className="flex-1 px-3 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark Verified</span>
                  </button>
                )}
                <button
                  onClick={() => setIsUnlinkPhoneOpen(true)}
                  className="flex-1 px-3 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-semibold border border-rose-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>Unlink Phone</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Audit Trail Events */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Shield className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Recent Security & Login Events</h3>
        </div>

        {recentSecurityEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No recent security events logged.</p>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {recentSecurityEvents.map((event: any) => (
              <div
                key={event.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-200 capitalize">
                    {event.eventType?.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    IP: {event.maskedIp}
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Device Sessions List */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Connected Device Sessions</h3>
          </div>

          {sessions.length > 0 && (
            <button
              onClick={() => setIsRevokeAllOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Revoke All Devices</span>
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No active or tracked device sessions found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {sessions.map((session: any) => {
              const isActive = session.status === "active";
              return (
                <div
                  key={session.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-white block">{session.deviceName}</span>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                        IP: {session.maskedIp} • {session.authenticationMethod}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">
                        {session.userAgent}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : session.isRevoked
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
                    <div>
                      <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                    </div>

                    {isActive && (
                      <button
                        onClick={() => setSelectedSessionToRevoke(session)}
                        className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                      >
                        Revoke Session
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke Specific Session Confirmation */}
      <ConfirmDialog
        isOpen={!!selectedSessionToRevoke}
        title="Revoke User Session"
        message={`Force disconnect device '${selectedSessionToRevoke?.deviceName}' (IP: ${selectedSessionToRevoke?.maskedIp})? This action will immediately terminate the session.`}
        confirmLabel="Revoke Session"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleRevokeSpecificSession}
        onCancel={() => setSelectedSessionToRevoke(null)}
      />

      {/* Revoke All Sessions Confirmation */}
      <ConfirmDialog
        isOpen={isRevokeAllOpen}
        title="Revoke All User Sessions"
        message="Force sign-out the user on all currently connected devices and browsers? All active session tokens will be invalidated."
        confirmLabel="Revoke All Sessions"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleRevokeAllSessions}
        onCancel={() => setIsRevokeAllOpen(false)}
      />

      {/* Unlink Phone Confirmation */}
      <ConfirmDialog
        isOpen={isUnlinkPhoneOpen}
        title="Unlink Phone Number"
        message={`Administrative Unlink: Are you sure you want to remove the phone number (${phone?.phoneNormalized || phone?.phone}) from this user's account? Any phone-dependent recovery or SMS alerts will be disabled.`}
        confirmLabel="Unlink Phone"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleUnlinkPhone}
        onCancel={() => setIsUnlinkPhoneOpen(false)}
      />

      {/* Verify Phone Confirmation */}
      <ConfirmDialog
        isOpen={isVerifyPhoneOpen}
        title="Administrative Phone Verification"
        message={`Override Verification: Mark the phone number (${phone?.phoneNormalized || phone?.phone}) as officially verified? This will enable phone-based security features.`}
        confirmLabel="Mark as Verified"
        isDestructive={false}
        isLoading={actionLoading}
        onConfirm={handleVerifyPhone}
        onCancel={() => setIsVerifyPhoneOpen(false)}
      />
    </div>
  );
};

export default UserSecurityTab;
