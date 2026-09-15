import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { toast } from 'sonner';
import {
  MapPin,
  Plus,
  CheckCircle2,
  Store,
  Phone,
  AlertCircle,
  Sparkles,
  Crown,
  ArrowRight,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHomeUrl } from '@/lib/domain';

interface Branch {
  _id: string;
  name: string;
  code?: string;
  isPrimary: boolean;
  status: string;
  address?: string;
  formattedAddress?: string;
  phone?: string;
  city?: string;
  state?: string;
}

interface OrgInfo {
  id: string;
  name: string;
  planKey: string;
}

export const BranchSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ orgId: string; appKey: string }>();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspaceStore();
  const { states, fetchStates } = useLocationStore();

  const orgId =
    params.orgId || searchParams.get('orgId') || currentWorkspace?.organizationId || currentWorkspace?.id;
  const appKey = params.appKey || searchParams.get('app') || 'inventory';

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [branchName, setBranchName] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchStreet, setBranchStreet] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchState, setBranchState] = useState('Lagos');

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  const stateOptions: SelectOption[] = states.length > 0
    ? states.map((s) => ({ value: s.name, label: s.name }))
    : [
        { value: 'Lagos', label: 'Lagos' },
        { value: 'Abuja (FCT)', label: 'Abuja (FCT)' },
        { value: 'Rivers', label: 'Rivers' },
        { value: 'Oyo', label: 'Oyo' },
        { value: 'Kano', label: 'Kano' },
        { value: 'Delta', label: 'Delta' },
        { value: 'Anambra', label: 'Anambra' },
        { value: 'Enugu', label: 'Enugu' },
      ];

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [orgRes, subRes, branchesRes] = await Promise.all([
        api.get<any>(`/organizations/${orgId}`).catch(() => null),
        api.get<any>(`/organizations/${orgId}/subscription`).catch(() => null),
        api.get<any>(`/organizations/${orgId}/branches`).catch(() => ({ branches: [] })),
      ]);

      const orgData = orgRes?.organization || orgRes;
      const planKey = subRes?.subscription?.planKey || subRes?.planKey || 'free_trial';

      setOrg({
        id: orgId,
        name: orgData?.name || 'Your Organization',
        planKey,
      });

      const rawBranches: Branch[] = Array.isArray(branchesRes)
        ? branchesRes
        : Array.isArray(branchesRes?.branches)
        ? branchesRes.branches
        : Array.isArray(branchesRes?.data?.branches)
        ? branchesRes.data.branches
        : [];

      setBranches(rawBranches.filter((b) => b.status !== 'deleted' && b.status !== 'archived'));
    } catch (err) {
      toast.error('Failed to load branch data.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isFreeTrialPlan = org?.planKey === 'free_trial' || org?.planKey === 'free';
  const maxBranches = isFreeTrialPlan ? 1 : Infinity;
  const atLimit = isFreeTrialPlan && branches.length >= maxBranches;

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    if (!branchName.trim()) {
      toast.error('Please enter a branch name.');
      return;
    }
    if (atLimit) {
      toast.error('Free Trial allows only 1 branch per app. Upgrade to Standard for more branches.');
      return;
    }

    setSubmitting(true);
    try {
      const address = [branchStreet.trim(), branchCity.trim(), branchState, 'Nigeria']
        .filter(Boolean)
        .join(', ');

      await api.post(`/organizations/${org.id}/branches`, {
        name: branchName.trim(),
        phone: branchPhone.trim() || undefined,
        street: branchStreet.trim() || undefined,
        city: branchCity.trim() || undefined,
        state: branchState || undefined,
        country: 'Nigeria',
        address: address || undefined,
        isPrimary: branches.length === 0,
      });

      toast.success(`Branch "${branchName}" created successfully!`);
      setBranchName('');
      setBranchPhone('');
      setBranchStreet('');
      setBranchCity('');
      setBranchState('Lagos');
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Failed to create branch.';
      if (msg.includes('Free Trial') || err?.code === 'BRANCH_LIMIT_REACHED') {
        toast.error('Free Trial allows only 1 branch per app. Upgrade to add more.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-400">
        <p>Organization not found. Please select an organization first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 selection:bg-indigo-600/40">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-300">{org?.name}</span>
            <span className="text-slate-600 text-xs">/ {appKey}</span>
          </div>
          <button
            onClick={() => (window.location.href = getHomeUrl())}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Dashboard →
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold">
            <MapPin className="w-3 h-3" />
            Branch Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Set Up Your Branches
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Branches are physical or virtual locations where your{' '}
            <span className="text-indigo-300 font-medium capitalize">{appKey}</span> application
            operates. Staff are assigned to branches.
          </p>
        </div>

        {/* Plan notice */}
        {isFreeTrialPlan && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-amber-300">Free Trial:</span>{' '}
              <span className="text-slate-400">
                1 branch per application.{' '}
                <a
                  href="/settings/billing"
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  Upgrade to Standard
                </a>{' '}
                to add unlimited branches.
              </span>
            </div>
          </div>
        )}

        {/* Branch list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">
              Branches{' '}
              <span className="text-slate-500 font-normal">
                ({branches.length}{isFreeTrialPlan ? ' / 1' : ''})
              </span>
            </h2>
            {!atLimit && !showForm && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3 h-3" /> Add Branch
              </Button>
            )}
            {atLimit && !showForm && (
              <a
                href="/settings/billing"
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Crown className="w-3 h-3" /> Upgrade for more
              </a>
            )}
          </div>

          {/* Existing branches */}
          {branches.length === 0 && !showForm ? (
            <div
              onClick={() => setShowForm(true)}
              className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-dashed border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 cursor-pointer transition-all group"
            >
              <div className="p-3 rounded-full bg-white/5 group-hover:bg-indigo-500/10 transition-colors">
                <Store className="w-6 h-6 text-slate-500 group-hover:text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-400 group-hover:text-slate-300">
                  No branches yet
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Click to add your first location
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {branches.map((branch) => (
                <div
                  key={branch._id}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    branch.isPrimary
                      ? 'border-indigo-500/30 bg-indigo-500/5'
                      : 'border-white/8 bg-white/[0.02]'
                  )}
                >
                  <div className="p-2 rounded-lg bg-white/5">
                    <Store
                      className={cn(
                        'w-4 h-4',
                        branch.isPrimary ? 'text-indigo-400' : 'text-slate-500'
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{branch.name}</p>
                      {branch.isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          <Star className="w-2.5 h-2.5" /> Primary
                        </span>
                      )}
                      {branch.code && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-400">
                          {branch.code}
                        </span>
                      )}
                    </div>
                    {(branch.formattedAddress || branch.address || branch.city) && (
                      <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {branch.formattedAddress || branch.address || [branch.city, branch.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {branch.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="w-3 h-3" />
                      <span className="hidden sm:inline">{branch.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add branch form */}
          {showForm && (
            <form
              onSubmit={handleCreateBranch}
              className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  New Branch
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">
                  Branch Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="branch-name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Main Branch, Lekki Store, Victoria Island"
                  className="h-9 text-sm bg-black/30 border-white/10 focus:border-indigo-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Phone</Label>
                  <div className="relative flex items-center h-9 bg-black/30 border border-white/10 rounded-md text-xs transition-all focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                    <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-medium text-slate-200">+234</span>
                    </div>
                    <input
                      id="branch-phone"
                      type="tel"
                      value={branchPhone?.replace(/^\+234|^0/, '') || ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s+/g, '');
                        setBranchPhone(raw ? `+234${raw}` : '');
                      }}
                      placeholder="800 000 0000"
                      className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-600 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">City</Label>
                  <Input
                    id="branch-city"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    placeholder="e.g. Lagos"
                    className="h-9 text-sm bg-black/30 border-white/10 focus:border-indigo-500/50"
                  />
                </div>

                {/* Street */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Street / Area</Label>
                  <Input
                    id="branch-street"
                    value={branchStreet}
                    onChange={(e) => setBranchStreet(e.target.value)}
                    placeholder="e.g. 14 Admiralty Way, Lekki"
                    className="h-9 text-sm bg-black/30 border-white/10 focus:border-indigo-500/50"
                  />
                </div>

                {/* State */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">State</Label>
                  <CustomSelect
                    options={stateOptions}
                    value={branchState}
                    onChange={(val) => setBranchState(val)}
                    placeholder="Select state"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !branchName.trim()}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white border-0 gap-1.5"
                >
                  {submitting ? <Spinner size="sm" /> : <Plus className="w-3 h-3" />}
                  {submitting ? 'Creating…' : 'Create Branch'}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Navigation actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            onClick={() => navigate(`/orgs/${orgId}/apps`)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back to Apps
          </button>
          <div className="flex items-center gap-3">
            {branches.length > 0 && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border-0"
                onClick={() => (window.location.href = getHomeUrl())}
              >
                Go to Dashboard <ArrowRight className="w-3 h-3" />
              </Button>
            )}
            {branches.length === 0 && (
              <button
                onClick={() => (window.location.href = getHomeUrl())}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip for now →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BranchSetupPage;
