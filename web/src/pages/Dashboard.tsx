import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  LogOut,
  LayoutDashboard,
  Settings,
  User,
  Building2,
  ChevronDown,
  Plus,
  Check,
  DoorOpen,
  Loader2,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
];

export const Dashboard: React.FC = () => {
  const {
    user,
    onboardingStatus,
    memberships,
    activeOrganizationId,
    setActiveOrganizationId,
    setMemberships,
    logout,
  } = useAuthStore();

  const navigate = useNavigate();

  // Switcher dropdown state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Create Org Modal
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgIndustry, setOrgIndustry] = useState('Technology');
  const [orgCountry, setOrgCountry] = useState('US');
  const [orgTimezone, setOrgTimezone] = useState('UTC');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Leave Org Modal
  const [isLeaveOrgOpen, setIsLeaveOrgOpen] = useState(false);
  const [isLeavingOrg, setIsLeavingOrg] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch memberships on mount if empty
  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const res = await api.get<{ memberships: any[] }>('/organizations');
        if (res.memberships) {
          setMemberships(res.memberships);
        }
      } catch {
        // Fallback to store memberships
      }
    };
    fetchMemberships();
  }, [setMemberships]);

  const activeMembership = memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  const currentOrgName = activeMembership?.organization?.name || onboardingStatus?.organization?.name || 'Workspace';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error('Organization name is required.');
      return;
    }

    setIsCreatingOrg(true);
    try {
      const res = await api.post<{ organization: any; membership: any; onboarding?: any }>('/organizations', {
        name: orgName.trim(),
        industry: orgIndustry,
        country: orgCountry,
        timezone: orgTimezone,
      });

      // Refetch organizations
      const orgsRes = await api.get<{ memberships: any[] }>('/organizations');
      if (orgsRes.memberships) {
        setMemberships(orgsRes.memberships);
      }
      if (res.organization?.id) {
        setActiveOrganizationId(res.organization.id);
      }

      toast.success(`Organization "${orgName}" created successfully!`);
      setIsCreateOrgOpen(false);
      setOrgName('');

      // Seamlessly transition to module selection if newly created workspace requires configuration
      if (res.onboarding?.status !== 'COMPLETED') {
        navigate('/onboarding/modules');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization.');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!activeMembership) return;
    setIsLeavingOrg(true);
    try {
      await api.post(`/organizations/${activeMembership.organization.id}/leave`);
      toast.success(`You have left ${activeMembership.organization.name}.`);

      // Refetch memberships
      const orgsRes = await api.get<{ memberships: any[] }>('/organizations');
      setMemberships(orgsRes.memberships || []);
      setIsLeaveOrgOpen(false);
      setIsSwitcherOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave organization.');
    } finally {
      setIsLeavingOrg(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white hidden sm:inline-block">
            orvio<span className="text-indigo-400">Hub</span>
          </span>

          {/* Org Switcher Dropdown */}
          <div className="relative ml-2 sm:ml-4" ref={switcherRef}>
            <button
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-medium transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="max-w-[140px] truncate">{currentOrgName}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isSwitcherOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-sm bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Your Organizations
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5 px-1">
                  {memberships.map((m) => {
                    const isSelected = m.organization.id === activeMembership?.organization.id;
                    return (
                      <button
                        key={m.organization.id}
                        onClick={() => {
                          setActiveOrganizationId(m.organization.id);
                          setIsSwitcherOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                          isSelected
                            ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                          <span className="truncate">{m.organization.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                            {m.role}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-slate-800 mt-2 pt-2 px-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsSwitcherOpen(false);
                      setIsCreateOrgOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-indigo-400 hover:bg-slate-800 transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Organization</span>
                  </button>

                  {memberships.length > 1 && (
                    <button
                      onClick={() => {
                        setIsSwitcherOpen(false);
                        setIsLeaveOrgOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <DoorOpen className="w-3.5 h-3.5" />
                      <span>Leave this Organization</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Nav Options */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings/organization')}
            className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 text-xs"
          >
            <Users className="w-4 h-4 mr-1.5 text-indigo-400" />
            <span className="hidden sm:inline">Team & Audit</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings/profile')}
            className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 text-xs"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <User className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-rose-400">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Welcome back, {user?.name?.split(' ')[0]}</h1>
            <p className="text-slate-400 text-sm">
              Currently managing <span className="text-indigo-400 font-medium">{currentOrgName}</span> ({activeMembership?.role || 'Member'}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/settings/organization')}
              className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs"
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Manage Team & Audit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreateOrgOpen(true)}
              className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              New Org
            </Button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {onboardingStatus?.workspace?.initializedModules?.map((mod: string) => (
            <div
              key={mod}
              className="bg-slate-900/60 border border-slate-800 rounded-sm p-6 hover:border-indigo-500/40 hover:bg-slate-900 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <LayoutDashboard className="w-24 h-24 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 capitalize relative z-10">{mod}</h3>
              <p className="text-sm text-slate-400 relative z-10">Access your {mod} module tools and reports.</p>
              <div className="mt-6 flex items-center text-indigo-400 text-sm font-medium relative z-10">
                Launch app &rarr;
              </div>
            </div>
          ))}

          {(!onboardingStatus?.workspace?.initializedModules ||
            onboardingStatus.workspace.initializedModules.length === 0) && (
            <div className="col-span-full bg-slate-900/40 border border-slate-800 rounded-sm p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400">
                <LayoutDashboard className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Workspace Ready</h3>
              <p className="text-slate-400 mb-6 max-w-md text-sm">
                Your organization is configured. Use the modules or organization settings to manage your team.
              </p>
              <Button onClick={() => navigate('/settings/profile')} className="bg-indigo-600 hover:bg-indigo-500">
                Manage Profile & Security
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create Organization Modal */}
      {isCreateOrgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Create New Organization</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Set up a separate organization workspace with its own team and permissions.
            </p>

            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <Label htmlFor="createOrgName" className="text-xs text-slate-300">
                  Organization Name
                </Label>
                <Input
                  id="createOrgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  autoFocus
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="createOrgIndustry" className="text-xs text-slate-300">
                  Industry
                </Label>
                <Input
                  id="createOrgIndustry"
                  value={orgIndustry}
                  onChange={(e) => setOrgIndustry(e.target.value)}
                  placeholder="Technology, Healthcare, etc."
                  required
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="createOrgCountry" className="text-xs text-slate-300">
                    Country
                  </Label>
                  <Input
                    id="createOrgCountry"
                    value={orgCountry}
                    onChange={(e) => setOrgCountry(e.target.value)}
                    placeholder="US"
                    required
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="createOrgTimezone" className="text-xs text-slate-300">
                    Timezone
                  </Label>
                  <select
                    id="createOrgTimezone"
                    value={orgTimezone}
                    onChange={(e) => setOrgTimezone(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOrgOpen(false)}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingOrg}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4"
                >
                  {isCreatingOrg ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Organization Modal */}
      {isLeaveOrgOpen && activeMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              <DoorOpen className="w-5 h-5" />
              <span>Leave Organization?</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              Are you sure you want to leave <span className="font-semibold text-slate-100">{activeMembership.organization.name}</span>? You will lose all access to its workspaces, data, and tools.
            </p>

            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLeaveOrgOpen(false)}
                className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLeaveOrganization}
                disabled={isLeavingOrg}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4"
              >
                {isLeavingOrg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Leaving...
                  </>
                ) : (
                  'Yes, Leave Organization'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
