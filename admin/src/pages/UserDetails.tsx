import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  Building,
  Loader2,
  MailCheck,
  Ban,
  LogOut,
  Phone,
  Trash2,
  History as HistoryIcon,
  Sparkles,
  CreditCard,
  Layers,
  Gauge,
  Bell,
  FileText,
  User,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminUsersApi } from "../api/adminUsers";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import SuspendModal from "../components/SuspendModal";
import DeleteModal from "../components/DeleteModal";

// Sub Tabs
import UserOverviewTab from "./user-details/UserOverviewTab";
import UserProfileTab from "./user-details/UserProfileTab";
import UserOnboardingTab from "./user-details/UserOnboardingTab";
import UserSecurityTab from "./user-details/UserSecurityTab";
import UserOrganizationsTab from "./user-details/UserOrganizationsTab";
import UserAccessTab from "./user-details/UserAccessTab";
import UserBillingTab from "./user-details/UserBillingTab";
import UserUsageTab from "./user-details/UserUsageTab";
import UserNotificationsTab from "./user-details/UserNotificationsTab";
import UserActivityTab from "./user-details/UserActivityTab";
import UserSupportNotesTab from "./user-details/UserSupportNotesTab";

type TabKey =
  | "overview"
  | "profile"
  | "onboarding"
  | "security"
  | "organizations"
  | "access"
  | "billing"
  | "usage"
  | "notifications"
  | "activity"
  | "notes";

export const UserDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessionToken } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab Data Cache
  const [overviewData, setOverviewData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [authSummary, setAuthSummary] = useState<any>(null);
  const [securitySummary, setSecuritySummary] = useState<any>(null);
  const [organizationsData, setOrganizationsData] = useState<any>(null);
  const [accessData, setAccessData] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [notificationsData, setNotificationsData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [supportNotes, setSupportNotes] = useState<any[]>([]);

  // Modal states
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  // 1. Initial Overview Load
  const loadInitialOverview = async () => {
    if (!sessionToken || !id) return;
    try {
      setLoading(true);
      const overview = await adminUsersApi.getUserOverview(sessionToken, id);
      setOverviewData(overview);
    } catch (err) {
      console.error("Failed to load user overview:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Tab Data Loader
  const loadTabData = async (tab: TabKey) => {
    if (!sessionToken || !id) return;
    try {
      setTabLoading(true);
      switch (tab) {
        case "overview":
          const ov = await adminUsersApi.getUserOverview(sessionToken, id);
          setOverviewData(ov);
          break;
        case "profile":
          const prof = await adminUsersApi.getUserProfile(sessionToken, id);
          setProfileData(prof);
          break;
        case "onboarding":
          const onb = await adminUsersApi.getUserOnboarding(sessionToken, id);
          setOnboardingData(onb);
          break;
        case "security":
          const [auth, sec] = await Promise.all([
            adminUsersApi.getUserAuthenticationSummary(sessionToken, id),
            adminUsersApi.getUserSecuritySummary(sessionToken, id),
          ]);
          setAuthSummary(auth);
          setSecuritySummary(sec);
          break;
        case "organizations":
          const orgs = await adminUsersApi.getUserOrganizations(sessionToken, id);
          setOrganizationsData(orgs);
          break;
        case "access":
          const acc = await adminUsersApi.getUserAccess(sessionToken, id);
          setAccessData(acc);
          break;
        case "billing":
          const bill = await adminUsersApi.getUserBilling(sessionToken, id);
          setBillingData(bill);
          break;
        case "usage":
          const usg = await adminUsersApi.getUserUsage(sessionToken, id);
          setUsageData(usg);
          break;
        case "notifications":
          const notif = await adminUsersApi.getUserNotifications(sessionToken, id);
          setNotificationsData(notif);
          break;
        case "activity":
          const act = await adminUsersApi.getUserActivity({ sessionToken, userId: id });
          setActivityData(act || []);
          break;
        case "notes":
          const notes = await adminUsersApi.getUserSupportNotes(sessionToken, id);
          setSupportNotes(notes || []);
          break;
      }
    } catch (err) {
      console.error(`Failed to load data for tab ${tab}:`, err);
    } finally {
      setTabLoading(false);
    }
  };

  useEffect(() => {
    loadInitialOverview();
  }, [sessionToken, id]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [sessionToken, id, activeTab]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400">Loading user record from platform ledger...</p>
      </div>
    );
  }

  if (!overviewData?.user) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-sm text-slate-400">User record not found or permanently deleted.</p>
        <Link
          to="/users"
          className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300"
        >
          <ArrowLeft className="w-4 h-4" /> Back to users list
        </Link>
      </div>
    );
  }

  const user = overviewData.user;
  const isSuperadmin = user.role === "superadmin" || user.role === "admin";

  const handleVerifyEmail = () => {
    setDialogConfig({
      isOpen: true,
      title: "Verify Email Manually",
      message: `Manually mark ${user.email} as verified?`,
      confirmLabel: "Verify Email",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.verifyUserEmail(sessionToken!, user.id);
          await loadInitialOverview();
          await loadTabData(activeTab);
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleConfirmSuspend = async (formData: { reason: string; notes: string }) => {
    if (!sessionToken || !user) return;
    setActionLoading(true);
    try {
      await adminUsersApi.suspendUser(sessionToken, user.id, formData.reason, formData.notes);
      setIsSuspendModalOpen(false);
      await loadInitialOverview();
      await loadTabData(activeTab);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async (options: any) => {
    if (!sessionToken || !user) return;
    setActionLoading(true);
    try {
      await adminUsersApi.deleteUser(sessionToken, user.id, options);
      setIsDeleteModalOpen(false);
      navigate("/users");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = () => {
    setDialogConfig({
      isOpen: true,
      title: "Reactivate User Account",
      message: `Reactivate ${user.email}? This will restore access and allow the user to log in.`,
      confirmLabel: "Activate User",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminUsersApi.restoreUser(sessionToken!, user.id);
          await loadInitialOverview();
          await loadTabData(activeTab);
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
          await adminUsersApi.revokeUserSessions(
            sessionToken!,
            user.id,
            "User details header action"
          );
          await loadInitialOverview();
          await loadTabData(activeTab);
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "profile", label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
    { key: "onboarding", label: "Onboarding", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: "security", label: "Security & Auth", icon: <Shield className="w-3.5 h-3.5" /> },
    { key: "organizations", label: "Organizations", icon: <Building className="w-3.5 h-3.5" /> },
    { key: "access", label: "Access & Branches", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "billing", label: "Billing & Payments", icon: <CreditCard className="w-3.5 h-3.5" /> },
    { key: "usage", label: "Usage & Limits", icon: <Gauge className="w-3.5 h-3.5" /> },
    { key: "notifications", label: "Notifications", icon: <Bell className="w-3.5 h-3.5" /> },
    { key: "activity", label: "Audit Activity", icon: <HistoryIcon className="w-3.5 h-3.5" /> },
    { key: "notes", label: "Support Notes", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/users"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Users Directory
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {!user.emailVerified && (
            <button
              onClick={handleVerifyEmail}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <MailCheck className="w-3.5 h-3.5" />
              <span>Verify Email</span>
            </button>
          )}

          <button
            onClick={handleRevokeSessions}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Revoke Sessions</span>
          </button>

          {user.status === "ACTIVE" ? (
            <button
              onClick={() => setIsSuspendModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend</span>
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Activate</span>
            </button>
          )}

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* User Header Profile Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-brand-600/30 shrink-0 overflow-hidden border border-slate-700/80">
            {user.avatar || user.avatarUrl ? (
              <img
                src={user.avatar || user.avatarUrl}
                alt={user.name || "User avatar"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              user.name?.charAt(0)?.toUpperCase() || "U"
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white">{user.name}</h1>
              <StatusBadge status={user.status} size="sm" />
              {isSuperadmin && (
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Superadmin
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 font-mono">{user.email}</p>
            {user.phone && (
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-500" />
                {user.phone}
              </p>
            )}

            <p className="text-[11px] text-slate-500 font-mono">
              User ID: <span className="text-slate-400">{user.id}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Account Tier</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Free User Account
            </span>
          </div>

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

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Login</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabbed Navigation Bar */}
      <div className="border-b border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max pb-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Rendering */}
      {tabLoading && (
        <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          <span>Updating tab data...</span>
        </div>
      )}

      {activeTab === "overview" && (
        <UserOverviewTab
          data={overviewData}
          onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
        />
      )}

      {activeTab === "profile" && (
        <UserProfileTab profile={profileData} loading={tabLoading} />
      )}

      {activeTab === "onboarding" && (
        <UserOnboardingTab onboardingData={onboardingData} loading={tabLoading} />
      )}

      {activeTab === "security" && (
        <UserSecurityTab
          sessionToken={sessionToken!}
          userId={id!}
          authSummary={authSummary}
          securitySummary={securitySummary}
          onRefresh={() => loadTabData("security")}
        />
      )}

      {activeTab === "organizations" && (
        <UserOrganizationsTab organizationsData={organizationsData} loading={tabLoading} />
      )}

      {activeTab === "access" && (
        <UserAccessTab accessData={accessData} loading={tabLoading} />
      )}

      {activeTab === "billing" && (
        <UserBillingTab billingData={billingData} loading={tabLoading} />
      )}

      {activeTab === "usage" && (
        <UserUsageTab
          usageData={usageData}
          loading={tabLoading}
          onRefresh={() => loadTabData("usage")}
        />
      )}

      {activeTab === "notifications" && (
        <UserNotificationsTab notificationsData={notificationsData} loading={tabLoading} />
      )}

      {activeTab === "activity" && (
        <UserActivityTab activityData={activityData} loading={tabLoading} />
      )}

      {activeTab === "notes" && (
        <UserSupportNotesTab
          sessionToken={sessionToken!}
          userId={id!}
          notes={supportNotes}
          loading={tabLoading}
          onRefresh={() => loadTabData("notes")}
        />
      )}

      {/* Structured Suspend User Modal */}
      <SuspendModal
        isOpen={isSuspendModalOpen}
        targetType="user"
        targetName={user.name || user.email}
        targetId={user.id}
        isLoading={actionLoading}
        onClose={() => setIsSuspendModalOpen(false)}
        onConfirm={handleConfirmSuspend}
      />

      {/* Structured Delete User Modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        targetType="user"
        targetName={user.name || user.email}
        targetId={user.id}
        ownedWorkspacesCount={overviewData.organizations?.owned || 0}
        isLoading={actionLoading}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />

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
