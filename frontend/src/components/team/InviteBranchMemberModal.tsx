import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Loader2,
  Info,
  X,
} from 'lucide-react';

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
  city?: string;
}

interface InviteBranchMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  branches: BranchOption[];
  onSuccess: () => void;
}

const ROLES_INFO: Record<
  string,
  {
    title: string;
    description: string;
    allowed: string[];
    disallowed: string[];
  }
> = {
  cashier: {
    title: 'Cashier / Sales Attendant',
    description: 'Frontline sales counter access to ring up products, process payments, and print receipts.',
    allowed: ['Record counter sales', 'View selling prices', 'Issue thermal receipts', 'View own register sales'],
    disallowed: ['No stock adjustments', 'No cost-price visibility', 'No product editing or deletion', 'No member management'],
  },
  stock_manager: {
    title: 'Stock Manager',
    description: 'Warehouse & storeroom management for receiving shipments, counting inventory, and adjustments.',
    allowed: ['Record stock adjustments', 'Conduct physical stock counts', 'Receive purchase orders', 'View stock history'],
    disallowed: ['No sales processing', 'No cash drawer access', 'No branch deletion', 'No member management'],
  },
  inventory_manager: {
    title: 'Inventory Manager',
    description: 'Full store operations control across catalog, stock, staff scheduling, and branch telemetry.',
    allowed: ['Full product catalog management', 'Stock adjustments & PO receiving', 'Record & refund sales', 'Manage branch team staff'],
    disallowed: ['Cannot delete branch', 'Cannot change workspace plan'],
  },
  accountant: {
    title: 'Store Accountant',
    description: 'Financial ledger & analytics access to review sales reports, margins, supplier payouts, and reconciliations.',
    allowed: ['View sales & purchase ledgers', 'Export Excel/PDF reports', 'View profit & loss telemetry', 'Audit tax receipts'],
    disallowed: ['Cannot ring up sales', 'Cannot edit products', 'Cannot adjust stock'],
  },
  inventory_owner: {
    title: 'Inventory Owner',
    description: 'Complete unrestricted control of all branches, staff privileges, settings, and business telemetry.',
    allowed: ['Unrestricted access to all branches', 'Invite & transfer staff', 'Full financial margins & profits', 'Branch creation & deletion'],
    disallowed: [],
  },
  inventory_viewer: {
    title: 'Inventory Viewer',
    description: 'Read-only observer role for auditing stock levels and viewing real-time reports.',
    allowed: ['View catalog products', 'View stock levels', 'View analytics summaries'],
    disallowed: ['Cannot edit data', 'Cannot ring up sales', 'Cannot adjust stock'],
  },
};

export const InviteBranchMemberModal: React.FC<InviteBranchMemberModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  branches,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [role, setRole] = useState<string>('cashier');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);

  useEffect(() => {
    if (branches.length > 0 && !branchId) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  // Live user lookup when typing email
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
      setFoundUser(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.get<{ user: { id: string; name: string; avatar?: string } | null }>(
          `/users/search?email=${encodeURIComponent(trimmed)}`
        );
        const userObj = res?.user || (res as any)?.data?.user || null;
        setFoundUser(userObj);
      } catch {
        setFoundUser(null);
      } finally {

        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !branchId || !role) {
      toast.error('Please enter email, branch, and role.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/invitations`, {
        email: email.trim(),
        role,
        branchId,
        message: message.trim() || undefined,
      });

      toast.success(`Invitation sent to ${email.trim()}!`);
      setEmail('');
      setMessage('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRoleInfo = ROLES_INFO[role] || ROLES_INFO.cashier;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl bg-slate-900 border border-slate-800 text-white max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Invite Branch Staff</h3>
              <p className="text-xs text-slate-400">
                Invite a staff member directly into a specific store branch with assigned operational permissions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-xs font-semibold text-slate-300">
              Staff Email Address
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="cashier@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin absolute right-3 top-3" />
              )}
            </div>

            {/* Found user profile preview */}
            {foundUser && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-xs">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center uppercase">
                  {foundUser.name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-emerald-300 truncate">{foundUser.name}</p>
                  <p className="text-[11px] text-emerald-400/80">Existing Orviohub Account</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            )}
            {!foundUser && email.includes('@') && !isSearching && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                Invitee will be prompted to create an Orviohub account when accepting.
              </p>
            )}
          </div>

          {/* Branch selector */}
          <div className="space-y-2">
            <Label htmlFor="invite-branch" className="text-xs font-semibold text-slate-300">
              Assign to Branch
            </Label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <select
                id="invite-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name} {b.city ? `(${b.city})` : ''} {b.code ? `• ${b.code}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <Label htmlFor="invite-role" className="text-xs font-semibold text-slate-300">
              Inventory Role
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLES_INFO).map(([key, info]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setRole(key)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    role === key
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <p className="font-semibold text-xs flex items-center justify-between">
                    <span>{info.title}</span>
                    {role === key && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Permission preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold border-b border-slate-800/80 pb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Permission Capabilities: {currentRoleInfo.title}</span>
            </div>
            <p className="text-slate-400 text-[11px]">{currentRoleInfo.description}</p>

            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Permitted:</span>
              <ul className="space-y-1">
                {currentRoleInfo.allowed.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {currentRoleInfo.disallowed.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-slate-800/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Restricted:</span>
                <ul className="space-y-1">
                  {currentRoleInfo.disallowed.map((item, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="invite-msg" className="text-xs font-semibold text-slate-300">
              Personal Invitation Note (Optional)
            </Label>
            <Input
              id="invite-msg"
              placeholder="e.g. Welcome to the Victoria Island branch team!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !email}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Send Branch Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
