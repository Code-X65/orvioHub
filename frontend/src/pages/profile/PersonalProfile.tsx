import React, { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { PersonalProfileForm, PersonalProfileFormData } from '@/components/profile/PersonalProfileForm';
import { toast } from 'sonner';

export const PersonalProfile: React.FC = () => {
  const { user, updateUser, refreshSession } = useAuthStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSaveAvatar = async (croppedDataUrl: string) => {
    try {
      const res = await api.patch<{ user: any; data?: { user: any } }>('/users/me', {
        avatarUrl: croppedDataUrl,
      });
      const updatedUser = res.data?.user || res.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      await refreshSession();
      toast.success('Profile photo updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile photo.');
      throw err;
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const res = await api.patch<{ user: any; data?: { user: any } }>('/users/me', {
        avatarUrl: null,
      });
      const updatedUser = res.data?.user || res.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      await refreshSession();
      toast.success('Profile photo removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove photo.');
      throw err;
    }
  };

  const handleSubmitProfile = async (formData: PersonalProfileFormData) => {
    setIsUpdating(true);
    try {
      const res = await api.patch<{ user: any; data?: { user: any } }>('/users/me', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: formData.displayName ? formData.displayName : undefined,
        jobTitle: formData.jobTitle ? formData.jobTitle : undefined,
        department: formData.department ? formData.department : undefined,
        phone: formData.phone ? formData.phone : undefined,
        country: 'NG',
        timezone: 'Africa/Lagos',
      });

      const updatedUser = res.data?.user || res.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      await refreshSession();
      toast.success('Personal profile updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update personal details.');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhoneVerified = async (verifiedPhone: string) => {
    if (user) {
      updateUser({
        ...user,
        phone: verifiedPhone,
        phoneVerified: true,
        phoneVerifiedAt: Date.now(),
      });
    }
    await refreshSession().catch(() => {});
  };

  const initialValues = useMemo(() => ({
    firstName: user?.firstName || user?.name?.split(' ')[0] || '',
    lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
    displayName: user?.displayName || '',
    jobTitle: user?.jobTitle || '',
    department: user?.department || '',
    phone: user?.phone || '',
    phoneVerified: Boolean(user?.phoneVerified || user?.phoneVerifiedAt),
    avatarUrl: user?.avatarUrl || user?.avatar || null,
    email: user?.email,
    name: user?.name,
  }), [
    user?.id,
    user?.firstName,
    user?.lastName,
    user?.name,
    user?.displayName,
    user?.jobTitle,
    user?.department,
    user?.phone,
    user?.phoneVerified,
    user?.phoneVerifiedAt,
    user?.avatarUrl,
    user?.avatar,
    user?.email,
  ]);

  return (
    <ProfileLayout
      title="Personal Information"
      description="Manage your global identity. These details represent you across all Orvio workspaces."
      activeSection="personal"
    >
      <PersonalProfileForm
        initialValues={initialValues}
        onSubmit={handleSubmitProfile}
        onSaveAvatar={handleSaveAvatar}
        onRemoveAvatar={handleRemoveAvatar}
        onPhoneVerified={handlePhoneVerified}
        isLoading={isUpdating}
      />
    </ProfileLayout>
  );
};

export const PersonalProfilePage = PersonalProfile;
