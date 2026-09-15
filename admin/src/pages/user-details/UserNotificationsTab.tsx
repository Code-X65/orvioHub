import React from "react";
import {
  Bell,
  Mail,
  Shield,
} from "lucide-react";

interface UserNotificationsTabProps {
  notificationsData: any;
  loading?: boolean;
}

export const UserNotificationsTab: React.FC<UserNotificationsTabProps> = ({
  notificationsData,
  loading,
}) => {
  if (loading || !notificationsData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading notification delivery logs and diagnostics...
      </div>
    );
  }

  const { metrics, preferences, recentNotifications, emailDeliveryLogs } = notificationsData;

  return (
    <div className="space-y-6">
      {/* 1. Diagnostics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Total In-App</span>
          <span className="text-lg font-bold text-white block">{metrics.totalNotifications}</span>
          <span className="text-[10px] text-slate-500">{metrics.unreadCount} unread currently</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Email Delivery Rate</span>
          <span className="text-lg font-bold text-emerald-400 block">
            {metrics.emailDeliverySuccessRate}%
          </span>
          <span className="text-[10px] text-slate-500">Transactional outbox</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Email Failures</span>
          <span
            className={`text-lg font-bold block ${
              metrics.failedEmailsCount > 0 ? "text-rose-400" : "text-slate-200"
            }`}
          >
            {metrics.failedEmailsCount}
          </span>
          <span className="text-[10px] text-slate-500">Delivery bounce / failure</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Privacy Guard</span>
          <span className="font-semibold text-slate-300 block mt-1 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-brand-400" /> Safe Diagnostics
          </span>
          <span className="text-[10px] text-slate-500">Private messages redacted</span>
        </div>
      </div>

      {/* Grid: Preferences & Recent In-App Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Notification Preferences */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Bell className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Notification Channel Preferences</h3>
          </div>

          {preferences.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              User is using default notification settings (all channels enabled).
            </p>
          ) : (
            <div className="space-y-2.5">
              {preferences.map((pref: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-slate-200 capitalize">
                    {pref.category?.toLowerCase()} ({pref.channel})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      pref.enabled
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {pref.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Outbox Delivery Logs */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Mail className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              Transactional Email Delivery Logs ({emailDeliveryLogs.length})
            </h3>
          </div>

          {emailDeliveryLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No transactional emails logged.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {emailDeliveryLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white capitalize">{log.template}</span>
                    {log.lastError && (
                      <span className="text-[10px] text-rose-400 block truncate max-w-xs">
                        Error: {log.lastError}
                      </span>
                    )}
                  </div>

                  <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold uppercase inline-block ${
                        log.status === "SENT"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : log.status === "FAILED"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="block">{new Date(log.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-App Notifications List */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Bell className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">
            Recent In-App User Notifications ({recentNotifications.length})
          </h3>
        </div>

        {recentNotifications.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No in-app notifications generated.</p>
        ) : (
          <div className="space-y-2.5">
            {recentNotifications.map((n: any) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{n.title}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[9px] text-slate-400">
                      {n.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{n.body}</p>
                </div>

                <div className="text-right text-[10px] text-slate-500 shrink-0">
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold uppercase inline-block mb-0.5 ${
                      n.status === "UNREAD" ? "text-amber-400" : "text-slate-500"
                    }`}
                  >
                    {n.status}
                  </span>
                  <div>{new Date(n.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserNotificationsTab;
