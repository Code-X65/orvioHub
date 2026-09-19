import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  ArrowLeft,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Users,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParsedInviteRow {
  email: string;
  phoneNumber?: string;
  appRole: 'admin' | 'member' | 'viewer';
  branchRole?: 'manager' | 'staff' | 'viewer' | 'accountant';
  branchId?: string;
  jobTitle?: string;
  isValid: boolean;
  error?: string;
}

export const BulkAddTeamMembersPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches } = useBranchStore();

  const [parsedRows, setParsedRows] = useState<ParsedInviteRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultsSummary, setResultsSummary] = useState<{ total: number; successful: number; failed: number } | null>(null);

  const workspaceId = currentWorkspace?.id || '';

  const downloadSampleCsv = () => {
    const defaultBranchId = branches[0]?.id || 'branch_id_here';
    const csvContent =
      'email,phone,appRole,branchRole,branchId,jobTitle\n' +
      `cashier1@example.com,+2348011112222,member,staff,${defaultBranchId},Cashier\n` +
      `manager@example.com,+2348022223333,admin,manager,${defaultBranchId},Store Manager\n` +
      `auditor@example.com,,viewer,viewer,${defaultBranchId},Stock Auditor\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'orviohub_team_invitations_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      toast.error('The uploaded CSV file is empty.');
      return;
    }

    const rows: ParsedInviteRow[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const email = parts[0] || '';
      const phone = parts[1] || '';
      const appRole = (['admin', 'member', 'viewer'].includes(parts[2]) ? parts[2] : 'member') as any;
      const branchRole = (['manager', 'staff', 'viewer', 'accountant'].includes(parts[3]) ? parts[3] : 'staff') as any;
      const branchId = parts[4] || branches[0]?.id || '';
      const jobTitle = parts[5] || '';

      const isValidEmail = emailRegex.test(email);
      rows.push({
        email,
        phoneNumber: phone || undefined,
        appRole,
        branchRole,
        branchId,
        jobTitle: jobTitle || undefined,
        isValid: isValidEmail,
        error: !isValidEmail ? 'Invalid email format' : undefined,
      });
    }

    setParsedRows(rows);
    toast.success(`Parsed ${rows.length} invitation rows.`);
  };

  const handleExecuteBulkInvite = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !workspaceId) {
      toast.error('No valid rows to invite.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.post<{ data: { results: any[]; totalSent: number } }>(
        `/workspaces/${workspaceId}/applications/inventory/members/bulk-invite`,
        {
          invitations: validRows,
        }
      );

      const total = validRows.length;
      const successful = res?.data?.totalSent ?? total;
      const failed = total - successful;

      setResultsSummary({ total, successful, failed });
      toast.success(`Successfully dispatched ${successful} team invitations!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to execute bulk invitations');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/inventory/team/members')}
        className="text-slate-400 hover:text-white -ml-2 text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Back to Team Roster
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Bulk CSV Team Invitations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Invite dozens of staff members and cashiers simultaneously across your retail store network.
          </p>
        </div>

        <Button
          onClick={downloadSampleCsv}
          variant="outline"
          size="sm"
          className="border-white/10 text-slate-300 hover:text-white text-xs h-9"
        >
          <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
          Download Sample CSV Template
        </Button>
      </div>

      {/* Upload Zone */}
      {parsedRows.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#120a11]/90 border-2 border-dashed border-white/15 text-center space-y-4 hover:border-[#714b67]/50 transition">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg">
            <Upload className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Upload your team CSV file</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ensure your CSV file contains columns for <code>email</code>, <code>phone</code>, <code>appRole</code>, <code>branchRole</code>, and <code>branchId</code>.
            </p>
          </div>

          <div className="pt-2">
            <label className="cursor-pointer inline-flex items-center px-4 py-2 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold shadow-md shadow-[#714b67]/20 transition">
              <Upload className="w-3.5 h-3.5 mr-2" />
              Choose File (.csv)
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white">
                {parsedRows.length} Rows Imported
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {parsedRows.filter((r) => r.isValid).length} Valid
              </span>
              {parsedRows.some((r) => !r.isValid) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {parsedRows.filter((r) => !r.isValid).length} Invalid
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParsedRows([])}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear File
              </Button>

              <Button
                onClick={handleExecuteBulkInvite}
                disabled={isProcessing || parsedRows.filter((r) => r.isValid).length === 0}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold h-8 px-4 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Sending Invitations...
                  </>
                ) : (
                  `Send ${parsedRows.filter((r) => r.isValid).length} Invitations`
                )}
              </Button>
            </div>
          </div>

          {/* Table Preview */}
          <div className="rounded-2xl bg-[#120a11] border border-white/10 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-black/60 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">App Role</th>
                  <th className="py-3 px-4">Branch Assignment</th>
                  <th className="py-3 px-4">Job Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {parsedRows.map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400" title={row.error}>
                          <AlertCircle className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-white font-medium">{row.email}</td>
                    <td className="py-3 px-4 uppercase font-bold text-[10px] text-purple-300">{row.appRole}</td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-slate-300">
                        {row.branchRole || 'staff'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{row.jobTitle || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results Summary Modal */}
      {resultsSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Bulk Invitation Complete</h3>
              <p className="text-xs text-slate-400">
                Successfully sent {resultsSummary.successful} invitations out of {resultsSummary.total}.
              </p>
            </div>

            <Button
              onClick={() => navigate('/inventory/team/members')}
              className="w-full bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold h-10 cursor-pointer"
            >
              Go to Team Roster
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
