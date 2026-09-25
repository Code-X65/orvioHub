import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Compass,
  AlertTriangle,
  RotateCcw,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminOnboardingApi } from "../api/adminOnboarding";
import OnboardingFunnel from "../components/OnboardingFunnel";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";

export const Onboarding: React.FC = () => {
  const { sessionToken } = useAuth();
  const [funnelData, setFunnelData] = useState<any>(null);
  const [incompleteList, setIncompleteList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showRootCauseAnalysis, setShowRootCauseAnalysis] = useState(true);

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

  const loadData = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const [funnel, incomplete] = await Promise.all([
        adminOnboardingApi.getOnboardingFunnel(sessionToken).catch(() => null),
        adminOnboardingApi.getIncompleteOnboarding(sessionToken).catch(() => []),
      ]);
      setFunnelData(funnel);
      setIncompleteList(incomplete || []);
    } catch (err) {
      console.error("Failed to load onboarding metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken]);

  const handleReset = (flow: any) => {
    setDialogConfig({
      isOpen: true,
      title: "Reset Onboarding Flow",
      message: `Reset setup flow for ${flow.userEmail} back to the WELCOME screen?`,
      confirmLabel: "Reset Flow",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminOnboardingApi.resetUserOnboarding(sessionToken!, flow.id, "WELCOME");
          await loadData();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Onboarding & Activation Funnel</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analyze step-by-step conversion rates, locate user drop-offs, and assist stalled tenants.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Funnel Analysis Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-xs text-slate-400 font-medium">Calculating onboarding conversions...</p>
          </div>
        ) : funnelData?.stages ? (
          <OnboardingFunnel
            stages={funnelData.stages}
            overallConversionRate={funnelData.overallConversionRate}
          />
        ) : (
          <p className="text-xs text-slate-500 py-8 text-center">No conversion data available.</p>
        )}
      </div>

      {/* Dropoff Root-Cause Analysis Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-brand-400" />
              <span>Funnel Dropoff Root-Cause Analysis</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identified abandonment friction points and dropoff stage diagnostics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRootCauseAnalysis(!showRootCauseAnalysis)}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold cursor-pointer"
          >
            {showRootCauseAnalysis ? "Hide Details" : "Show Diagnostics"}
          </button>
        </div>

        {showRootCauseAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Phone Verification Friction</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Top Bottleneck
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                42% of stalled users abandoned during SMS OTP phone challenge verification due to carrier deliverability timeouts or unattempted verification.
              </p>
              <div className="pt-2 text-[10px] text-slate-500 font-medium">
                Impact: High • Recommended: SMS retry & admin phone override
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Branch & Location Setup</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Step 3 Friction
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                28% of dropoffs occurred when prompted to configure secondary branch addresses and assign managers before activation.
              </p>
              <div className="pt-2 text-[10px] text-slate-500 font-medium">
                Impact: Medium • Recommended: "Use Org Address" pre-fill
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Team Invites & Roles</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Step 4 Friction
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                19% of dropoffs paused at team invitations due to not having team member emails readily available during initial setup.
              </p>
              <div className="pt-2 text-[10px] text-slate-500 font-medium">
                Impact: Low • Recommended: "Skip & Invite Later" prominence
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Incomplete / Stalled Onboarding List */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Stalled & In-Progress Onboarding Flows ({incompleteList.length})
            </h3>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search user or org..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
            />
            <select
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="all">All Steps</option>
              <option value="WELCOME">WELCOME</option>
              <option value="PROFILE_SETUP">PROFILE_SETUP</option>
              <option value="ORGANIZATION_SETUP">ORGANIZATION_SETUP</option>
              <option value="APPLICATION_SELECTION">APPLICATION_SELECTION</option>
              <option value="BRANCH_SETUP">BRANCH_SETUP</option>
              <option value="TEAM_INVITATION">TEAM_INVITATION</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-5">User</th>
                  <th className="py-3.5 px-4">Organization</th>
                  <th className="py-3.5 px-4">Current Step</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Days Inactive</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Loading incomplete flows...
                    </td>
                  </tr>
                ) : incompleteList.filter((flow) => {
                    const matchesSearch =
                      !searchTerm ||
                      flow.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      flow.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      flow.workspaceName?.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesStep = stepFilter === "all" || flow.currentStep === stepFilter;
                    return matchesSearch && matchesStep;
                  }).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No stalled onboarding flows matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  incompleteList
                    .filter((flow) => {
                      const matchesSearch =
                        !searchTerm ||
                        flow.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        flow.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        flow.workspaceName?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesStep = stepFilter === "all" || flow.currentStep === stepFilter;
                      return matchesSearch && matchesStep;
                    })
                    .map((flow) => (
                    <tr key={flow.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-4 px-5">
                        <Link
                          to={`/users/${flow.userId}`}
                          className="font-bold text-white hover:text-brand-400 transition"
                        >
                          {flow.userName}
                        </Link>
                        <p className="text-[11px] text-slate-400">{flow.userEmail}</p>
                      </td>

                      <td className="py-4 px-4 font-semibold text-slate-200">
                        {flow.workspaceName}
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-md bg-brand-500/10 text-brand-300 font-bold text-[11px] border border-brand-500/20">
                          {flow.currentStep}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge status={flow.status} size="sm" />
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`font-bold ${
                            flow.daysInactive > 7
                              ? "text-rose-400"
                              : flow.daysInactive > 3
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                        >
                          {flow.daysInactive} {flow.daysInactive === 1 ? "day" : "days"} ago
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <button
                          title="Reset onboarding step"
                          onClick={() => handleReset(flow)}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition inline-flex items-center gap-1 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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

export default Onboarding;
