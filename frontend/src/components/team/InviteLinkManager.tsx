import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Users,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ShareableLinkData {
  id?: string;
  token: string;
  inviteUrl: string;
  role: string;
  createdAt: number;
  expiresAt?: number;
  usageCount: number;
  status: 'active' | 'expired' | 'revoked';
}

export interface InviteLinkManagerProps {
  organizationId?: string;
  defaultRole?: string;
  onLinkGenerated?: (inviteUrl: string) => void;
  className?: string;
}

const EXPIRY_OPTIONS: SelectOption[] = [
  { value: '7', label: 'Expires in 7 days', badge: 'Standard' },
  { value: '30', label: 'Expires in 30 days', badge: 'Extended' },
  { value: '0', label: 'Never expires', badge: 'Permanent' },
];

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'MEMBER', label: 'Member', badge: 'Standard' },
  { value: 'SALES_ATTENDANT', label: 'Sales Attendant', badge: 'POS' },
  { value: 'STOCK_MANAGER', label: 'Stock Keeper', badge: 'Inventory' },
  { value: 'MANAGER', label: 'Manager', badge: 'Lead' },
  { value: 'ADMIN', label: 'Admin', badge: 'Full Access' },
];

export const InviteLinkManager: React.FC<InviteLinkManagerProps> = ({
  organizationId,
  defaultRole = 'MEMBER',
  onLinkGenerated,
  className,
}) => {
  const [linkData, setLinkData] = useState<ShareableLinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>('7');
  const [selectedRole, setSelectedRole] = useState<string>(defaultRole);

  const endpoint = organizationId
    ? `/organizations/${organizationId}/share-link`
    : '/onboarding/share-link';

  const fetchActiveLink = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get(endpoint);
      if (res.data) {
        setLinkData(res.data);
        if (onLinkGenerated && res.data.inviteUrl) {
          onLinkGenerated(res.data.inviteUrl);
        }
      } else {
        setLinkData(null);
      }
    } catch {
      // If none exists or endpoint returns 404/empty, linkData stays null
      setLinkData(null);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, onLinkGenerated]);

  useEffect(() => {
    fetchActiveLink();
  }, [fetchActiveLink]);

  const handleGenerateOrRegenerate = async (isRegenerate: boolean = false) => {
    setIsGenerating(true);
    try {
      const res: any = await api.post(endpoint, {
        role: selectedRole,
        expiresInDays: Number(expiryDays),
        regenerate: isRegenerate,
      });

      const newLink: ShareableLinkData = res.data;
      setLinkData(newLink);
      if (onLinkGenerated && newLink.inviteUrl) {
        onLinkGenerated(newLink.inviteUrl);
      }

      toast.success(
        isRegenerate
          ? 'Invite link regenerated. Old link has been invalidated.'
          : 'Shareable invite link generated!'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate invite link.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke this invite link? Anyone with this link will no longer be able to join.')) {
      return;
    }

    setIsRevoking(true);
    try {
      await api.delete(endpoint);
      setLinkData((prev) => (prev ? { ...prev, status: 'revoked' } : null));
      toast.success('Shareable invite link revoked.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke invite link.');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!linkData?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(linkData.inviteUrl);
      setCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status?: string, expiresAt?: number) => {
    const isExpired = expiresAt && expiresAt < Date.now();
    if (status === 'revoked') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25">
          <AlertCircle className="w-2.5 h-2.5" />
          Revoked
        </span>
      );
    }
    if (isExpired || status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
          <Clock className="w-2.5 h-2.5" />
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Active
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-2xl bg-[#160f14] border border-white/10 flex items-center justify-center py-8', className)}>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Spinner size="sm" />
          <span>Loading invite link settings...</span>
        </div>
      </div>
    );
  }

  // State A: No Link Generated Yet or Revoked
  if (!linkData || linkData.status === 'revoked') {
    return (
      <div
        className={cn(
          'p-5 rounded-2xl bg-[#160f14] border border-white/10 space-y-4 shadow-inner relative overflow-hidden',
          className
        )}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#d4a8c9]" />
              <h3 className="text-xs font-semibold text-white">Shareable Team Invite Link</h3>
              {linkData?.status === 'revoked' && getStatusBadge('revoked')}
            </div>
            <p className="text-[11px] text-slate-400 max-w-lg">
              Generate an open link that allows colleagues to join your organization without individual email invitations.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => handleGenerateOrRegenerate(false)}
            disabled={isGenerating}
            className="w-full sm:w-auto h-9 text-xs font-semibold bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {isGenerating ? <Spinner size="sm" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>{linkData?.status === 'revoked' ? 'Generate New Link' : 'Generate Invite Link'}</span>
          </Button>
        </div>

        {/* Configuration Row for initial creation */}
        <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Link Expiration
            </label>
            <CustomSelect
              options={EXPIRY_OPTIONS}
              value={expiryDays}
              onChange={setExpiryDays}
              placeholder="Select expiry"
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Assigned Role upon Joining
            </label>
            <CustomSelect
              options={ROLE_OPTIONS}
              value={selectedRole}
              onChange={setSelectedRole}
              placeholder="Select role"
              className="text-xs"
            />
          </div>
        </div>
      </div>
    );
  }

  // State B: Active Link Dashboard
  const isExpired = linkData.expiresAt ? linkData.expiresAt < Date.now() : false;

  return (
    <div
      className={cn(
        'p-5 rounded-2xl bg-[#160f14] border border-white/10 space-y-4 shadow-xl relative overflow-hidden',
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#e2b9d8]">
            <Link2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white">Active Shareable Invite Link</h3>
              {getStatusBadge(linkData.status, linkData.expiresAt)}
            </div>
            <p className="text-[11px] text-slate-400">
              Teammates with this link automatically join as{' '}
              <span className="text-slate-200 font-medium">{linkData.role || 'Member'}</span>
            </p>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
            <Users className="w-3 h-3 text-[#d4a8c9]" />
            <span className="font-semibold text-white">{linkData.usageCount || 0}</span>
            <span className="text-slate-400">joined</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">Expires:</span>
            <span className="font-medium text-slate-200">{formatDate(linkData.expiresAt)}</span>
          </span>
        </div>
      </div>

      {/* URL Display & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 font-mono text-xs text-slate-300 overflow-hidden shadow-inner">
          <span className="truncate select-all flex-1">{linkData.inviteUrl}</span>
        </div>

        <Button
          type="button"
          onClick={handleCopy}
          className={cn(
            'h-9 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0',
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </Button>
      </div>

      {/* Bottom Management Controls (Set Expiry, Regenerate, Revoke) */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <CustomSelect
              options={EXPIRY_OPTIONS}
              value={expiryDays}
              onChange={setExpiryDays}
              placeholder="Expiry duration"
              className="text-xs h-8"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleGenerateOrRegenerate(true)}
            disabled={isGenerating || isRevoking}
            className="h-8 text-xs font-medium border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {isGenerating ? <Spinner size="sm" /> : <RefreshCw className="w-3 h-3 text-[#d4a8c9]" />}
            <span>Regenerate</span>
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRevoke}
          disabled={isRevoking || isGenerating}
          className="h-8 text-xs font-medium border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          {isRevoking ? <Spinner size="sm" /> : <Trash2 className="w-3 h-3 text-rose-400" />}
          <span>Revoke Link</span>
        </Button>
      </div>
    </div>
  );
};
