import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Shield,
  Flag,
  Check,
  Loader2,
  RefreshCw,
  Power,
  Zap,
  Sliders,
  Search,
  FileText,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminConfigApi } from "../api/adminConfig";

export const Settings: React.FC = () => {
  const { sessionToken } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "support_notes">("system");
  const [supportNoteSearch, setSupportNoteSearch] = useState("");

  const loadData = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const [cfg, flags] = await Promise.all([
        adminConfigApi.getSystemConfig(sessionToken),
        adminConfigApi.getFeatureFlags(sessionToken),
      ]);
      setConfig(cfg);
      setFeatureFlags(flags || []);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken]);

  const handleToggleConfig = async (key: string, currentValue: boolean) => {
    if (!sessionToken) return;
    try {
      setSavingKey(key);
      await adminConfigApi.updateSystemConfig(sessionToken, key, !currentValue);
      setConfig((prev: any) => ({ ...prev, [key]: !currentValue }));
    } catch (err) {
      console.error("Failed to update config:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleFlag = async (flag: any) => {
    if (!sessionToken) return;
    try {
      setSavingKey(flag.key);
      const newEnabled = !flag.enabled;
      await adminConfigApi.updateFeatureFlag(
        sessionToken,
        flag.key,
        newEnabled,
        newEnabled ? (flag.rolloutPercentage > 0 ? flag.rolloutPercentage : 100) : 0,
        flag.description
      );
      setFeatureFlags((prev) =>
        prev.map((f) =>
          f.key === flag.key
            ? { ...f, enabled: newEnabled, rolloutPercentage: newEnabled ? (f.rolloutPercentage > 0 ? f.rolloutPercentage : 100) : 0 }
            : f
        )
      );
    } catch (err) {
      console.error("Failed to update feature flag:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleRolloutChange = async (flagKey: string, percentage: number) => {
    if (!sessionToken) return;
    try {
      setSavingKey(flagKey);
      const targetFlag = featureFlags.find((f) => f.key === flagKey);
      await adminConfigApi.updateFeatureFlag(
        sessionToken,
        flagKey,
        percentage > 0,
        percentage,
        targetFlag?.description
      );
      setFeatureFlags((prev) =>
        prev.map((f) =>
          f.key === flagKey
            ? { ...f, enabled: percentage > 0, rolloutPercentage: percentage }
            : f
        )
      );
    } catch (err) {
      console.error("Failed to update flag rollout:", err);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400">Loading system settings and feature flags...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">System Configuration & Governance</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure global platform security policies, maintenance toggles, and feature release flags.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("system")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "system"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>System & Feature Flags</span>
        </button>
        <button
          onClick={() => setActiveTab("support_notes")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === "support_notes"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Global Support Notes Explorer</span>
        </button>
      </div>

      {activeTab === "system" ? (
        <>
          {/* Maintenance & Platform Status */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Platform Core Controls</h3>
            </div>

            <div className="space-y-4">
              {/* Maintenance Mode */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    Maintenance Mode
                    {config?.maintenanceMode && (
                      <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold">
                        ACTIVE
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    When enabled, non-admin users will see a maintenance notice and will be blocked from making API queries.
                  </p>
                </div>

                <button
                  onClick={() => handleToggleConfig("maintenanceMode", !!config?.maintenanceMode)}
                  disabled={savingKey === "maintenanceMode"}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                    config?.maintenanceMode
                      ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-600/30"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                  }`}
                >
                  {savingKey === "maintenanceMode" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                  <span>{config?.maintenanceMode ? "Enabled" : "Disabled"}</span>
                </button>
              </div>

              {/* User Signups Enabled */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white">New User Registrations</span>
                  <p className="text-[11px] text-slate-400">
                    Allow new users to sign up via credentials and OAuth providers.
                  </p>
                </div>

                <button
                  onClick={() => handleToggleConfig("signupEnabled", !!config?.signupEnabled)}
                  disabled={savingKey === "signupEnabled"}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                    config?.signupEnabled
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                  }`}
                >
                  {savingKey === "signupEnabled" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{config?.signupEnabled ? "Enabled" : "Disabled"}</span>
                </button>
              </div>

              {/* Email Verification Required */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white">Email Verification Required</span>
                  <p className="text-[11px] text-slate-400">
                    Require email verification before accessing tenant applications.
                  </p>
                </div>

                <button
                  onClick={() => handleToggleConfig("emailVerificationRequired", !!config?.emailVerificationRequired)}
                  disabled={savingKey === "emailVerificationRequired"}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                    config?.emailVerificationRequired
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                  }`}
                >
                  {savingKey === "emailVerificationRequired" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{config?.emailVerificationRequired ? "Required" : "Optional"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feature Flags Management with Rollout Sliders & Cohorts */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Feature Flags & Cohort Rollouts</h3>
              </div>
              <span className="text-xs text-slate-500">Live feature gating & progressive rollout</span>
            </div>

            <div className="space-y-4">
              {featureFlags.map((flag) => (
                <div
                  key={flag.key}
                  className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs font-mono">{flag.key}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            flag.enabled
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {flag.enabled ? `Active (${flag.rolloutPercentage || 100}%)` : "Disabled"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{flag.description}</p>
                    </div>

                    <button
                      onClick={() => handleToggleFlag(flag)}
                      disabled={savingKey === flag.key}
                      className={`self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                        flag.enabled
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-600/20"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                      }`}
                    >
                      {savingKey === flag.key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>{flag.enabled ? "Enabled" : "Disabled"}</span>
                    </button>
                  </div>

                  {/* Rollout Percentage Slider & Cohort Target */}
                  {flag.enabled && (
                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Sliders className="w-3 h-3 text-brand-400" />
                            <span>Rollout Traffic:</span>
                          </span>
                          <span className="font-bold text-white font-mono">{flag.rolloutPercentage || 100}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={flag.rolloutPercentage || 100}
                          onChange={(e) => handleRolloutChange(flag.key, parseInt(e.target.value))}
                          className="w-full accent-brand-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 text-[11px]">Target Cohort:</span>
                        <div className="flex items-center gap-1.5">
                          {["All Orgs", "Standard", "Premium", "Beta Testers"].map((cohort) => (
                            <span
                              key={cohort}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-300"
                            >
                              {cohort}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Global Support Notes Explorer */
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <span>Global Support Notes Ledger</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Search, review, and correlate administrative support notes across all tenant organizations.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={supportNoteSearch}
                onChange={(e) => setSupportNoteSearch(e.target.value)}
                placeholder="Search notes, ticket IDs..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              Support notes are indexed per user and organization profile. Select an individual user or organization to create and manage structured support tickets.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/users"
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Browse Users
              </Link>
              <Link
                to="/organizations"
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
              >
                Browse Organizations
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
