import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  Search,
  Download,
  RefreshCw,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Building2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminBillingApi, AdminInvoice } from "../api/adminBilling";

export const InvoiceManagement: React.FC = () => {
  const { sessionToken } = useAuth();
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  
  const [generating, setGenerating] = useState(false);
  const [actionInvoiceId, setActionInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoice | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await adminBillingApi.listInvoices(
        { filter, search, page, pageSize },
        sessionToken || undefined
      );
      setInvoices(res.items || []);
      setTotalCount(res.totalCount || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [sessionToken, filter, search, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleGenerateBatch = async () => {
    if (!confirm("Generate invoices for all eligible active/past due subscriptions?")) return;
    setGenerating(true);
    try {
      const res = await adminBillingApi.generatePendingInvoices(sessionToken || undefined);
      alert(res.message || "Batch generation completed.");
      await fetchInvoices();
    } catch (err: any) {
      alert(err.message || "Invoice generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleEmailInvoice = async (invoiceId: string) => {
    setActionInvoiceId(invoiceId);
    try {
      const res = await adminBillingApi.emailInvoice(sessionToken || undefined, invoiceId);
      alert(res.message || "Invoice email dispatched to organization owner.");
    } catch (err: any) {
      alert(err.message || "Failed to send invoice email.");
    } finally {
      setActionInvoiceId(null);
    }
  };

  const handleExportCSV = () => {
    if (!invoices.length) {
      alert("No invoices available to export.");
      return;
    }
    const headers = [
      "Invoice Number",
      "Organization ID",
      "Plan",
      "Amount (NGN)",
      "Cycle",
      "Status",
      "Issue Date",
      "Due Date",
      "Reference",
    ];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.organizationId,
      inv.planKey,
      inv.amount,
      inv.billingCycle,
      inv.status,
      new Date(inv.issueDate).toISOString().split("T")[0],
      new Date(inv.dueDate).toISOString().split("T")[0],
      inv.providerReference || "N/A",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoices_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px] font-bold mb-2">
            <Receipt className="w-3 h-3" />
            <span>Billing Records & Dispatch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Invoice Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track issued subscription invoices, run bulk billing cycles, and dispatch email receipts to organization owners.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-medium cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleGenerateBatch}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition text-xs font-semibold cursor-pointer shadow-lg shadow-brand-600/20 disabled:opacity-50"
          >
            <PlusCircle className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Generating..." : "Generate Pending Invoices"}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {[
              { key: "all", label: "All Invoices" },
              { key: "paid", label: "Paid" },
              { key: "pending", label: "Pending" },
              { key: "overdue", label: "Overdue" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setFilter(tab.key);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  filter === tab.key
                    ? "bg-brand-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search invoice # or org..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => fetchInvoices()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-400" : ""}`} />
            </button>
          </form>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Invoice Number</th>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Plan & Amount</th>
                <th className="py-3.5 px-4">Billing Cycle</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Issue / Due Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    <span>Loading invoice records...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-semibold text-slate-200">No invoices found</p>
                    <p className="text-[11px] mt-0.5">Try changing your filters or generating pending invoices.</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isSendingEmail = actionInvoiceId === (inv.id || inv._id);
                  return (
                    <tr key={inv.id || inv._id || inv.invoiceNumber} className="hover:bg-slate-900/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/organizations/${inv.organizationId}`}
                          className="font-semibold text-white hover:text-brand-300 transition flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{inv.organizationName || `Org: ${inv.organizationId.slice(0, 10)}...`}</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="capitalize font-medium text-white">{inv.planKey}</span>
                        <span className="text-slate-400 block font-mono text-[11px]">
                          ₦{Number(inv.amount || 0).toLocaleString("en-NG")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-slate-300">
                        {inv.billingCycle}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        <div>Issued: {new Date(inv.issueDate).toLocaleDateString("en-NG")}</div>
                        <div className="text-slate-500">Due: {new Date(inv.dueDate).toLocaleDateString("en-NG")}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEmailInvoice(inv.id || inv._id || "")}
                            disabled={isSendingEmail}
                            title="Dispatch official invoice email"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer disabled:opacity-50"
                          >
                            <Send className={`w-3.5 h-3.5 ${isSendingEmail ? "animate-spin text-brand-400" : ""}`} />
                          </button>
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition cursor-pointer"
                          >
                            View
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-white">{invoices.length}</span> of{" "}
            <span className="font-semibold text-white">{totalCount}</span> invoices
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Invoice {selectedInvoice.invoiceNumber}</h3>
                  <p className="text-xs text-slate-400">Issued for {selectedInvoice.organizationName || selectedInvoice.organizationId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div>
                  <span className="text-slate-400 text-[11px] block">Plan / Subscription</span>
                  <span className="font-semibold text-white capitalize">{selectedInvoice.planKey} ({selectedInvoice.billingCycle})</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Invoice Amount</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    ₦{Number(selectedInvoice.amount || 0).toLocaleString("en-NG")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Issue Date</span>
                  <span className="text-slate-200">{new Date(selectedInvoice.issueDate).toLocaleDateString("en-NG")}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Due Date</span>
                  <span className="text-slate-200">{new Date(selectedInvoice.dueDate).toLocaleDateString("en-NG")}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status</span>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Provider Ref</span>
                  <span className="font-mono text-slate-300">{selectedInvoice.providerReference || "Manual / Generated"}</span>
                </div>
                {selectedInvoice.paidAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Paid At</span>
                    <span className="text-slate-300">{new Date(selectedInvoice.paidAt).toLocaleString("en-NG")}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  handleEmailInvoice(selectedInvoice.id || selectedInvoice._id || "");
                  setSelectedInvoice(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Email Receipt</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceManagement;
