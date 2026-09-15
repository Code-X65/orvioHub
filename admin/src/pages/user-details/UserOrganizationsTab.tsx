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
} from "lucide-react";

interface UserOrganizationsTabProps {
  organizationsData: any;
  loading?: boolean;
}

export const UserOrganizationsTab: React.FC<UserOrganizationsTabProps> = ({
  organizationsData,
  loading,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"owned" | "joined" | "archived" | "suspended">("owned");

  if (loading || !organizationsData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading organization memberships and ownership limits...
      </div>
    );
  }

  const { ownershipQuota, owned, joined, archived, suspended } = organizationsData;

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

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-right self-start sm:self-auto">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Creation Slots</span>
            <span className="text-sm font-bold text-white">
              {ownershipQuota.remainingSlots} remaining
            </span>
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
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2 mt-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Administrative Override Active: Limit elevated to {ownershipQuota.overrideLimit} organizations (Reason: {ownershipQuota.overrideReason}).
              </span>
            </div>
          )}
        </div>
      </div>

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
