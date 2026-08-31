import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Header } from '@/components/landing/Header';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { COUNTRY_DIAL_CODES } from '@/lib/countryCodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  Compass,
  UserCheck,
  ArrowRight,
  Sparkles,
  Edit3,
  Globe,
} from 'lucide-react';

// Personal Profile Schema (Data Minimization per NDPR/GDPR)
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().default('Africa/Lagos'),
});

type ProfileData = z.infer<typeof profileSchema>;

export const WelcomeProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  useEffect(() => {
    // Check if user has any pending organization invitations
    const checkInvites = async () => {
      try {
        const res = await api.get<{ invitations: any[] }>('/invitations/pending');
        setPendingInvites(res.invitations || []);
      } catch {
        // Ignore
      }
    };
    checkInvites();
  }, []);

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || user?.name?.split(' ')[0] || '',
      lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
      phone: user?.phone || '',
      country: user?.country || 'Nigeria',
      state: user?.state || '',
      city: user?.city || '',
      timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
    },
  });

  const selectedCountry = profileForm.watch('country');

  const countryOptions: SelectOption[] = React.useMemo(() => {
    return COUNTRY_DIAL_CODES.map((c) => ({
      value: c.name,
      label: `${c.flag} ${c.name}`,
      badge: c.dialCode,
      badgeColor: 'bg-white/5 text-slate-300 border border-white/10',
    }));
  }, []);

  const onSaveProfile = async (data: ProfileData) => {
    setIsLoading(true);
    try {
      await api.patch('/users/me', {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name: `${data.firstName.trim()} ${data.lastName.trim()}`,
        phone: data.phone?.trim() || undefined,
        country: data.country,
        state: data.state?.trim() || undefined,
        city: data.city?.trim() || undefined,
        timezone: data.timezone,
      });
      await refreshSession();
      toast.success('Personal profile updated!');
      setShowProfileEditor(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (token: string) => {
    setIsLoading(true);
    try {
      await api.post(`/invitations/${token}/accept`, {});
      await refreshSession();
      toast.success('Invitation accepted! Welcome to the organization.');
      navigate('/app', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between relative overflow-x-hidden">
      {/* Universal Top Header */}
      <Header />

      {/* Subtle background glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-radial from-[#714b67]/15 to-transparent pointer-events-none -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col justify-center">
        {/* Welcome Banner */}
        <div className="mb-8 text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#d4a8c9] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#d4a8c9]" />
            <span>Your Orviohub account is ready</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            Welcome to Orviohub
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Your account is ready. You can create an organization, join one by invitation, or continue using Orviohub without an organization.
          </p>
          <p className="text-base sm:text-lg text-white font-semibold pt-1">
            What would you like to do?
          </p>
        </div>

        {/* Pending Organization Invitations Banner */}
        {pendingInvites.length > 0 && (
          <div className="mb-8 p-4 rounded-2xl bg-[#160f14] border border-[#714b67]/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Users className="w-4 h-4 text-[#d4a8c9]" />
                <span>You have {pendingInvites.length} pending organization invitation{pendingInvites.length > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-black/60 border border-white/10"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white">{invite.organizationName || 'Organization'}</div>
                    <div className="text-[11px] text-slate-400">
                      Invited as <span className="text-[#d4a8c9] font-semibold uppercase">{invite.role}</span> by {invite.inviterName || 'Team Admin'}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite.token)}
                    disabled={isLoading}
                    className="h-8 px-4 bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer"
                  >
                    Accept & Join
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Profile Summary Card */}
        <div className="mb-8 p-5 rounded-2xl bg-[#0c080b]/90 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#d4a8c9] font-bold text-sm shrink-0">
              {user?.firstName?.[0] || user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.name || user?.email}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  Account Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProfileEditor(!showProfileEditor)}
            className="text-xs h-9 px-3.5 bg-[#160f14] border-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#d4a8c9]" />
            <span>{showProfileEditor ? 'Close Editor' : 'Edit Profile'}</span>
          </Button>
        </div>

        {/* Profile Editor Modal / Inline Tray */}
        {showProfileEditor && (
          <div className="mb-8 p-6 rounded-2xl bg-[#0c080b]/95 border border-[#714b67]/40 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Update Personal Profile</h3>
              <p className="text-xs text-slate-400">Personal details are independent of organizations</p>
            </div>

            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">First Name <span className="text-red-400">*</span></Label>
                  <Input
                    {...profileForm.register('firstName')}
                    placeholder="Alex"
                    className="h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Last Name <span className="text-red-400">*</span></Label>
                  <Input
                    {...profileForm.register('lastName')}
                    placeholder="Johnson"
                    className="h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Phone Number</Label>
                  <Input
                    {...profileForm.register('phone')}
                    placeholder="+234 801..."
                    className="h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Country</Label>
                  <CustomSelect
                    options={countryOptions}
                    value={selectedCountry}
                    onChange={(val) => profileForm.setValue('country', val)}
                    placeholder="Select country"
                    searchable={true}
                    searchPlaceholder="Search country..."
                    icon={<Globe className="w-3.5 h-3.5 text-slate-400" />}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProfileEditor(false)}
                  className="h-9 text-xs bg-transparent border-white/10 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading}
                  className="h-9 px-5 bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#714b67]/20"
                >
                  {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
                  Save Details
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* 4 CORE ONBOARDING ACTIONS MATRIX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Action 1: Create an Organization */}
          <div
            onClick={() => navigate('/app/organizations/new')}
            className="group p-5 sm:p-6 rounded-2xl bg-[#0c080b]/90 hover:bg-[#160f14] border border-white/10 hover:border-[#714b67]/60 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#714b67]/20 flex flex-col justify-between backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#d4a8c9] group-hover:scale-105 transition-transform shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-[#d4a8c9] transition-colors">
                  Create an organization
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Start a new business, retail store, company, team, gym, club, or school. Set up branches, enable business apps, and invite your staff.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-[#d4a8c9]">
              <span>Set up new organization</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Action 2: Join an Organization */}
          <div
            onClick={() => navigate('/workspaces')}
            className="group p-5 sm:p-6 rounded-2xl bg-[#0c080b]/90 hover:bg-[#160f14] border border-white/10 hover:border-[#714b67]/60 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#714b67]/20 flex flex-col justify-between backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Join an organization
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Accept an invitation from an employer or team leader. You don't need to own an organization to participate in someone else's workspace.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span>View invitations & memberships</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Action 3: Explore Orviohub */}
          <div
            onClick={() => navigate('/explorer')}
            className="group p-5 sm:p-6 rounded-2xl bg-[#0c080b]/90 hover:bg-[#160f14] border border-white/10 hover:border-[#714b67]/60 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#714b67]/20 flex flex-col justify-between backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-950/50 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform shadow-inner">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                  Explore Orviohub
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Browse available business applications, view product descriptions, pricing plans, and documentation before deciding to create an organization.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-sky-400">
              <span>Explore application directory</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Action 4: Go to My Account */}
          <div
            onClick={() => navigate('/profile/personal')}
            className="group p-5 sm:p-6 rounded-2xl bg-[#0c080b]/90 hover:bg-[#160f14] border border-white/10 hover:border-[#714b67]/60 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#714b67]/20 flex flex-col justify-between backdrop-blur-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shadow-inner">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                  Go to my account
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Open your unified Account Center to manage your personal profile, passwords, login methods, active sessions, and privacy controls.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-purple-400">
              <span>Open account center</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </main>

      {/* Dark Minimal Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orviohub Inc. • Independent Personal Identity & Multi-Tenant Operating Platform
      </footer>
    </div>
  );
};
