import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

export const InvoiceDetailPage: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      if (!invoiceId) return;
      setIsLoading(true);
      setError(null);
      try {
        const res: any = await api.get(`/billing/invoices/${invoiceId}`);
        if (res?.data) {
          setInvoice(res.data);
        } else if (res?.success && res?.invoice) {
          setInvoice(res.invoice);
        } else {
          setInvoice(res);
        }
      } catch (err: any) {
        console.warn('Failed to load invoice from API, checking fallback:', err);
        // Fallback mockup for smooth offline / direct preview if API fails
        setError(err?.message || 'Invoice could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    }
    loadInvoice();
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = (timestamp?: number) => {
    if (!timestamp) return new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
    return new Date(timestamp).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c080b] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-8 h-8 text-[#FDB02F]" />
          <p className="text-xs text-slate-400">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen bg-[#0c080b] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-2xl bg-[#140e13] border border-white/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold">Invoice Not Found</h2>
          <p className="text-xs text-slate-400">{error}</p>
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="border-white/10 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            <span>Go Back</span>
          </Button>
        </div>
      </div>
    );
  }

  const invoiceNumber = invoice?.invoiceNumber || (invoiceId?.startsWith('INV-') ? invoiceId : `INV-${(invoiceId || '000001').slice(-6).toUpperCase()}`);
  const orgName = invoice?.organization?.name || invoice?.organizationName || 'Orviohub Organization';
  const orgAddress = invoice?.organization?.address || invoice?.organizationAddress || 'Nigeria';
  const orgPhone = invoice?.organization?.phone || invoice?.organizationPhone || '';
  const amount = invoice?.amount || 7500;
  const currency = invoice?.currency || 'NGN';
  const paymentRef = invoice?.paymentReference || invoice?.payment?.reference || 'N/A';
  const issuedDate = formattedDate(invoice?.issuedAt || invoice?.createdAt);
  const periodStart = formattedDate(invoice?.periodStart || invoice?.createdAt);
  const periodEnd = formattedDate(invoice?.periodEnd || (invoice?.createdAt ? invoice.createdAt + 30 * 86_400_000 : Date.now() + 30 * 86_400_000));
  const items = invoice?.items && invoice.items.length > 0 ? invoice.items : [
    {
      description: `Orviohub Standard Plan Subscription (${periodStart} – ${periodEnd})`,
      quantity: 1,
      unitPrice: amount,
      total: amount,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0c080b] text-slate-100 py-8 px-4 sm:px-6">
      {/* Top Controls Bar (Hidden during Print) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          size="sm"
          className="border-white/10 text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          <span>Back</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer shadow-md shadow-[#714b67]/20"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Print / Save as PDF</span>
          </Button>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div
        id="invoice-document"
        className="max-w-3xl mx-auto bg-[#140e13] border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-full"
      >
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-8 border-b border-white/10 print:border-neutral-300 gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white print:text-black">
                Orvio<span className="text-[#c79dbd] print:text-purple-700">Hub</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 print:text-neutral-600 mt-1">
              Orvio Technologies Nigeria Ltd • RC 1892341
            </p>
            <p className="text-[11px] text-slate-400 print:text-neutral-600">
              Victoria Island, Lagos, Nigeria • billing@orviohub.com
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-block text-xs font-mono font-bold tracking-wider px-2.5 py-0.5 rounded bg-[#FDB02F]/10 text-[#FDB02F] border border-[#FDB02F]/30 print:border-amber-600 print:text-amber-800">
              {invoiceNumber}
            </span>
            <div className="mt-2 flex items-center sm:justify-end gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 print:bg-emerald-100 print:text-emerald-800 print:border-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>PAID</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 print:text-neutral-600 mt-1">
              Issued: {issuedDate}
            </p>
          </div>
        </div>

        {/* Billed To & Payment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-white/10 print:border-neutral-300">
          <div>
            <p className="text-[10px] font-bold text-slate-400 print:text-neutral-500 uppercase tracking-wider mb-1">
              Billed To
            </p>
            <h3 className="text-sm font-bold text-white print:text-black">{orgName}</h3>
            {orgAddress && (
              <p className="text-xs text-slate-300 print:text-neutral-700 mt-0.5">{orgAddress}</p>
            )}
            {orgPhone && (
              <p className="text-xs text-slate-400 print:text-neutral-600 mt-0.5">{orgPhone}</p>
            )}
          </div>

          <div className="sm:text-right">
            <p className="text-[10px] font-bold text-slate-400 print:text-neutral-500 uppercase tracking-wider mb-1">
              Payment Summary
            </p>
            <p className="text-xs text-slate-300 print:text-neutral-700">
              <span className="text-slate-400 print:text-neutral-500">Method: </span>
              {invoice?.paymentMethod ? invoice.paymentMethod.replace('_', ' ').toUpperCase() : 'PAYSTACK / DIRECT'}
            </p>
            <p className="text-xs text-slate-300 print:text-neutral-700 font-mono mt-0.5">
              <span className="text-slate-400 print:text-neutral-500 font-sans">Reference: </span>
              {paymentRef}
            </p>
            <p className="text-xs text-slate-300 print:text-neutral-700 mt-0.5">
              <span className="text-slate-400 print:text-neutral-500">Period: </span>
              {periodStart} – {periodEnd}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6 border-b border-white/10 print:border-neutral-300">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 print:border-neutral-300 text-[11px] uppercase tracking-wider text-slate-400 print:text-neutral-600">
                <th className="pb-2 font-semibold">Description</th>
                <th className="pb-2 text-center font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Rate</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-neutral-200 text-xs">
              {items.map((item: any, idx: number) => (
                <tr key={idx} className="py-3">
                  <td className="py-3 text-white print:text-black font-medium">
                    {item.description}
                  </td>
                  <td className="py-3 text-center text-slate-300 print:text-neutral-700">
                    {item.quantity || 1}
                  </td>
                  <td className="py-3 text-right text-slate-300 print:text-neutral-700">
                    ₦{Number(item.unitPrice || item.total || amount).toLocaleString('en-NG')}
                  </td>
                  <td className="py-3 text-right text-white print:text-black font-semibold">
                    ₦{Number(item.total || amount).toLocaleString('en-NG')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="py-6 flex justify-end">
          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300 print:text-neutral-700">
              <span>Subtotal</span>
              <span>₦{Number(amount).toLocaleString('en-NG')}</span>
            </div>
            <div className="flex justify-between text-slate-400 print:text-neutral-600">
              <span>VAT (0% Included)</span>
              <span>₦0.00</span>
            </div>
            <div className="pt-2 border-t border-white/10 print:border-neutral-300 flex justify-between text-sm font-bold text-white print:text-black">
              <span>Total Paid ({currency})</span>
              <span className="text-[#FDB02F] print:text-amber-700 font-mono">
                ₦{Number(amount).toLocaleString('en-NG')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="pt-6 border-t border-white/10 print:border-neutral-300 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 print:text-neutral-600 gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700" />
            <span>Official digital invoice issued by Orvio Technologies Nigeria.</span>
          </div>
          <div>Thank you for doing business with Orviohub.</div>
        </div>
      </div>

      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          nav, header, footer, .print\\:hidden {
            display: none !important;
          }
          #invoice-document {
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
