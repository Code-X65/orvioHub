import React, { useRef } from 'react';
import { Printer, Phone, MapPin, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ReceiptSettingsData {
  storeName?: string;
  tagline?: string;
  headerText?: string;
  footerText?: string;
  returnPolicy?: string;
  tin?: string;
  vatRate?: number;
  enableVat?: boolean;
  showCashier?: boolean;
  showCustomer?: boolean;
  showBarcode?: boolean;
  paperWidth?: '58mm' | '80mm';
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
}

interface ThermalReceiptPreviewProps {
  settings: ReceiptSettingsData;
  workspaceName?: string;
}

export const ThermalReceiptPreview: React.FC<ThermalReceiptPreviewProps> = ({
  settings,
  workspaceName,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const is58mm = settings.paperWidth === '58mm';
  const widthClass = is58mm ? 'max-w-[280px]' : 'max-w-[360px]';

  const storeName = settings.storeName || workspaceName || 'Orviohub Store';
  const vatRate = settings.vatRate ?? 7.5;
  const enableVat = settings.enableVat ?? false;

  // Sample receipt items for preview
  const sampleItems = [
    { name: 'Golden Penny Semovita 2kg', qty: 2, price: 3400, total: 6800 },
    { name: 'Peak Milk Refill 400g', qty: 1, price: 4200, total: 4200 },
    { name: 'Milo Refill Economy 500g', qty: 1, price: 3900, total: 3900 },
  ];

  const subtotal = sampleItems.reduce((acc, i) => acc + i.total, 0);
  const vatAmount = enableVat ? Math.round((subtotal * vatRate) / 100) : 0;
  const grandTotal = subtotal + vatAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex items-center justify-between w-full max-w-sm px-2">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span>Thermal Printer Live Preview</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {settings.paperWidth || '80mm'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-7 text-xs gap-1.5 border-slate-700 hover:bg-slate-800 text-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            Test Print
          </Button>
        </div>
      </div>

      {/* Simulated Thermal Paper Roll Container */}
      <div className="p-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl shadow-2xl flex justify-center w-full">
        <div
          ref={receiptRef}
          className={`w-full ${widthClass} bg-[#fffdfa] text-[#1c1917] p-5 shadow-xl transition-all duration-300 rounded-sm font-mono text-[11px] leading-tight selection:bg-amber-200 selection:text-black border-t-4 border-amber-600/30 relative print:m-0 print:p-2 print:shadow-none print:max-w-none print:w-[80mm]`}
          style={{ fontFamily: '"Courier Prime", Courier, monospace' }}
        >
          {/* Top Receipt Notch */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-400">
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="max-h-10 mx-auto object-contain mb-1"
              />
            )}
            <h3 className="font-bold text-sm tracking-tight text-stone-950 uppercase">
              {storeName}
            </h3>
            {settings.tagline && (
              <p className="text-[10px] text-stone-600 italic">{settings.tagline}</p>
            )}
            {settings.address && (
              <p className="text-[10px] text-stone-700 flex items-center justify-center gap-1">
                <MapPin className="w-2.5 h-2.5 inline" />
                {settings.address}
              </p>
            )}
            {settings.phone && (
              <p className="text-[10px] text-stone-700 flex items-center justify-center gap-1">
                <Phone className="w-2.5 h-2.5 inline" />
                TEL: {settings.phone}
              </p>
            )}
            {settings.tin && (
              <p className="text-[10px] text-stone-800 font-semibold">TIN: {settings.tin}</p>
            )}
            {settings.headerText && (
              <p className="text-[10px] text-stone-600 pt-1 border-t border-dotted border-stone-300">
                {settings.headerText}
              </p>
            )}
          </div>

          {/* Meta Info */}
          <div className="py-2.5 space-y-1 text-[10px] border-b border-dashed border-stone-400">
            <div className="flex justify-between">
              <span>RECEIPT #:</span>
              <span className="font-bold">RCP-2026-9842</span>
            </div>
            <div className="flex justify-between">
              <span>DATE:</span>
              <span>{new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {settings.showCashier !== false && (
              <div className="flex justify-between">
                <span>CASHIER:</span>
                <span>Attendant #1 (POS-01)</span>
              </div>
            )}
            {settings.showCustomer !== false && (
              <div className="flex justify-between">
                <span>CUSTOMER:</span>
                <span>Walk-in Customer</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="py-2.5 border-b border-dashed border-stone-400">
            <div className="flex justify-between font-bold pb-1 text-[10px] border-b border-stone-300 uppercase">
              <span>ITEM</span>
              <span>TOTAL (NGN)</span>
            </div>
            <div className="space-y-2 pt-1.5">
              {sampleItems.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span className="truncate max-w-[180px]">{item.name}</span>
                    <span>₦{item.total.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {item.qty} x ₦{item.price.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="py-2.5 space-y-1.5 border-b border-dashed border-stone-400 text-[11px]">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>
            {enableVat && (
              <div className="flex justify-between text-stone-700">
                <span>VAT ({vatRate}%):</span>
                <span>₦{vatAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-stone-300 text-stone-950">
              <span>TOTAL PAID:</span>
              <span>₦{grandTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[10px] text-stone-600">
              <span>PAYMENT METHOD:</span>
              <span className="font-semibold">POS CARD / TRANSFER</span>
            </div>
          </div>

          {/* Barcode / QR Simulation */}
          {settings.showBarcode !== false && (
            <div className="py-3 text-center space-y-1 border-b border-dashed border-stone-400">
              <div className="h-9 bg-stone-900 mx-auto w-3/4 flex items-center justify-center space-x-0.5 px-2">
                {[...Array(32)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-7 bg-white ${
                      i % 3 === 0 ? 'w-1' : i % 2 === 0 ? 'w-0.5' : 'w-1.5'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[9px] tracking-widest text-stone-600">RCP-2026-9842</p>
            </div>
          )}

          {/* Footer & Return Terms */}
          <div className="pt-3 text-center space-y-1.5 text-[10px] text-stone-700">
            {settings.footerText ? (
              <p className="font-medium">{settings.footerText}</p>
            ) : (
              <p className="font-medium">Thank you for your patronage!</p>
            )}
            {settings.returnPolicy && (
              <p className="text-[9px] text-stone-600 leading-snug italic px-1">
                {settings.returnPolicy}
              </p>
            )}
            <p className="text-[8px] text-stone-400 tracking-wider uppercase pt-1">
              Powered by Orviohub
            </p>
          </div>

          {/* Simulated Jagged Bottom Tear */}
          <div className="absolute -bottom-2 left-0 right-0 h-2 bg-slate-950/80 [mask-image:radial-gradient(circle_at_4px_0,#0000_4px,#000_4.5px)] [mask-size:8px_8px] [mask-repeat:repeat-x]" />
        </div>
      </div>
    </div>
  );
};
