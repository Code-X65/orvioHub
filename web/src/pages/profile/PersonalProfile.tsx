import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Trash2, User, Sparkles } from 'lucide-react';

const personalSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  displayName: z.string().optional(),
  preferredName: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
});

type PersonalFormData = z.infer<typeof personalSchema>;

export const PersonalProfile: React.FC = () => {
  const { user, updateUser, refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || user?.avatar || '');
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<PersonalFormData>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      firstName: user?.firstName || user?.name?.split(' ')[0] || '',
      lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
      displayName: user?.displayName || user?.name || '',
      preferredName: user?.preferredName || '',
      jobTitle: user?.jobTitle || '',
      department: user?.department || '',
      bio: user?.bio || '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || user.name?.split(' ')[0] || '',
        lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
        displayName: user.displayName || user.name || '',
        preferredName: user.preferredName || '',
        jobTitle: user.jobTitle || '',
        department: user.department || '',
        bio: user.bio || '',
      });
      setAvatarUrl(user.avatarUrl || user.avatar || '');
    }
  }, [user, reset]);

  const onSubmit = async (data: PersonalFormData) => {
    setIsLoading(true);
    try {
      const res = await api.patch<{ user: any }>('/users/me', {
        ...data,
        name: `${data.firstName} ${data.lastName}`.trim(),
      });
      updateUser(res.user);
      await refreshSession();
      toast.success('Personal profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update personal details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarPreset = async (url: string) => {
    setIsUpdatingAvatar(true);
    try {
      await api.post('/users/me/avatar', { avatarUrl: url });
      setAvatarUrl(url);
      updateUser({ avatarUrl: url, avatar: url });
      await refreshSession();
      toast.success('Avatar updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update avatar.');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUpdatingAvatar(true);
    try {
      await api.delete('/users/me/avatar');
      setAvatarUrl('');
      updateUser({ avatarUrl: undefined, avatar: undefined });
      await refreshSession();
      toast.success('Avatar removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove avatar.');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  ];

  return (
    <ProfileLayout
      title="Personal Information"
      description="Manage your global identity. These details represent you across all Orvio workspaces."
      activeSection="personal"
    >
      <div className="space-y-8">
        {/* Avatar Section */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-[#714b67]" />
            Profile Picture & Avatar
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#714b67] to-indigo-800 flex items-center justify-center text-white text-3xl font-bold shadow-md overflow-hidden border-2 border-white/20">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (user?.name?.[0] || 'U').toUpperCase()
              )}
            </div>

            <div className="space-y-3 flex-1">
              <p className="text-xs text-slate-400">
                Choose a predefined avatar preset or enter a direct image URL.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAvatarPreset(preset)}
                    disabled={isUpdatingAvatar}
                    className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-transform hover:scale-105 ${
                      avatarUrl === preset ? 'border-[#714b67] scale-105' : 'border-transparent opacity-75'
                    }`}
                  >
                    <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}

                {avatarUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isUpdatingAvatar}
                    className="border-white/10 bg-rose-950/20 text-rose-300 hover:bg-rose-900/30 text-xs ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">First Name *</Label>
              <Input
                {...register('firstName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="John"
              />
              {errors.firstName && <p className="text-xs text-rose-400">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Last Name *</Label>
              <Input
                {...register('lastName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="Doe"
              />
              {errors.lastName && <p className="text-xs text-rose-400">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Display Name</Label>
              <Input
                {...register('displayName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="e.g. John D."
              />
              <p className="text-[11px] text-slate-500">How your name appears to colleagues in team lists.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Preferred Name / Nickname</Label>
              <Input
                {...register('preferredName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="e.g. JD"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Job Title</Label>
              <Input
                {...register('jobTitle')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="e.g. Store Assistant / Inventory Officer"
              />
              <p className="text-[11px] text-slate-500">Your professional title (distinct from workspace roles).</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Department</Label>
              <Input
                {...register('department')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="e.g. Retail Sales / Logistics"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">Bio / About</Label>
            <textarea
              {...register('bio')}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-[#714b67] focus:outline-none focus:ring-1 focus:ring-[#714b67]"
              placeholder="Tell your team a little bit about yourself..."
            />
            {errors.bio && <p className="text-xs text-rose-400">{errors.bio.message}</p>}
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-white/10">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#714b67]" />
              <span>Changes sync automatically across Orvio applications.</span>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isDirty}
              className="bg-[#714b67] hover:bg-[#88597c] text-white font-medium text-xs px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </ProfileLayout>
  );
};
