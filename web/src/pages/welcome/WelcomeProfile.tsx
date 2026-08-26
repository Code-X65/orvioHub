import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  User,
  ArrowRight,
  Users,
  Globe,
  Phone,
  Clock,
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
      country: user?.country || 'NG',
      state: user?.state || '',
      city: user?.city || '',
      timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
    },
  });

  // Save Personal Profile and proceed to Organization Onboarding
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
      toast.success('Profile saved!');
      navigate('/onboarding/organization', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/onboarding/organization', { replace: true });
  };

  const handleAcceptInvite = async (token: string) => {
    setIsLoading(true);
    try {
      await api.post(`/invitations/${token}/accept`, {});
      await refreshSession();
      toast.success('Invitation accepted! Taking you to organization...');
      navigate('/app', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Top Universal Header */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 max-w-[480px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {/* Header */}
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-semibold">
            <User className="w-3 h-3" />
            <span>Profile Setup</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Complete your profile
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Tell us your name and region to personalize your experience before creating or joining an organization.
          </p>
        </div>

        {/* Pending Invitations Banner (if user was invited to an existing organization) */}
        {pendingInvites.length > 0 && (
          <div className="mb-4 p-3.5 rounded-xs bg-[#140e12] border border-[#714b67]/30 space-y-2">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#c79dbd]" />
              <span>Pending Organization Invitation</span>
            </div>
            {pendingInvites.map((inv, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <div>
                  <span className="font-semibold text-white">{inv.workspaceName || 'Invited Organization'}</span>
                  <span className="text-[10px] text-slate-400 block">Role: {inv.role}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAcceptInvite(inv.token)}
                  className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xs font-semibold cursor-pointer"
                >
                  Accept & Join
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* PROFILE SETUP FORM */}
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-3.5 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">First Name *</Label>
              <Input
                {...profileForm.register('firstName')}
                placeholder="Alex"
                className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
              />
              {profileForm.formState.errors.firstName && (
                <p className="text-[11px] text-rose-400">{profileForm.formState.errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Last Name *</Label>
              <Input
                {...profileForm.register('lastName')}
                placeholder="Johnson"
                className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
              />
              {profileForm.formState.errors.lastName && (
                <p className="text-[11px] text-rose-400">{profileForm.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Phone (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  {...profileForm.register('phone')}
                  placeholder="+234 801..."
                  className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Country *</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <select
                  {...profileForm.register('country')}
                  className="w-full pl-9 pr-3 h-10 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="NG" className="bg-[#120b10]">Nigeria (NG)</option>
                  <option value="GH" className="bg-[#120b10]">Ghana (GH)</option>
                  <option value="KE" className="bg-[#120b10]">Kenya (KE)</option>
                  <option value="US" className="bg-[#120b10]">United States (US)</option>
                  <option value="GB" className="bg-[#120b10]">United Kingdom (GB)</option>
                  <option value="CA" className="bg-[#120b10]">Canada (CA)</option>
                  <option value="ZA" className="bg-[#120b10]">South Africa (ZA)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">State / Region</Label>
              <Input
                {...profileForm.register('state')}
                placeholder="e.g. Lagos"
                className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">City</Label>
              <Input
                {...profileForm.register('city')}
                placeholder="e.g. Ikeja"
                className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-300">Timezone *</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <select
                {...profileForm.register('timezone')}
                className="w-full pl-9 pr-3 h-10 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
              >
                <option value="Africa/Lagos" className="bg-[#120b10]">West Africa Time (Lagos, GMT+1)</option>
                <option value="Africa/Accra" className="bg-[#120b10]">Greenwich Mean Time (Accra, GMT+0)</option>
                <option value="Africa/Nairobi" className="bg-[#120b10]">East Africa Time (Nairobi, GMT+3)</option>
                <option value="Africa/Johannesburg" className="bg-[#120b10]">South Africa Standard Time (GMT+2)</option>
                <option value="Europe/London" className="bg-[#120b10]">London (GMT/BST)</option>
                <option value="America/New_York" className="bg-[#120b10]">Eastern Time (US & Canada)</option>
                <option value="America/Chicago" className="bg-[#120b10]">Central Time (US & Canada)</option>
                <option value="America/Los_Angeles" className="bg-[#120b10]">Pacific Time (US & Canada)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Skip optional info →
            </button>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 px-6 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {isLoading ? <Spinner size="sm" className="mr-1" /> : null}
              <span>Continue to Organization Setup</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </main>

      {/* Dark Minimal Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orivo Inc. • Single Unified Business Platform
      </footer>
    </div>
  );
};
