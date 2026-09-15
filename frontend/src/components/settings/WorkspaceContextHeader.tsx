import React from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { cn } from '@/lib/utils';

interface WorkspaceContextHeaderProps {
  className?: string;
}

export const WorkspaceContextHeader: React.FC<WorkspaceContextHeaderProps> = ({ className }) => {
  const { memberships, activeOrganizationId, setActiveOrganizationId } = useAuthStore();
  const { currentWorkspace, selectWorkspace } = useWorkspaceStore();
  const [isOpen, setIsOpen] = React.useState(false);

  const activeMembership =
    memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];

  const orgName = activeMembership?.organization?.name || currentWorkspace?.name || 'My Organization';
  const roleName = activeMembership?.role || 'OWNER';
  const logoUrl = (activeMembership?.organization as any)?.logo || currentWorkspace?.logoUrl;

  const handleSelectOrg = async (orgId: string) => {
    setActiveOrganizationId(orgId);
    await selectWorkspace(orgId);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-all text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-white shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-4 h-4 text-[#e6a8d6]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-white truncate">{orgName}</h3>
            <p className="text-[10px] text-slate-400 capitalize truncate">{roleName.toLowerCase()}</p>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-[#160c15] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
            Switch Organization
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {memberships.map((m) => {
              const isSelected = m.organization.id === activeOrganizationId;
              return (
                <button
                  key={m.organization.id}
                  onClick={() => handleSelectOrg(m.organization.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left',
                    isSelected
                      ? 'bg-[#714b67]/20 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/5'
                  )}
                >
                  <span className="truncate">{m.organization.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#e6a8d6] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
