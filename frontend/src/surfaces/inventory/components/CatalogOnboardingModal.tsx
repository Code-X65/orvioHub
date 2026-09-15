import React, { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Boxes,
  Sparkles,
  Upload,
  FileSpreadsheet,
  Download,
  ArrowRight,
  Store,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CatalogOnboardingModalProps {
  isOpen: boolean;
  orgId?: string;
  orgName: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface ParsedProductRow {
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  description?: string;
}

const SAMPLE_CSV_TEMPLATE = `SKU,Name,Category,CostPrice,SellingPrice,StockQuantity,MinStockLevel,Unit
PRD-001,Peak Milk 400g Tin,Groceries,2800,3400,24,5,tin
PRD-002,Golden Penny Semovita 2kg,Groceries,2200,2700,30,6,bag
PRD-003,Dangote Sugar 1kg,Groceries,1400,1750,50,10,pack
PRD-004,Milo Refill 500g,Groceries,2900,3500,20,5,pack
PRD-005,Indomie Super Pack Carton,Groceries,8500,9800,15,3,carton`;

export const CatalogOnboardingModal: React.FC<CatalogOnboardingModalProps> = ({
  isOpen,
  orgName,
  onComplete,
  onSkip,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'csv' | 'scratch'>('sample');
  const [selectedSector, setSelectedSector] = useState<'retail' | 'groceries' | 'fashion' | 'electronics'>('retail');
  const [isLoading, setIsLoading] = useState(false);

  // CSV States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'orvio-inventory-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV template downloaded!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.name.endsWith('.txt')) {
      toast.error('Please select a valid .csv file.');
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      parseCsvText(text);
    };
    reader.readAsText(file);
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      setParseErrors(['CSV file must have a header row and at least one product row.']);
      setParsedRows([]);
      return;
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows: ParsedProductRow[] = [];
    const errors: string[] = [];

    // Find column indexes
    const skuIdx = header.findIndex((h) => h.includes('sku') || h.includes('code') || h.includes('id'));
    const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('item') || h.includes('product') || h.includes('title'));
    const catIdx = header.findIndex((h) => h.includes('cat') || h.includes('type') || h.includes('dept'));
    const costIdx = header.findIndex((h) => h.includes('cost') || h.includes('buy') || h.includes('purchase'));
    const sellIdx = header.findIndex((h) => h.includes('sell') || h.includes('price') || h.includes('retail'));
    const qtyIdx = header.findIndex((h) => h.includes('qty') || h.includes('stock') || h.includes('quantity') || h.includes('count'));
    const minIdx = header.findIndex((h) => h.includes('min') || h.includes('reorder') || h.includes('alert'));
    const unitIdx = header.findIndex((h) => h.includes('unit') || h.includes('uom'));

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 2) continue;

      const name = nameIdx !== -1 ? parts[nameIdx] : parts[1] || `Item ${i}`;
      const sku = skuIdx !== -1 ? parts[skuIdx] : parts[0] || `SKU-${1000 + i}`;
      const category = catIdx !== -1 ? parts[catIdx] : 'General';
      const costPrice = costIdx !== -1 ? parseFloat(parts[costIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
      const sellingPrice = sellIdx !== -1 ? parseFloat(parts[sellIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
      const stockQuantity = qtyIdx !== -1 ? parseInt(parts[qtyIdx].replace(/[^0-9]/g, ''), 10) || 0 : 0;
      const minStockLevel = minIdx !== -1 ? parseInt(parts[minIdx].replace(/[^0-9]/g, ''), 10) || 5 : 5;
      const unit = unitIdx !== -1 ? parts[unitIdx] : 'pcs';

      if (!name || sellingPrice <= 0) {
        errors.push(`Row ${i + 1}: Name and selling price (> 0) are required.`);
        continue;
      }

      rows.push({
        sku,
        name,
        category: category || 'General',
        costPrice: isNaN(costPrice) ? 0 : costPrice,
        sellingPrice: isNaN(sellingPrice) ? 100 : sellingPrice,
        stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
        minStockLevel: isNaN(minStockLevel) ? 5 : minStockLevel,
        unit: unit || 'pcs',
      });
    }

    setParsedRows(rows);
    setParseErrors(errors.slice(0, 3));
    if (rows.length > 0) {
      toast.success(`Parsed ${rows.length} product${rows.length === 1 ? '' : 's'} successfully.`);
    }
  };

  const handleSeedSamples = async () => {
    setIsLoading(true);
    try {
      await api.post('/inventory/products/seed-samples', {
        sector: selectedSector,
      });
      toast.success(`Seeded sample catalog for ${selectedSector}!`);
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to seed sample products.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportCsv = async () => {
    if (parsedRows.length === 0) {
      toast.error('No valid products to import.');
      return;
    }

    setIsLoading(true);
    try {
      const res: any = await api.post('/inventory/products/import-csv', {
        items: parsedRows,
      });
      toast.success(res?.message || `Imported ${parsedRows.length} products successfully!`);
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import products from CSV.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="max-w-2xl w-full bg-[#120a11] border border-[#714b67]/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100">
        {/* Top Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-white shadow-inner">
              <Boxes className="w-6 h-6 text-[#FDB02F]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
                <Sparkles className="w-3 h-3 text-[#FDB02F]" />
                <span>Product Catalog Setup</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1">
                Populate Your Inventory Catalog
              </h2>
              <p className="text-xs text-slate-400">
                Choose how you would like to initialize products for <strong className="text-slate-200">{orgName}</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onSkip}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('sample')}
            className={cn(
              'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2',
              activeTab === 'sample'
                ? 'bg-[#714b67] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1-Click Sample</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={cn(
              'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2',
              activeTab === 'csv'
                ? 'bg-[#714b67] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scratch')}
            className={cn(
              'py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2',
              activeTab === 'scratch'
                ? 'bg-[#714b67] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Start Empty</span>
          </button>
        </div>

        {/* TAB 1: 1-Click Sample Catalog */}
        {activeTab === 'sample' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <p className="text-xs text-slate-300">
              Select your business industry to seed 8–10 realistic products with barcodes, cost prices, and opening stock:
            </p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'retail', label: 'Supermarket & Retail', icon: '🛒', desc: 'Beverages, toiletries, household items' },
                { id: 'groceries', label: 'Groceries & Foods', icon: '🍞', desc: 'Rice, semo, oil, packaged provisions' },
                { id: 'fashion', label: 'Boutique & Fashion', icon: '👗', desc: 'Apparel, shoes, accessories, fabrics' },
                { id: 'electronics', label: 'Electronics & Phones', icon: '📱', desc: 'Gadgets, chargers, audio, accessories' },
              ].map((sec) => (
                <div
                  key={sec.id}
                  onClick={() => setSelectedSector(sec.id as any)}
                  className={cn(
                    'p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3',
                    selectedSector === sec.id
                      ? 'bg-[#291325] border-[#714b67] shadow-lg ring-1 ring-[#714b67]'
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  )}
                >
                  <span className="text-2xl shrink-0">{sec.icon}</span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">{sec.label}</p>
                    <p className="text-[10px] text-slate-400">{sec.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>• Instant stock tracking & POS test ready</span>
              <span className="text-[#c79dbd] font-semibold">~10 Sample SKUs</span>
            </div>

            <Button
              type="button"
              onClick={handleSeedSamples}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  <span>Seeding Products...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#FDB02F]" />
                  <span>Seed {selectedSector.toUpperCase()} Catalog & Proceed</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* TAB 2: Upload CSV / Excel */}
        {activeTab === 'csv' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">
                Upload your CSV file with your product catalog:
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-[#c79dbd] hover:text-white flex items-center gap-1 font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV Template</span>
              </button>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#714b67] bg-black/40 text-center cursor-pointer transition space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#c79dbd] mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {csvFile ? csvFile.name : 'Click to select or drag & drop CSV file'}
                </p>
                <p className="text-[10px] text-slate-500">Columns: SKU, Name, Category, CostPrice, SellingPrice, StockQuantity</p>
              </div>
            </div>

            {/* Parse Errors */}
            {parseErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Validation Notices</span>
                </div>
                {parseErrors.map((err, idx) => (
                  <p key={idx} className="text-[11px]">• {err}</p>
                ))}
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Parsed Products Preview:</span>
                  <span className="text-emerald-400 font-bold">{parsedRows.length} items ready</span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-black/60 text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10 text-slate-400">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Cost</th>
                        <th className="p-2">Price</th>
                        <th className="p-2">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="text-slate-300">
                          <td className="p-2 font-mono">{row.sku}</td>
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2 text-slate-400">{row.category}</td>
                          <td className="p-2">₦{row.costPrice.toLocaleString()}</td>
                          <td className="p-2 font-bold text-emerald-400">₦{row.sellingPrice.toLocaleString()}</td>
                          <td className="p-2">{row.stockQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleImportCsv}
              disabled={parsedRows.length === 0 || isLoading}
              className="w-full py-3.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  <span>Importing Products...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Import {parsedRows.length} Products & Proceed</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* TAB 3: Start from Scratch */}
        {activeTab === 'scratch' && (
          <div className="space-y-4 animate-in fade-in duration-150 text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mx-auto">
              <Store className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-sm font-bold text-white">Start with Empty Catalog</h3>
              <p className="text-xs text-slate-400">
                You can manually add products one by one, barcode scan items, or import CSV at any time from the Inventory dashboard.
              </p>
            </div>

            <Button
              type="button"
              onClick={onSkip}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Enter Dashboard with Empty Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogOnboardingModal;
