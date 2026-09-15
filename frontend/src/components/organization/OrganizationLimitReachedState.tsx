import React from 'react';
import { AlertTriangle, Building2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHomeUrl } from '@/lib/domain';

interface OrganizationLimitReachedStateProps {
  currentCount?: number;
  maxCount?: number;
  onViewWorkspaces?: () => void;
  onViewInvitations?: () => void;
}

export const OrganizationLimitReachedState: React.FC<OrganizationLimitReachedStateProps> = ({
  currentCount = 3,
  maxCount = 3,
  onViewWorkspaces,
  onViewInvitations,
}) => {
  return (
    <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-xl bg-[#0e0a0d] border border-amber-500/30 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
        <AlertTriangle className="w-8 h-8" />
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <span>Ownership Quota Reached</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Organization Limit Reached
        </h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          You currently own <strong className="text-white font-semibold">{currentCount} of {maxCount}</strong> allowed organizations. Each user account is limited to creating and owning a maximum of {maxCount} organizations.
        </p>
      </div>

      {/* Note about joining organizations */}
      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-left text-xs space-y-1.5">
        <p className="font-semibold text-white flex items-center gap-1.5">
          <span>💡 You can still collaborate on other teams</span>
        </p>
        <p className="text-slate-400 leading-relaxed">
          This limit only applies to organizations you create and own. You can still join and participate in an unlimited number of organizations owned by others by accepting invitations.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          type="button"
          onClick={() => {
            if (onViewWorkspaces) {
              onViewWorkspaces();
            } else {
              window.location.href = getHomeUrl();
            }
          }}
          className="w-full sm:w-auto bg-[#714b67] hover:bg-[#85597a] text-white flex items-center justify-center gap-2 text-xs font-semibold px-5 py-2.5"
        >
          <Building2 className="w-4 h-4" />
          <span>Switch to an Existing Organization</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (onViewInvitations) {
              onViewInvitations();
            } else {
              window.location.href = '/invitations';
            }
          }}
          className="w-full sm:w-auto border-white/10 text-slate-300 hover:text-white hover:bg-white/5 flex items-center justify-center gap-2 text-xs px-5 py-2.5"
        >
          <Mail className="w-4 h-4" />
          <span>Check Invitations</span>
        </Button>
      </div>
    </div>
  );
};
