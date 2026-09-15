import React from "react";
import {
  CreditCard,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
} from "lucide-react";

interface UserBillingTabProps {
  billingData: any;
  loading?: boolean;
}

export const UserBillingTab: React.FC<UserBillingTabProps> = ({ billingData, loading }) => {
  if (loading || !billingData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading billing accounts, Paystack subscriptions, and payment history...
      </div>
    );
  }

  const { summary, mismatches, organizations, manualPayments } = billingData;

  return (
    <div className="space-y-6">
      {/* 1. Mismatch Indicator Banner */}
      {mismatches && mismatches.length > 0 ? (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-200 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Billing Status: Mismatch Detected ({mismatches.length})</span>
          </div>
          <p className="text-xs text-amber-300/90">
            The platform detected potential inconsistencies between payment events and active organization subscription states:
          </p>
          <div className="space-y-1.5 pt-1 text-xs">
            {mismatches.map((m: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/20 text-slate-200 flex items-start gap-2"
              >
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold uppercase text-[9px] mt-0.5">
                  {m.type}
                </span>
                <div>
                  <span className="font-bold text-white block">{m.organizationName}</span>
                  <span className="text-[11px] text-slate-300">{m.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">Billing Status: Consistent</span>
          </div>
          <span className="text-[11px] text-emerald-400/80">
            All Paystack subscriptions and entitlements are in sync across {organizations.length} organization(s).
          </span>
        </div>
      )}

      {/* 2. Billing Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Total Subscriptions</span>
          <span className="text-lg font-bold text-white block">{summary.totalSubscriptions}</span>
          <span className="text-[10px] text-slate-500">
            {summary.activePaidSubscriptions} active paid tier(s)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Failed Payments</span>
          <span
            className={`text-lg font-bold block ${
              summary.failedPaymentsCount > 0 ? "text-rose-400" : "text-slate-200"
            }`}
          >
            {summary.failedPaymentsCount}
          </span>
          <span className="text-[10px] text-slate-500">Require retry or review</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Total Payments Logged</span>
          <span className="text-lg font-bold text-white block">{summary.totalPaymentsRecorded}</span>
          <span className="text-[10px] text-slate-500">Through Paystack / Manual</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Compliance Boundary</span>
          <span className="font-semibold text-slate-300 block mt-1 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-brand-400" /> PCI-DSS Safe
          </span>
          <span className="text-[10px] text-slate-500">Card details sanitized</span>
        </div>
      </div>

      {/* 3. Per-Organization Subscription Details */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <CreditCard className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">
            Organization Subscriptions & Paystack Relationships ({organizations.length})
          </h3>
        </div>

        {organizations.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No organizations connected to this user.</p>
        ) : (
          <div className="space-y-6">
            {organizations.map((org: any) => {
              const sub = org.subscription;
              return (
                <div
                  key={org.workspaceId}
                  className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-brand-400" />
                      <span className="font-bold text-white text-sm">{org.organizationName}</span>
                      <span className="font-mono text-[11px] text-slate-500">ID: {org.workspaceId}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold text-[10px] border border-blue-500/20 capitalize">
                        {sub.planName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sub.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-purple-500/10 text-purple-300"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  {/* Subscription metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block uppercase text-[10px] font-bold">Interval & Cost</span>
                      <span className="font-semibold text-slate-200">
                        {sub.currency} {sub.amount?.toLocaleString()} / {sub.billingInterval}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block uppercase text-[10px] font-bold">Current Period</span>
                      <span className="font-semibold text-slate-200">
                        {new Date(sub.currentPeriodStart).toLocaleDateString()} &rarr;{" "}
                        {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block uppercase text-[10px] font-bold">Paystack Customer</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {sub.paystackCustomerCode || "None recorded"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block uppercase text-[10px] font-bold">Subscription Code</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {sub.paystackSubscriptionCode || "None"}
                      </span>
                    </div>
                  </div>

                  {/* Payment Transactions List for this Org */}
                  {org.payments && org.payments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Recent Payment Transactions:
                      </span>
                      <div className="space-y-1.5">
                        {org.payments.map((p: any) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">
                                {p.currency} {p.amount?.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Ref: {p.reference || "N/A"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded font-bold uppercase ${
                                  p.status === "success" || p.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                {p.status}
                              </span>
                              <span className="text-slate-500">
                                {new Date(p.completedAt || p.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoices List for this Org */}
                  {org.invoices && org.invoices.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Generated Invoices:
                      </span>
                      <div className="space-y-1.5">
                        {org.invoices.map((inv: any) => (
                          <div
                            key={inv.id}
                            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono font-bold text-white">
                                {inv.invoiceNumber}
                              </span>
                              <span className="text-slate-400">
                                {inv.currency} {inv.amount?.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded font-bold uppercase ${
                                  inv.status === "paid"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-amber-500/10 text-amber-400"
                                }`}
                              >
                                {inv.status}
                              </span>
                              <span className="text-slate-500">
                                Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Manual Payments Recorded */}
      {manualPayments && manualPayments.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Offline & Manual Payments Recorded</h3>
          </div>

          <div className="space-y-2 text-xs">
            {manualPayments.map((m: any) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {m.currency} {m.amount?.toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {m.paymentMethod}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Ref: {m.paymentReference} {m.notes ? `• ${m.notes}` : ""}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Paid: {new Date(m.paidAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBillingTab;
