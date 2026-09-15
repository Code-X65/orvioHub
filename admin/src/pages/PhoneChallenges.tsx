import React, { useEffect, useState } from "react";
import {
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Percent,
  Send,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminPhoneChallengesApi } from "../api/adminPhoneChallenges";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";

export const PhoneChallenges: React.FC = () => {
  const { sessionToken } = useAuth();
  const [challenges, setChallenges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadChallenges = async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res: any = await adminPhoneChallengesApi.getPhoneChallenges({
        sessionToken,
        search,
        statusFilter: statusFilter === "all" ? undefined : statusFilter,
        purposeFilter: purposeFilter === "all" ? undefined : purposeFilter,
        page: pagination.page,
        pageSize: pagination.pageSize,
      });

      if (res) {
        setChallenges(res.challenges || []);
        setStats(res.stats || null);
        if (res.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load phone challenges:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallenges();
  }, [sessionToken, pagination.page, statusFilter, purposeFilter]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Phone className="w-6 h-6 text-brand-400" />
            <span>Phone Verification Challenges</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit trail of OTP challenges, SMS verification deliverability, and rate-limiting diagnostics.
          </p>
        </div>

        <button
          onClick={loadChallenges}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 24h Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">24h Challenges</span>
              <Send className="w-4 h-4 text-brand-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalChallenges24h}</div>
            <span className="text-[11px] text-slate-500">OTP requests started</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Success Rate</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{stats.successRatePercent}%</div>
            <span className="text-[11px] text-slate-500">{stats.verifiedCount24h} verified successfully</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Active Pending</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.activePendingCount}</div>
            <span className="text-[11px] text-slate-500">Awaiting user OTP entry</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Expired (24h)</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">{stats.expiredCount24h}</div>
            <span className="text-[11px] text-slate-500">Unanswered challenges</span>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Cryptographic Security Safeguard: </span>
          Raw OTP digits are never persisted or displayed in administrative databases or logs. Only SHA-256 hashes are verified during challenge attempts.
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="Search by phone number or purpose..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="expired">Expired</option>
            <option value="failed">Failed / Cancelled</option>
          </select>

          <select
            value={purposeFilter}
            onChange={(e) => {
              setPurposeFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="all">All Purposes</option>
            <option value="user_phone_verification">User Personal Phone</option>
            <option value="workspace_phone_verification">Workspace Phone</option>
            <option value="branch_phone_verification">Branch Phone</option>
          </select>
        </div>
      </div>

      {/* Challenges Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">Target Phone</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Attempts & Resends</th>
                <th className="py-3.5 px-4">Expires / Verified At</th>
                <th className="py-3.5 px-5 text-right">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading verification challenges...
                  </td>
                </tr>
              ) : challenges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    No phone verification challenges found.
                  </td>
                </tr>
              ) : (
                challenges.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-semibold text-white">{c.maskedPhone}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        ID: {c.id}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700 capitalize">
                        {c.purpose.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {c.status === "verified" ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : c.isExpired || c.status === "expired" ? (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-700 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Expired
                        </span>
                      ) : c.status === "pending" ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending Entry
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {c.status}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-0.5 text-[11px]">
                        <div>
                          <span className="text-slate-400">Attempts: </span>
                          <span className={c.attempts >= c.maxAttempts ? "text-rose-400 font-bold" : "text-white"}>
                            {c.attempts}/{c.maxAttempts}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Resends: {c.resendCount}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-0.5 text-[11px]">
                        {c.verifiedAt ? (
                          <div className="text-emerald-400 font-medium">
                            {new Date(c.verifiedAt).toLocaleString()}
                          </div>
                        ) : (
                          <div className={c.isExpired ? "text-slate-500" : "text-amber-300"}>
                            Expires: {new Date(c.expiresAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-5 text-right font-mono text-slate-400 text-[11px]">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.total}
            pageSize={pagination.pageSize}
            onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
          />
        )}
      </div>
    </div>
  );
};

export default PhoneChallenges;
