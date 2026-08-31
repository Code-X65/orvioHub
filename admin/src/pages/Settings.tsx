import React, { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  Flag,
  Check,
  Loader2,
  RefreshCw,
  Power,
  Zap,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminConfigApi } from "../api/adminConfig";

export const Settings: React.FC = () => {
  const { sessionToken } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
        newEnabled ? 100 : 0,
        flag.description
      );
      setFeatureFlags((prev) =>
        prev.map((f) =>
          f.key === flag.key
            ? { ...f, enabled: newEnabled, rolloutPercentage: newEnabled ? 100 : 0 }
            : f
        )
      );
    } catch (err) {
      console.error("Failed to update feature flag:", err);
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
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

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
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
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

          {/* Email Verification Requirement */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white">Require Email Verification</span>
              <p className="text-[11px] text-slate-400">
                Users must verify their email via OTP before provisioning organizations or products.
              </p>
            </div>

            <button
              onClick={() =>
                handleToggleConfig("emailVerificationRequired", !!config?.emailVerificationRequired)
              }
              disabled={savingKey === "emailVerificationRequired"}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
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

      {/* Feature Flags Management */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Feature Flags & Beta Rollouts</h3>
          </div>
          <span className="text-xs text-slate-500">Live feature gating</span>
        </div>

        <div className="space-y-3">
          {featureFlags.map((flag) => (
            <div
              key={flag.key}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
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
                    {flag.enabled ? `Enabled (${flag.rolloutPercentage}%)` : "Disabled"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{flag.description}</p>
              </div>

              <button
                onClick={() => handleToggleFlag(flag)}
                disabled={savingKey === flag.key}
                className={`self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
