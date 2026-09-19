import React, { useEffect, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code,
  RotateCcw,
  Search,
  X,
  Copy,
  Check,
} from "lucide-react";
import { adminBillingApi, BillingEventRecord } from "../api/adminBilling";

interface WebhookEventsTableProps {
  onRetrySuccess?: () => void;
}

export const WebhookEventsTable: React.FC<WebhookEventsTableProps> = ({ onRetrySuccess }) => {
  const [events, setEvents] = useState<BillingEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<BillingEventRecord | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await adminBillingApi.listBillingEvents(statusFilter, 100);
      setEvents(data);
    } catch (err) {
      console.error("Failed to load webhook events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [statusFilter]);

  const handleRetry = async (event: BillingEventRecord) => {
    setRetryingId(event._id);
    setActionMessage(null);
    try {
      const res = await adminBillingApi.retryFailedWebhook({
        billingEventId: event._id,
        providerEventId: event.providerEventId,
      });

      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Event "${event.eventType}" (${event.providerEventId}) successfully replayed & processed!`,
        });
        await fetchEvents();
        if (onRetrySuccess) onRetrySuccess();
      } else {
        setActionMessage({
          type: "error",
          text: `Replay returned status: ${res.status}`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Failed to retry webhook event.",
      });
      await fetchEvents();
    } finally {
      setRetryingId(null);
    }
  };

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const filteredEvents = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      ev.eventType?.toLowerCase().includes(q) ||
      ev.providerEventId?.toLowerCase().includes(q) ||
      ev.errorMessage?.toLowerCase().includes(q)
    );
  });

  const failedCount = events.filter((e) => e.status === "failed").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3 h-3" />
            Processed
          </span>
        );
      case "failed":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3 h-3" />
            Failed
          </span>
        );
      case "received":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-fit">
            <Clock className="w-3 h-3" />
            Received
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 w-fit">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            All Events ({events.length})
          </button>
          <button
            onClick={() => setStatusFilter("failed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "failed"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Failed ({failedCount})
          </button>
          <button
            onClick={() => setStatusFilter("processed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === "processed"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            Processed
          </button>
          <button
            onClick={() => setStatusFilter("received")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === "received"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            Received
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event type or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh Webhooks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Webhook Events Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event Type & Provider</th>
                <th className="py-3 px-4">Provider Event ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Details / Error</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Loading webhook events...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No webhook events recorded matching this filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => {
                  const isRetrying = retryingId === ev._id;
                  const isFailed = ev.status === "failed";

                  return (
                    <tr key={ev._id} className="hover:bg-slate-800/30 transition">
                      {/* Event Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {ev.eventType}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-1">
                          Provider: {ev.provider || "paystack"}
                        </span>
                      </td>

                      {/* Provider Event ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        {ev.providerEventId || "—"}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{getStatusBadge(ev.status)}</td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-400">
                        <div>{new Date(ev.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(ev.createdAt).toLocaleTimeString()}
                        </div>
                      </td>

                      {/* Error or Processed Info */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {ev.errorMessage ? (
                          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono break-all line-clamp-2">
                            {ev.errorMessage}
                          </div>
                        ) : ev.processedAt ? (
                          <span className="text-[11px] text-slate-400">
                            Processed {new Date(ev.processedAt).toLocaleTimeString()}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPayload(ev)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                            title="Inspect Raw Webhook Payload"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </button>

                          {/* One-Click Replay / Retry Webhook Button */}
                          <button
                            onClick={() => handleRetry(ev)}
                            disabled={isRetrying}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                              isFailed
                                ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30 shadow-sm shadow-rose-950"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                            }`}
                            title={isFailed ? "Manually replay failed webhook" : "Replay webhook event"}
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin text-amber-400" : ""}`} />
                            {isRetrying ? "Replaying..." : isFailed ? "Retry Event" : "Replay"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Inspection Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Payload: <span className="font-mono text-emerald-400">{selectedPayload.eventType}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedPayload(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Provider Event ID: <span className="font-mono text-slate-200">{selectedPayload.providerEventId}</span></span>
                <button
                  onClick={() => handleCopyJson(selectedPayload.payloadMetadata || selectedPayload)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPayload ? "Copied" : "Copy JSON"}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-auto max-h-96">
                {JSON.stringify(selectedPayload.payloadMetadata || {}, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Received: {new Date(selectedPayload.createdAt).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ev = selectedPayload;
                    setSelectedPayload(null);
                    handleRetry(ev);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Replay This Event
                </button>
                <button
                  onClick={() => setSelectedPayload(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
