import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Download,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminAuditApi } from "../api/adminAudit";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";

export const AuditLogs: React.FC = () => {
  const { sessionToken } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"admin" | "security">("admin");
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const [adminRes, secRes]: any = await Promise.all([
        adminAuditApi.getAdminAuditLogs({
          sessionToken,
          search,
          actionFilter,
          resourceTypeFilter,
          page,
          pageSize: 20,
        }),
        adminAuditApi.getSecurityEvents(sessionToken).catch(() => []),
      ]);
      setLogs(adminRes?.items || []);
      setTotalCount(adminRes?.totalCount || 0);
      setTotalPages(adminRes?.totalPages || 1);
      setSecurityEvents(secRes || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionToken, page, search, actionFilter, resourceTypeFilter]);

  const handleExportCSV = async () => {
    if (!sessionToken) return;
    try {
      setExporting(true);
      const res = await adminAuditApi.exportAuditLogs(sessionToken);
      if (res?.data) {
        const headers = ["ID", "Action", "Resource", "Resource ID", "IP Address", "Timestamp", "Details"];
        const csvRows = [
          headers.join(","),
          ...res.data.map((r: any) =>
            [
              `"${r.id}"`,
              `"${r.action}"`,
              `"${r.resourceType}"`,
              `"${r.resourceId}"`,
              `"${r.ipAddress}"`,
              `"${r.timestamp}"`,
              `"${(r.details || "").replace(/"/g, '""')}"`,
            ].join(",")
          ),
        ];

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `orviohub_audit_export_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Audit Trail & Security Events</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable system audit logs tracking administrative governance, security incidents, and tenant modifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadData}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("admin")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "admin"
              ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          All Admin Actions ({totalCount})
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "security"
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Security Incidents ({securityEvents.length})</span>
        </button>
      </div>

      {activeTab === "admin" ? (
        <>
          {/* Filters & Search */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 max-w-md">
              <SearchBar
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Search action, IP, or details..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
              >
                <option value="all">All Actions</option>
                <option value="LOGIN">Logins</option>
                <option value="SUSPEND">Suspensions</option>
                <option value="ACTIVATE">Activations</option>
                <option value="DELETE">Deletions</option>
                <option value="CONFIG">Config Updates</option>
              </select>

              <select
                value={resourceTypeFilter}
                onChange={(e) => {
                  setResourceTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
              >
                <option value="all">All Resources</option>
                <option value="users">Users</option>
                <option value="workspaces">Workspaces</option>
                <option value="invitations">Invitations</option>
                <option value="products">Products</option>
                <option value="systemConfig">System Config</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-5">Action</th>
                    <th className="py-3.5 px-4">Actor (Admin)</th>
                    <th className="py-3.5 px-4">Resource</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Details</th>
                    <th className="py-3.5 px-5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                        Loading audit stream...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-500">
                        No audit records found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-4 px-5 font-bold text-white font-mono">
                          {l.action}
                        </td>

                        <td className="py-4 px-4 text-slate-300 font-semibold">
                          {l.adminEmail}
                        </td>

                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 text-[11px] border border-slate-800 uppercase font-mono font-bold">
                            {l.resourceType}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">
                          {l.ipAddress}
                        </td>

                        <td className="py-4 px-4 text-slate-400 max-w-xs truncate text-[11px]">
                          {l.details ? JSON.stringify(l.details) : "—"}
                        </td>

                        <td className="py-4 px-5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={20}
              onPageChange={setPage}
            />
          </div>
        </>
      ) : (
        /* Security Events Feed */
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Critical Security Events</h3>
            <span className="text-xs text-slate-500">Showing last 50 incidents</span>
          </div>

          {securityEvents.length === 0 ? (
            <p className="text-xs text-emerald-400 py-12 text-center">
              ✓ No suspicious access, account lockouts, or security violations recorded.
            </p>
          ) : (
            <div className="space-y-3">
              {securityEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-rose-500/20 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-rose-300 font-mono">{evt.action}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        IP: {evt.ipAddress} • {evt.details ? JSON.stringify(evt.details) : ""}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500 shrink-0">
                    {new Date(evt.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
