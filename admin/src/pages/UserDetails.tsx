import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  Building,
  Key,
  Laptop,
  Loader2,
  MailCheck,
  Ban,
  LogOut,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminUsersApi } from "../api/adminUsers";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";

export const UserDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { sessionToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
  });

  const loadUserDetails = async () => {
    if (!sessionToken || !id) return;
    try {
      setLoading(true);
      const res = await adminUsersApi.getUserDetails(sessionToken, id);
      setData(res);
    } catch (err) {
      console.error("Failed to load user details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserDetails();
  }, [sessionToken, id]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400">Loading user profile and security state...</p>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-sm text-slate-400">User not found or deleted.</p>
        <Link
          to="/users"
          className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300"
        >
          <ArrowLeft className="w-4 h-4" /> Back to users list
        </Link>
      </div>
    );
  }

  const user = data.user;
  const workspaces = data.workspaces || [];
  const sessions = data.sessions || [];
  const identities = data.identities || [];

  const handleVerifyEmail = () => {
    setDialogConfig({
      isOpen: true,
      title: "Verify Email",
      message: `Manually mark ${user.email} as verified?`,
      confirmLabel: "Verify Email",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.verifyUserEmail(sessionToken!, user.id);
          await loadUserDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSuspend = () => {
    setDialogConfig({
      isOpen: true,
      title: "Suspend User",
      message: `Suspend ${user.email} and revoke all active sessions immediately?`,
      confirmLabel: "Suspend User",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.suspendUser(sessionToken!, user.id, "Admin suspension");
          await loadUserDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleActivate = () => {
    setDialogConfig({
      isOpen: true,
      title: "Reactivate User",
      message: `Reactivate account for ${user.email}?`,
      confirmLabel: "Activate User",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.activateUser(sessionToken!, user.id);
          await loadUserDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRevokeSessions = () => {
    setDialogConfig({
      isOpen: true,
      title: "Revoke All Sessions",
      message: `Force sign-out ${user.email} on all active devices?`,
      confirmLabel: "Revoke Sessions",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.revokeUserSessions(sessionToken!, user.id);
          await loadUserDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleImpersonate = () => {
    setDialogConfig({
      isOpen: true,
      title: "Impersonate User",
      message: `Start an audited support session as ${user.email}? This action will create a temporary access session and be recorded in the security audit log.`,
      confirmLabel: "Start Impersonation",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          const res = await adminUsersApi.impersonateUser(sessionToken!, user.id, "Support Investigation");
          if (res?.sessionToken) {
            const isProd = window.location.hostname.endsWith("orviohub.com");
            const targetHost = isProd ? "https://home.orviohub.com" : "http://home.orviohub.localhost:4000";
            window.open(`${targetHost}/dashboard?auth_token=${res.sessionToken}&refreshToken=${res.refreshToken}`, "_blank");
          }
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/users"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </Link>

        <div className="flex items-center gap-2">
          {!user.emailVerified && (
            <button
              onClick={handleVerifyEmail}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <MailCheck className="w-3.5 h-3.5" />
              <span>Verify Email</span>
            </button>
          )}

          <button
            onClick={handleRevokeSessions}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Revoke Sessions</span>
          </button>

          {user.status === "ACTIVE" && (
            <button
              onClick={handleImpersonate}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-indigo-500/10 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Impersonate</span>
            </button>
          )}

          {user.status === "ACTIVE" ? (
            <button
              onClick={handleSuspend}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend</span>
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Activate</span>
            </button>
          )}
        </div>
      </div>

      {/* User Header Profile Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-brand-600/30 shrink-0">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white">{user.name}</h1>
              <StatusBadge status={user.status} size="sm" />
            </div>
            <p className="text-xs text-slate-400 font-mono">{user.email}</p>
            <p className="text-[11px] text-slate-500">
              User ID: <span className="font-mono text-slate-400">{user.id}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Email Status</span>
            {user.emailVerified ? (
              <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="font-semibold text-rose-400 flex items-center gap-1 mt-0.5">
                <XCircle className="w-3.5 h-3.5" /> Unverified
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Joined</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Login</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Workspaces & Identities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspace Memberships */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Associated Organizations ({workspaces.length})</h3>
          </div>

          {workspaces.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No organizations associated with this account.</p>
          ) : (
            <div className="space-y-2.5">
              {workspaces.map((ws: any) => (
                <div
                  key={ws.membershipId}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition"
                >
                  <div>
                    <Link
                      to={`/organizations/${ws.workspaceId}`}
                      className="font-bold text-white hover:text-brand-400 transition"
                    >
                      {ws.name}
                    </Link>
                    <p className="text-[11px] text-slate-500 font-mono">slug: {ws.slug}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-300 font-bold text-[10px] border border-brand-500/20">
                      {ws.role}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Joined: {ws.joinedAt ? new Date(ws.joinedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OAuth & Auth Identities */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Linked Auth Identities ({identities.length})</h3>
          </div>

          {identities.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Email & Password Auth</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Direct credentials registration</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {identities.map((idDoc: any) => (
                <div
                  key={idDoc.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-white uppercase">{idDoc.provider}</p>
                    <p className="text-[11px] text-slate-400">{idDoc.providerEmail || user.email}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Linked: {new Date(idDoc.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Active Device Sessions ({sessions.length})</h3>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={handleRevokeSessions}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
            >
              Revoke all
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No active sessions found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {sessions.map((s: any) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-200 truncate">{s.deviceName}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">IP: {s.ipAddress || "system"}</p>
                </div>
                <div className="text-right text-[10px] text-slate-400 space-y-0.5">
                  <span className={s.isRevoked ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                    {s.isRevoked ? "REVOKED" : "ACTIVE"}
                  </span>
                  <p className="text-slate-500">Created: {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmLabel={dialogConfig.confirmLabel}
        isDestructive={dialogConfig.isDestructive}
        isLoading={actionLoading}
        onConfirm={dialogConfig.action}
        onCancel={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default UserDetails;
