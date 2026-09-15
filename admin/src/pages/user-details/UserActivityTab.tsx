import React, { useState } from "react";
import {
  History,
  Clock,
  Code,
  Search,
} from "lucide-react";

interface UserActivityTabProps {
  activityData: any[];
  loading?: boolean;
}

export const UserActivityTab: React.FC<UserActivityTabProps> = ({ activityData, loading }) => {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventMetadata, setSelectedEventMetadata] = useState<any>(null);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading multi-source audit trail...
      </div>
    );
  }

  const filteredEvents = (activityData || []).filter((ev) => {
    if (severityFilter !== "all" && ev.severity !== severityFilter) return false;
    if (categoryFilter !== "all" && ev.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchType = (ev.eventType || "").toLowerCase().includes(q);
      const matchActor = (ev.actor || "").toLowerCase().includes(q);
      const matchIp = (ev.maskedIp || "").toLowerCase().includes(q);
      return matchType || matchActor || matchIp;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xl">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit events by type, actor, or IP..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="user_action">User Actions</option>
            <option value="admin_action">Admin Actions</option>
            <option value="security">Security & Auth</option>
          </select>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">
              Immutable Platform Audit Log Trail ({filteredEvents.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">NDPA & Regulatory Audited</span>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No audit records matching selected criteria.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredEvents.map((ev: any) => {
              const isCritical = ev.severity === "critical" || ev.severity === "high";
              const isWarning = ev.severity === "warning";

              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isCritical
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : isWarning
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {ev.severity || "info"}
                      </span>

                      <span className="font-bold text-white font-mono text-[11px]">
                        {ev.eventType}
                      </span>

                      <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[9px] capitalize">
                        {ev.category?.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Actor: <strong className="text-slate-200">{ev.actor}</strong></span>
                      <span>•</span>
                      <span>IP: <strong className="text-slate-300 font-mono">{ev.maskedIp}</strong></span>
                      {ev.requestId && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-500 text-[10px]">Req: {ev.requestId}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center shrink-0">
                    {ev.metadata && (
                      <button
                        onClick={() => setSelectedEventMetadata(ev.metadata)}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer"
                      >
                        <Code className="w-3 h-3" />
                        <span>Metadata</span>
                      </button>
                    )}

                    <div className="text-right text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(ev.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Metadata Viewer Modal */}
      {selectedEventMetadata && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm">Event Payload Metadata</h4>
              <button
                onClick={() => setSelectedEventMetadata(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-80">
              {JSON.stringify(selectedEventMetadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserActivityTab;
