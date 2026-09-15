import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Building2, XCircle, Store } from 'lucide-react';
import { toast } from 'sonner';

interface AppAccessItem {
  productKey: string;
  productName: string;
  appRole: string;
  branchIds: string[];
  branches?: Array<{
    id: string;
    name: string;
    code?: string;
    city?: string;
    state?: string;
  }>;
}

interface InvitationDetails {
  id: string;
  type?: 'workspace' | 'organization';
  email: string;
  role: string;
  organizationRole?: string;
  appAccess?: AppAccessItem[];
  productKey?: string;
  branchIds?: string[];
  workspaceId?: string;
  workspaceName?: string;
  workspaceLogoUrl?: string;
  organization?: {
    id: string;
    name: string;
  };
  inviterName?: string;
  inviter?: {
    name: string;
  };
  expiresAt: number;
}

export const AcceptInvite: React.FC = () => {
  const { token: pathToken } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const token = pathToken || searchParams.get('token') || '';
  const navigate = useNavigate();

  const { isAuthenticated, user, refreshSession } = useAuthStore();
  const { selectWorkspace } = useWorkspaceStore();

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [fetchState, setFetchState] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const [errorMessage, setErrorMessage] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const response = await api.get<{ invitation: InvitationDetails }>(`/invitations/${token}`);
      setDetails(response.invitation);
      setFetchState('SUCCESS');
    } catch (error: any) {
      setFetchState('ERROR');
      setErrorMessage(error.message || 'Unable to load invitation details');
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await api.post<{
        type?: string;
        workspace?: { id: string; name: string };
        organization?: { id: string; name: string };
        productKey?: string;
      }>(`/invitations/${token}/accept`);

      toast.success('Invitation accepted! Welcome to the team.');
      await refreshSession();

      if (res.workspace?.id) {
        await selectWorkspace(res.workspace.id, res.productKey);
        if (res.productKey === 'taskmanagement') {
          navigate('/tasks');
        } else {
          navigate('/inventory/dashboard');
        }
      } else {
        navigate('/inventory/dashboard');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invitation');
      if (error.code === 'UNAUTHENTICATED') {
        navigate(`/login?returnTo=${encodeURIComponent(`/invitations/${token}`)}`);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await api.post(`/invitations/${token}/decline`);
      toast.info('Invitation declined');
      navigate('/inventory/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline');
    } finally {
      setIsDeclining(false);
    }
  };

  if (fetchState === 'LOADING') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Spinner size="lg" />
          <p className="text-slate-400">Loading invitation...</p>
        </div>
      </AuthLayout>
    );
  }

  if (fetchState === 'ERROR') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center space-y-4 py-8">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-white">Invalid Invitation</h2>
          <p className="text-slate-400 mb-6">{errorMessage}</p>
          <Button
            variant="outline"
            onClick={() => {
              navigate('/login');
            }}
            className="w-full"
          >
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!details) return null;

  const displayName = details.workspaceName || details.organization?.name || 'Workspace';
  const inviterName = details.inviterName || details.inviter?.name || 'A teammate';

  return (
    <AuthLayout>
      <div className="space-y-8 py-4 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-surface border border-white/10 flex items-center justify-center shadow-xl">
          <Building2 className="w-10 h-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-white">You've been invited</h2>
          <p className="text-slate-400">
            <strong className="text-white">{inviterName}</strong> invited you to join <br />
            <strong className="text-white text-lg">{displayName}</strong>
          </p>
        </div>

        <div className="bg-surface/50 border border-white/5 rounded-xl p-5 text-left space-y-3.5">
          <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
            <span className="text-slate-400">Invited Email</span>
            <span className="text-slate-200 font-medium">{details.email}</span>
          </div>

          <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
            <span className="text-slate-400">Organization Role</span>
            <span className="text-indigo-400 font-semibold uppercase font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              {details.organizationRole || details.role}
            </span>
          </div>

          {details.appAccess && details.appAccess.length > 0 ? (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                Application Access & Branches
              </span>
              <div className="space-y-2">
                {details.appAccess.map((app) => (
                  <div
                    key={app.productKey}
                    className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-emerald-400" />
                        {app.productName || app.productKey}
                      </span>
                      <span className="text-[11px] font-mono uppercase font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {app.appRole.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {app.branches && app.branches.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="text-slate-500 mr-1">Branches:</span>
                          {app.branches.map((b) => (
                            <span
                              key={b.id}
                              className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[10px]"
                            >
                              {b.name} {b.city ? `(${b.city})` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Organization-wide access</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : details.productKey ? (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Product Access</span>
              <span className="text-emerald-400 font-medium capitalize flex items-center gap-1">
                <Store className="w-3.5 h-3.5" />
                {details.productKey}
              </span>
            </div>
          ) : null}
        </div>

        {!isAuthenticated ? (
          <div className="space-y-4 pt-4">
            <p className="text-sm text-amber-400/90 bg-amber-400/10 p-3 rounded-lg border border-amber-400/20">
              You must sign in with <strong>{details.email}</strong> to accept this invitation.
            </p>
            <Button
              onClick={() => {
                navigate(`/login?returnTo=${encodeURIComponent(`/invitations/${token}`)}`);
              }}
              className="w-full cursor-pointer"
            >
              Sign In to Accept
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigate(`/signup?returnTo=${encodeURIComponent(`/invitations/${token}`)}`);
              }}
              className="w-full cursor-pointer"
            >
              Create an Account
            </Button>
          </div>
        ) : user?.email?.toLowerCase() !== details.email?.toLowerCase() ? (
          <div className="space-y-4 pt-4">
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              You are signed in as <strong>{user?.email}</strong>, but this invitation is for <strong>{details.email}</strong>.
            </p>
            <Button
              variant="outline"
              onClick={() => useAuthStore.getState().logout()}
              className="w-full cursor-pointer"
            >
              Sign out and switch accounts
            </Button>
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            <Button
              onClick={handleAccept}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-11 cursor-pointer"
              disabled={isAccepting}
            >
              {isAccepting ? <Spinner size="sm" className="mr-2 text-white" /> : null}
              {isAccepting ? 'Accepting...' : 'Accept Invitation'}
            </Button>
            <Button
              variant="ghost"
              onClick={handleDecline}
              disabled={isDeclining}
              className="w-full text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              {isDeclining ? 'Declining...' : 'Decline Invitation'}
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
