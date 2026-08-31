import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ExternalLink,
  Clock,
  Layers,
  Loader2,
  Plus,
} from 'lucide-react';

interface WorkspaceItem {
  id: string;
  workspaceId: string;
  role: string;
  status: string;
  joinedAt: number;
  workspace?: {
    _id: string;
    name: string;
    slug: string;
    type?: string;
    currency?: string;
    ownerId?: string;
    logoUrl?: string;
    enabledModules?: string[];
  };
}

export const WorkspacesSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ workspaces: WorkspaceItem[] }>('/users/me/workspaces');
      setWorkspaces(res.workspaces || []);
    } catch {
      toast.error('Failed to load organizations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleLeaveWorkspace = async (ws: WorkspaceItem) => {
    const wsId = ws.workspaceId || ws.workspace?._id;
    if (!wsId) return;
    const isOwner = ws.role === 'OWNER' || ws.workspace?.ownerId === user?.id;

    if (isOwner) {
      toast.error(
        'As the sole organization owner, you cannot leave directly. Please transfer ownership to another admin or close the organization in settings.'
      );
      return;
    }

    if (!confirm(`Are you sure you want to leave organization "${ws.workspace?.name || 'this organization'}"?`)) {
      return;
    }

    setLeavingId(wsId);
    try {
      await api.post(`/users/me/workspaces/${wsId}/leave`, {});
      toast.success(`You have left ${ws.workspace?.name || 'the organization'}.`);
      fetchWorkspaces();
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave organization.');
    } finally {
      setLeavingId(null);
    }
  };

  return (
    <ProfileLayout
      title="Organization Memberships"
      description="View organizations and stores you belong to, your assigned organization roles, and access products."
      activeSection="workspaces"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xs bg-white/5 border border-white/10">
          <div>
            <h4 className="text-sm font-semibold text-white">Central Membership Overview</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Your personal account can belong to multiple organizations with different roles.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('/app/organizations/new')}
            className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs shrink-0 flex items-center gap-1.5 cursor-pointer rounded-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Organization
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading organization memberships...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {workspaces.map((ws) => {
              const wsData = ws.workspace;
              const isOwner = ws.role === 'OWNER' || wsData?.ownerId === user?.id;
              const wsId = ws.workspaceId || wsData?._id;

              return (
                <div
                  key={ws.id || ws.workspaceId}
                  className="p-5 rounded-xs bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xs bg-gradient-to-br from-[#714b67] to-indigo-800 flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {wsData?.name?.[0]?.toUpperCase() || 'O'}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h4 className="text-base font-bold text-white tracking-tight">
                          {wsData?.name || 'Organization'}
                        </h4>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-xs uppercase font-medium ${
                            isOwner
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {ws.role || 'MEMBER'}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-white/10 text-slate-300 capitalize">
                          {wsData?.type || 'Business'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400">
                        <span className="font-mono text-slate-300">
                          {wsData?.slug || 'org'}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Joined {new Date(ws.joinedAt || Date.now()).toLocaleDateString()}
                        </span>

                        {wsData?.enabledModules && wsData.enabledModules.length > 0 && (
                          <span className="flex items-center gap-1 text-[#c79dbd]">
                            <Layers className="w-3.5 h-3.5" />
                            {wsData.enabledModules.length} Active App{wsData.enabledModules.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                    <Button
                      size="sm"
                      onClick={() => navigate('/app')}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 cursor-pointer rounded-xs"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>

                    {!isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={leavingId === wsId}
                        onClick={() => handleLeaveWorkspace(ws)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs cursor-pointer rounded-xs"
                      >
                        {leavingId === wsId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Leave'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {workspaces.length === 0 && (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xs space-y-3">
                <p className="text-slate-400 text-sm">You are not a member of any organization yet.</p>
                <Button
                  size="sm"
                  onClick={() => navigate('/app/organizations/new')}
                  className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs cursor-pointer rounded-xs"
                >
                  Create an Organization
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ProfileLayout>
  );
};
