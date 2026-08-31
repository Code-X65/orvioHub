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

      {/* Incomplete / Stalled Onboarding List */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Stalled & In-Progress Onboarding Flows ({incompleteList.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">Sorted by days inactive</span>
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
                ) : incompleteList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-emerald-400">
                      🎉 All users who started onboarding have completed the flow!
                    </td>
                  </tr>
                ) : (
                  incompleteList.map((flow) => (
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
