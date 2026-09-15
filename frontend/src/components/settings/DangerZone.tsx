import React, { useState } from 'react';
import { Trash2, Archive, Download, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from './ConfirmationModal';
import { toast } from 'sonner';

interface DangerZoneProps {
  organizationName: string;
  onArchive?: (reason?: string) => Promise<void>;
  onDeleteRequest?: (reason?: string) => Promise<void>;
  onExportData?: () => Promise<void>;
  isOwner?: boolean;
}

export const DangerZone: React.FC<DangerZoneProps> = ({
  organizationName,
  onArchive,
  onDeleteRequest,
  onExportData,
  isOwner = false,
}) => {
  const [modalMode, setModalMode] = useState<'archive' | 'delete' | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!onExportData) return;
    setIsExporting(true);
    try {
      await onExportData();
      toast.success('Data export generated and downloaded.');
    } catch (err: any) {
      toast.error('Failed to export data: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-rose-500/20 text-rose-400">
        <AlertOctagon className="w-5 h-5" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">
            Danger Zone & Data Retention
          </h3>
          <p className="text-[11px] text-slate-400">
            Irreversible and high-impact administrative actions for this organization.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Export Data */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/10 bg-black/40 gap-4">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Export Organization Data
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Download a complete archive of members, catalog products, invoices, and settings as JSON.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="text-xs shrink-0 border-white/10 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/30"
          >
            {isExporting ? 'Generating...' : 'Export Data'}
          </Button>
        </div>

        {/* Archive Organization */}
        {isOwner && onArchive && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-4">
            <div>
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-400" />
                Archive Organization
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Disable daily operations while preserving all historical records, receipts, and audit logs.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalMode('archive')}
              className="text-xs shrink-0 border-amber-500/30 text-amber-300 hover:bg-amber-500/15"
            >
              Archive Organization
            </Button>
          </div>
        )}

        {/* Delete / Deletion Request */}
        {isOwner && onDeleteRequest && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 gap-4">
            <div>
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Request Permanent Deletion
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Permanently schedule deletion of all workspace resources and product data.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setModalMode('delete')}
              className="text-xs shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50"
            >
              Request Deletion
            </Button>
          </div>
        )}
      </div>

      {/* Archive Modal */}
      <ConfirmationModal
        isOpen={modalMode === 'archive'}
        onClose={() => setModalMode(null)}
        title="Archive Organization"
        description={`Archiving "${organizationName}" will put all applications in read-only mode.`}
        confirmationPhrase={`archive ${organizationName.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
        requireReason
        confirmButtonText="Archive Workspace"
        onConfirm={async (reason) => {
          if (onArchive) await onArchive(reason);
        }}
      />

      {/* Deletion Request Modal */}
      <ConfirmationModal
        isOpen={modalMode === 'delete'}
        onClose={() => setModalMode(null)}
        title="Request Permanent Deletion"
        description={`This will initiate the 30-day grace period for permanent deletion of "${organizationName}".`}
        confirmationPhrase={`delete ${organizationName.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
        requireReason
        isDangerous
        confirmButtonText="Schedule Permanent Deletion"
        onConfirm={async (reason) => {
          if (onDeleteRequest) await onDeleteRequest(reason);
        }}
      />
    </div>
  );
};
