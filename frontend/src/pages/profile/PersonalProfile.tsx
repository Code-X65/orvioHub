import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { AvatarCropperModal } from '@/components/profile/AvatarCropperModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Sparkles, Camera, Trash2 } from 'lucide-react';

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
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

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
    }
  }, [user, reset]);

  const handleSaveAvatar = async (croppedDataUrl: string) => {
    const res = await api.patch<{ user: any }>('/users/me', {
      avatarUrl: croppedDataUrl,
    });
    updateUser(res.user);
    await refreshSession();
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    setIsRemovingAvatar(true);
    try {
      const res = await api.patch<{ user: any }>('/users/me', {
        avatarUrl: null,
      });
      updateUser(res.user);
      await refreshSession();
      toast.success('Profile photo removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove photo.');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

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

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <ProfileLayout
      title="Personal Information"
      description="Manage your global identity. These details represent you across all Orvio workspaces."
      activeSection="personal"
    >
      <div className="space-y-8">
        {/* Avatar Profile Section */}
        <section className="p-5 rounded-lg border border-white/10 bg-slate-900/40 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => setIsCropperOpen(true)}>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#714b67]/60 bg-slate-800 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name || 'User avatar'} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Camera className="w-5 h-5" />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white">{user?.name || 'User'}</h4>
              <p className="text-xs text-slate-400">{user?.email}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">JPEG, PNG, or WEBP up to 5MB.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCropperOpen(true)}
              className="text-xs bg-slate-900 border-white/10 text-slate-200 hover:bg-slate-800 gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-[#714b67]" />
              <span>Change Photo</span>
            </Button>

            {user?.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={isRemovingAvatar}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2"
                title="Remove Photo"
              >
                {isRemovingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </section>

        {/* Profile Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">First Name *</Label>
              <Input
                {...register('firstName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="John"
              />
              {errors.firstName && <p className="text-xs text-rose-400">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Last Name *</Label>
              <Input
                {...register('lastName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
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
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="e.g. John D."
              />
              <p className="text-[11px] text-slate-500">How your name appears to colleagues in team lists.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Preferred Name / Nickname</Label>
              <Input
                {...register('preferredName')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="e.g. JD"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Job Title</Label>
              <Input
                {...register('jobTitle')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="e.g. Store Assistant / Inventory Officer"
              />
              <p className="text-[11px] text-slate-500">Your professional title (distinct from workspace roles).</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Department</Label>
              <Input
                {...register('department')}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="e.g. Retail Sales / Logistics"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">Bio / About</Label>
            <textarea
              {...register('bio')}
              rows={3}
              className="w-full rounded-xs border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-[#714b67] focus:outline-none focus:ring-1 focus:ring-[#714b67]"
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
              className="bg-[#714b67] hover:bg-[#88597c] text-white font-medium text-xs px-6 rounded-xs"
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

        {/* Interactive Avatar Cropper Modal */}
        <AvatarCropperModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          onSave={handleSaveAvatar}
          currentAvatarUrl={user?.avatarUrl}
        />
      </div>
    </ProfileLayout>
  );
};
