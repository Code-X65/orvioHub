import React from "react";
import {
  Layers,
  Building,
  GitBranch,
  ArrowRight,
  Clock,
  History,
} from "lucide-react";

interface UserAccessTabProps {
  accessData: any;
  loading?: boolean;
}

export const UserAccessTab: React.FC<UserAccessTabProps> = ({ accessData, loading }) => {
  if (loading || !accessData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading access hierarchy and branch assignments...
      </div>
    );
  }

  const { hierarchy, transferHistory } = accessData;

  return (
    <div className="space-y-6">
      {/* 1. Hierarchical Access Tree */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Application & Branch Access Hierarchy</h3>
        </div>

        {hierarchy.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No workspace access assigned to this user.</p>
        ) : (
          <div className="space-y-6">
            {hierarchy.map((ws: any) => (
              <div
                key={ws.workspaceId}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
              >
                {/* Workspace Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Building className="w-4 h-4 text-brand-400" />
                    <div>
                      <span className="font-bold text-white text-sm">{ws.organizationName}</span>
                      <span className="text-[11px] text-slate-500 block font-mono">slug: {ws.slug}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-lg bg-brand-500/10 text-brand-300 font-bold text-[10px] border border-brand-500/20">
                    Workspace Role: {ws.organizationRole}
                  </span>
                </div>

                {/* Applications under this Workspace */}
                <div className="space-y-4 pl-3 sm:pl-6 border-l-2 border-slate-800">
                  {ws.applications.map((app: any) => (
                    <div
                      key={app.key}
                      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-400" />
                          <span className="font-bold text-white text-xs">{app.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold text-[10px] border border-indigo-500/20">
                            App Role: {app.role}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                            {app.status}
                          </span>
                        </div>
                      </div>

                      {/* Branches under this Application */}
                      <div className="space-y-2 pt-2">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Assigned Branches ({app.branches.length}):
                        </span>

                        {app.branches.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic block">
                            No branches assigned under this application.
                          </span>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {app.branches.map((b: any) => (
                              <div
                                key={b.branchId}
                                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between gap-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <GitBranch className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                                    <span className="font-bold text-slate-200 text-xs">
                                      {b.branchName}
                                    </span>
                                    {b.isPrimary && (
                                      <span className="px-1.5 py-0.2 rounded bg-brand-500/10 text-brand-300 text-[9px] font-bold">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                                    {b.userRole}
                                  </span>
                                </div>

                                <div className="space-y-1 text-[10px]">
                                  <span className="text-slate-500 block uppercase font-bold text-[9px]">
                                    Permissions:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {b.permissions.map((p: string, i: number) => (
                                      <span
                                        key={i}
                                        className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[9px]"
                                      >
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Staff Branch Transfer History */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <History className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">
            Staff Branch Transfer & Reassignment History ({transferHistory.length})
          </h3>
        </div>

        {transferHistory.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No branch transfer or reassignment records for this user.
          </p>
        ) : (
          <div className="space-y-3">
            {transferHistory.map((t: any) => (
              <div
                key={t.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{t.organizationName}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-indigo-300 font-semibold">{t.applicationKey}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                      {t.sourceBranchName} ({t.previousRole})
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
                    <span className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px] font-bold">
                      {t.targetBranchName} ({t.newRole})
                    </span>
                  </div>

                  {t.reason && (
                    <p className="text-[11px] text-slate-400 italic">"{t.reason}"</p>
                  )}
                </div>

                <div className="text-right sm:self-center shrink-0 text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{new Date(t.effectiveAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAccessTab;
