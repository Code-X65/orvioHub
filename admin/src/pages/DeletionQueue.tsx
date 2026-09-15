import React, { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  ShieldAlert,
  Loader2,
  Search,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminDeletionsApi } from "../api/adminDeletions";

interface PendingDeletion {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  deletionRequestedAt: number;
  deletionScheduledAt: number;
  daysRemaining: number;
  reason: string;
}

export const DeletionQueue: React.FC = () => {
  const { sessionToken } = useAuth();
  const [deletions, setDeletions] = useState<PendingDeletion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForPurge, setSelectedForPurge] = useState<PendingDeletion | null>(null);
  const [purgePhrase, setPurgePhrase] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDeletions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await adminDeletionsApi.listPendingDeletions(sessionToken);
      setDeletions(res?.pending || res || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to load deletion queue" });
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchDeletions();
  }, [fetchDeletions]);

  const handleCancelDeletion = async (org: PendingDeletion) => {
    if (!window.confirm(`Are you sure you want to abort deletion for "${org.name}"? It will be restored to active.`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await adminDeletionsApi.cancelDeletion(
        sessionToken,
        org.id,
        "Cancelled by Superadmin in administrative review"
      );
      setMessage({ type: "success", text: `Deletion aborted for ${org.name}. Workspace restored to active.` });
      fetchDeletions();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to cancel deletion" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurgeImmediate = async () => {
    if (!selectedForPurge) return;
    if (purgePhrase.trim() !== `purge ${selectedForPurge.slug}`) {
      alert(`Please type exact confirmation phrase: purge ${selectedForPurge.slug}`);
      return;
    }
    setIsProcessing(true);
    try {
      await adminDeletionsApi.purgeImmediate(
        sessionToken,
        selectedForPurge.id,
        purgePhrase.trim(),
        "Immediate administrative purge requested"
      );
      setMessage({ type: "success", text: `${selectedForPurge.name} has been immediately purged.` });
      setSelectedForPurge(null);
      setPurgePhrase("");
      fetchDeletions();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to purge organization" });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredDeletions = deletions.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.ownerEmail || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-rose-400" />
            Pending Deletion Queue
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Organizations in their 30-day grace period awaiting permanent purge or recovery.
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenant or email..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading deletion review queue...</p>
          </div>
        ) : filteredDeletions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400/80 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Pending Deletions</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              All workspace tenants are currently in good standing with zero active deletion requests.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Organization</th>
                  <th className="px-5 py-3.5">Owner Details</th>
                  <th className="px-5 py-3.5">Requested Date</th>
                  <th className="px-5 py-3.5">Grace Period</th>
                  <th className="px-5 py-3.5 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDeletions.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{d.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{d.slug}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-slate-200 font-medium">{d.ownerName}</div>
                      <div className="text-[11px] text-slate-400">{d.ownerEmail}</div>
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(d.deletionRequestedAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">{d.reason}</div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        {d.daysRemaining} days left
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleCancelDeletion(d)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15 font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Abort Deletion
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedForPurge(d);
                          setPurgePhrase("");
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/40 font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Immediate Purge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Immediate Purge Modal */}
      {selectedForPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Execute Immediate Purge</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bypass the remaining {selectedForPurge.daysRemaining} days and purge "{selectedForPurge.name}".
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 block">
                Type <span className="font-mono font-bold text-rose-400 bg-black/40 px-1.5 py-0.5 rounded">purge {selectedForPurge.slug}</span> to confirm:
              </label>
              <input
                type="text"
                value={purgePhrase}
                onChange={(e) => setPurgePhrase(e.target.value)}
                placeholder={`purge ${selectedForPurge.slug}`}
                className="w-full px-3 py-2 bg-black/60 border border-rose-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedForPurge(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeImmediate}
                disabled={purgePhrase.trim() !== `purge ${selectedForPurge.slug}` || isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-950/50 flex items-center gap-2 cursor-pointer"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Purge Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletionQueue;
