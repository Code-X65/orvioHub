import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building,
  ExternalLink,
  Users,
  Sparkles,
  Archive,
  Ban,
  Clock,
  X,
  Loader2,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { adminUsersApi } from "../../api/adminUsers";
import { useAuth } from "../../hooks/useAuth";

interface UserOrganizationsTabProps {
  userId?: string;
  organizationsData: any;
  loading?: boolean;
  onRefresh?: () => void;
}

export const UserOrganizationsTab: React.FC<UserOrganizationsTabProps> = ({
  userId,
  organizationsData,
  loading,
  onRefresh,
}) => {
  const { admin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"owned" | "joined" | "archived" | "suspended">("owned");
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideLimit, setOverrideLimit] = useState<number>(5);
  const [overrideReason, setOverrideReason] = useState<string>("Enterprise pilot / multi-tenant owner exemption");
  const [expiryOption, setExpiryOption] = useState<"never" | "30d" | "90d" | "365d">("never");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading || !organizationsData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading organization memberships and ownership limits...
      </div>
    );
  }

  const { ownershipQuota, owned, joined, archived, suspended } = organizationsData;

  const handleOpenOverrideModal = () => {
    setOverrideLimit(ownershipQuota.hasOverride ? ownershipQuota.overrideLimit : 5);
    setOverrideReason(ownershipQuota.hasOverride ? ownershipQuota.overrideReason || "" : "Enterprise pilot / VIP tier customer");
    setExpiryOption("never");
    setActionError(null);
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    try {
      setSubmitting(true);
      setActionError(null);

      let expiresAt: number | undefined = undefined;
      const now = Date.now();
      if (expiryOption === "30d") expiresAt = now + 30 * 86_400_000;
      else if (expiryOption === "90d") expiresAt = now + 90 * 86_400_000;
      else if (expiryOption === "365d") expiresAt = now + 365 * 86_400_000;

      await adminUsersApi.grantOrganizationLimitOverride(
        userId,
        Number(overrideLimit),
        overrideReason.trim() || "Administrative override granted via Admin Dashboard",
        admin?.name || admin?.email || "superadmin",
        expiresAt
      );

      setIsOverrideModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to grant quota override.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeOverride = async () => {
    if (!userId || !confirm("Revoke this user's organization limit override and reset to platform default (3)?")) return;
    try {
      setSubmitting(true);
      await adminUsersApi.removeOrganizationLimitOverride(
        userId,
        admin?.name || admin?.email || "superadmin"
      );
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to revoke quota override.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentList =
    activeSubTab === "owned"
      ? owned
      : activeSubTab === "joined"
      ? joined
      : activeSubTab === "archived"
      ? archived
      : suspended;

  return (
    <div className="space-y-6">
      {/* 1. Ownership Quota & Limit Widget */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-400" />
              <h3 className="text-base font-bold text-white">Organization Ownership Limits</h3>
            </div>
            <p className="text-xs text-slate-400">
              User accounts have a standard platform limit of 3 owned organizations. Joined organizations do not count against this quota.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-right self-start sm:self-auto">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Creation Slots</span>
              <span className="text-sm font-bold text-white">
                {ownershipQuota.remainingSlots} remaining
              </span>
            </div>

            {userId && (
              <button
                type="button"
                onClick={handleOpenOverrideModal}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{ownershipQuota.hasOverride ? "Edit Override" : "Grant Quota Override"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">
              Owned: {ownershipQuota.ownedCount} of {ownershipQuota.maxLimit} allowed
            </span>
            <span className="text-slate-400">
              Joined: {joined.length} organization(s)
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                ownershipQuota.isLimitReached ? "bg-amber-500" : "bg-brand-500"
              }`}
              style={{
                width: `${Math.min(100, (ownershipQuota.ownedCount / ownershipQuota.maxLimit) * 100)}%`,
              }}
            />
          </div>

          {ownershipQuota.hasOverride && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Administrative Override Active:</strong> Limit elevated to {ownershipQuota.overrideLimit} organizations (Reason: {ownershipQuota.overrideReason}).
                </span>
              </div>

              {userId && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRevokeOverride}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Revoke</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Override Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {ownershipQuota.hasOverride ? "Update Quota Override" : "Grant Organization Quota Override"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Elevate maximum organization creation slots for this user account.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOverrideModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Allowed Organization Count
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[5, 10, 20, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setOverrideLimit(num)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                        overrideLimit === num
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {num} Orgs
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={overrideLimit}
                  onChange={(e) => setOverrideLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Business Justification / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise pilot / multi-region franchise"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Override Expiration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "never", label: "Permanent" },
                    { key: "30d", label: "30 Days" },
                    { key: "90d", label: "90 Days" },
                    { key: "365d", label: "1 Year" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setExpiryOption(item.key as any)}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border transition ${
                        expiryOption === item.key
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{ownershipQuota.hasOverride ? "Update Override" : "Grant Override"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Categorized Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab("owned")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "owned"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Owned ({owned.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("joined")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "joined"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Joined / Staff ({joined.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("archived")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "archived"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archived ({archived.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("suspended")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "suspended"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>Suspended ({suspended.length})</span>
        </button>
      </div>

      {/* 3. Organizations Grid / List */}
      {currentList.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
          No organizations found in the '{activeSubTab}' category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentList.map((org: any) => (
            <div
              key={org.id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-4 shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/organizations/${org.id}`}
                        className="font-bold text-white hover:text-brand-400 transition text-sm flex items-center gap-1.5"
                      >
                        <span>{org.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      </Link>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                      slug: {org.slug} • ID: {org.id}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      org.isTrial
                        ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                        : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    }`}
                  >
                    {org.isTrial ? "Free Trial" : org.planName}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Members</span>
                    <span className="font-bold text-slate-200">{org.stats?.memberCount || 1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Apps</span>
                    <span className="font-bold text-indigo-300">{org.stats?.applicationCount || 1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Branches</span>
                    <span className="font-bold text-brand-300">{org.stats?.branchCount || 1}</span>
                  </div>
                </div>

                {org.isTrial && org.daysRemaining !== null && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{org.daysRemaining} day(s) remaining in trial</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 font-bold text-[10px] border border-brand-500/20">
                  Role: {org.role}
                </span>

                <Link
                  to={`/organizations/${org.id}`}
                  className="text-brand-400 hover:text-brand-300 font-semibold text-xs flex items-center gap-1"
                >
                  <span>Manage Org</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserOrganizationsTab;
