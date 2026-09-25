import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Building2, XCircle, Store, ShieldCheck, Phone } from 'lucide-react';
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
  type?: 'workspace' | 'organization' | 'team';
  email: string;
  phone?: string;
  role: string;
  organizationRole?: string;
  branchRole?: string;
  branchName?: string;
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
  isExpired?: boolean;
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
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  // Track whether this is a team invitation (uses different endpoint)
  const [isTeamInvite, setIsTeamInvite] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      // First try the org-level invitation endpoint
      const response = await api.get<{ invitation: InvitationDetails }>(`/invitations/${token}`);
      setDetails(response.invitation);
      setFetchState('SUCCESS');
    } catch (error: any) {
      // If 404/not found, try the team-level invitation endpoint
      if (error?.status === 404 || error?.response?.status === 404 || error?.code === 'INVITATION_NOT_FOUND') {
        try {
          const teamRes = await api.get<{ data: { invitation: InvitationDetails } }>(`/team-invitations/${token}`);
          const teamInv = teamRes?.data?.invitation || (teamRes as any)?.invitation;
          if (teamInv) {
            setDetails({
              ...teamInv,
              type: 'team',
              role: teamInv.branchRole || teamInv.role || 'staff',
              organizationRole: teamInv.branchRole || teamInv.role || 'staff',
            });
            setIsTeamInvite(true);
            setFetchState('SUCCESS');
            return;
          }
        } catch (teamErr: any) {
          setFetchState('ERROR');
          setErrorMessage(teamErr.message || 'This invitation link is invalid or has expired.');
          return;
        }
      }
      setFetchState('ERROR');
      setErrorMessage(error.message || 'Unable to load invitation details');
    }
  };

  const handleAccept = async () => {
    if (user?.email && details?.email && user.email.toLowerCase() !== details.email.toLowerCase()) {
      toast.error(`This invitation is for ${details.email}. You are signed in as ${user.email}.`);
      return;
    }

    setIsAccepting(true);
    try {
      if (isTeamInvite) {
        // Team invitation: use the team-specific accept endpoint
        await api.patch(`/team-invitations/${token}/accept`, {});
        toast.success('Invitation accepted! Welcome to the team.');
        await refreshSession();
        if (details?.workspaceId) {
          await selectWorkspace(details.workspaceId, 'inventory');
        }
        navigate('/inventory/dashboard');
        return;
      }

      // Org-level invitation flow
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
      if (error.code === 'PLAN_MEMBER_LIMIT_REACHED' || error.message?.includes('PLAN_MEMBER_LIMIT_REACHED') || error.message?.includes('seat limit reached') || error.message?.includes('Plan limit reached')) {
        setCapacityError(error.message?.replace('PLAN_MEMBER_LIMIT_REACHED:', '').trim() || 'This team has reached its member limit for their current plan. Please contact the administrator who invited you to upgrade.');
        toast.error('Workspace seat limit reached.');
      } else if (error.code === 'EMAIL_MISMATCH' || error.code === 'INVITATION_EMAIL_MISMATCH' || error.message?.includes('EMAIL_MISMATCH') || error.message?.includes('signed in as')) {
        toast.error(error.message || 'Email mismatch: please sign in with the invited email address.');
      } else {
        toast.error(error.message || 'Failed to accept invitation');
      }
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
      if (isTeamInvite) {
        await api.post(`/team-invitations/${token}/decline`, {});
      } else {
        await api.post(`/invitations/${token}/decline`);
      }
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
        <div className="space-y-4 py-4 animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-white/10 mx-auto" />
          <div className="w-48 h-6 rounded-xs bg-white/10 mx-auto" />
          <div className="w-64 h-4 rounded-xs bg-white/5 mx-auto" />
          <div className="h-28 rounded-xl bg-white/[0.03] border border-white/5" />
          <div className="h-10 rounded-xl bg-white/10" />
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

          {details.phone && (
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
              <span className="text-slate-400">Invited Contact Phone</span>
              <span className="text-slate-200 font-mono text-xs flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {details.phone}
              </span>
            </div>
          )}

          {isAuthenticated && user && (
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
              <span className="text-slate-400">Your Phone Status</span>
              {user.phoneVerified || user.phoneStatus === 'verified' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Unverified (Recommended)
                </span>
              )}
            </div>
          )}

          {/* Team invite: show branch role & location. Org invite: show org role */}
          {details.type === 'team' ? (
            <>
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
                <span className="text-slate-400">Branch Role</span>
                <span className="text-emerald-400 font-semibold uppercase font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {details.branchRole || details.role}
                </span>
              </div>
              {details.branchName && (
                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2.5">
                  <span className="text-slate-400">Branch Location</span>
                  <span className="text-white font-medium flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-400" />
                    {details.branchName}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Application</span>
                <span className="text-[#e296cb] font-semibold text-xs">Inventory</span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
            {capacityError && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left text-xs text-amber-300 space-y-1">
                <p className="font-bold text-amber-200">Team Seat Limit Reached</p>
                <p>{capacityError}</p>
              </div>
            )}
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
