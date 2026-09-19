import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { ReadOnlyCountryField } from './ReadOnlyCountryField';
import { ReadOnlyTimezoneField } from './ReadOnlyTimezoneField';
import { PhoneNumberField } from './PhoneNumberField';
import { ProfilePhotoUploader } from './ProfilePhotoUploader';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { ProfileSaveState } from './ProfileSaveState';

export const personalProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'First name must be under 100 characters'),
  lastName: z.string().trim().min(1, 'Last name is required').max(100, 'Last name must be under 100 characters'),
  displayName: z.string().trim().max(100, 'Display name must be under 100 characters').optional(),
  jobTitle: z.string().trim().max(100, 'Job title must be under 100 characters').optional(),
  department: z.string().trim().max(100, 'Department must be under 100 characters').optional(),
  phone: z.string().trim().optional(),
  country: z.literal('NG'),
  timezone: z.literal('Africa/Lagos'),
});

export type PersonalProfileFormData = z.infer<typeof personalProfileSchema>;

export interface PersonalProfileFormProps {
  initialValues?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    jobTitle?: string;
    department?: string;
    phone?: string;
    phoneVerified?: boolean;
    avatarUrl?: string | null;
    email?: string;
    name?: string;
  };
  onSubmit: (data: PersonalProfileFormData) => Promise<void>;
  onSaveAvatar: (croppedDataUrl: string) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
  isLoading?: boolean;
}

export const PersonalProfileForm: React.FC<PersonalProfileFormProps> = ({
  initialValues,
  onSubmit,
  onSaveAvatar,
  onRemoveAvatar,
  isLoading = false,
}) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<PersonalProfileFormData>({
    resolver: zodResolver(personalProfileSchema),
    defaultValues: {
      firstName: initialValues?.firstName || initialValues?.name?.split(' ')[0] || '',
      lastName: initialValues?.lastName || initialValues?.name?.split(' ').slice(1).join(' ') || '',
      displayName: initialValues?.displayName || '',
      jobTitle: initialValues?.jobTitle || '',
      department: initialValues?.department || '',
      phone: initialValues?.phone || '',
      country: 'NG',
      timezone: 'Africa/Lagos',
    },
  });

  const phoneValue = watch('phone');

  // Sync form when initial values change and form is not dirty
  useEffect(() => {
    if (initialValues && !isDirty) {
      reset({
        firstName: initialValues.firstName || initialValues.name?.split(' ')[0] || '',
        lastName: initialValues.lastName || initialValues.name?.split(' ').slice(1).join(' ') || '',
        displayName: initialValues.displayName || '',
        jobTitle: initialValues.jobTitle || '',
        department: initialValues.department || '',
        phone: initialValues.phone || '',
        country: 'NG',
        timezone: 'Africa/Lagos',
      });
    }
  }, [initialValues, isDirty, reset]);

  const handleFormSubmit = async (data: PersonalProfileFormData) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      await onSubmit(data);
      setSaveStatus('success');
      // Reset isDirty baseline to saved values
      reset(data);
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'success' ? 'idle' : prev));
      }, 4000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to update personal profile. Please verify your inputs and try again.');
    }
  };

  return (
    <div className="space-y-8">
      <UnsavedChangesGuard isDirty={isDirty} />

      <ProfileSaveState
        status={saveStatus}
        errorMessage={errorMessage}
        successMessage="Personal profile updated successfully."
      />

      {/* 1. Profile Photo (Optional) */}
      <ProfilePhotoUploader
        avatarUrl={initialValues?.avatarUrl}
        name={initialValues?.name || `${watch('firstName')} ${watch('lastName')}`.trim() || 'User'}
        email={initialValues?.email}
        onSaveAvatar={onSaveAvatar}
        onRemoveAvatar={onRemoveAvatar}
        disabled={isLoading || saveStatus === 'saving'}
      />

      {/* 2. Main Profile Form */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* First & Last Name (Required) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">First Name *</Label>
            <Input
              {...register('firstName')}
              placeholder="e.g. Chinedu"
              disabled={isLoading || saveStatus === 'saving'}
              className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs h-11"
            />
            {errors.firstName && <p className="text-xs text-rose-400">{errors.firstName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">Last Name *</Label>
            <Input
              {...register('lastName')}
              placeholder="e.g. Okafor"
              disabled={isLoading || saveStatus === 'saving'}
              className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs h-11"
            />
            {errors.lastName && <p className="text-xs text-rose-400">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Display Name (Optional) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-slate-300">Display Name</Label>
            <span className="text-[11px] text-slate-500 font-normal">(Optional)</span>
          </div>
          <Input
            {...register('displayName')}
            placeholder="e.g. Chinedu O."
            disabled={isLoading || saveStatus === 'saving'}
            className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs h-11"
          />
          <p className="text-[11px] text-slate-500">
            How your name appears to colleagues in team lists. Defaults to your full name if left empty.
          </p>
          {errors.displayName && <p className="text-xs text-rose-400">{errors.displayName.message}</p>}
        </div>

        {/* Job Title & Department (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-300">Job Title</Label>
              <span className="text-[11px] text-slate-500 font-normal">(Optional)</span>
            </div>
            <Input
              {...register('jobTitle')}
              placeholder="e.g. Store Manager"
              disabled={isLoading || saveStatus === 'saving'}
              className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs h-11"
            />
            <p className="text-[11px] text-slate-500">Your role or professional title.</p>
            {errors.jobTitle && <p className="text-xs text-rose-400">{errors.jobTitle.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-300">Department</Label>
              <span className="text-[11px] text-slate-500 font-normal">(Optional)</span>
            </div>
            <Input
              {...register('department')}
              placeholder="e.g. Operations / Logistics"
              disabled={isLoading || saveStatus === 'saving'}
              className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs h-11"
            />
            <p className="text-[11px] text-slate-500">Your team or operational unit.</p>
            {errors.department && <p className="text-xs text-rose-400">{errors.department.message}</p>}
          </div>
        </div>

        {/* Regional Scope: Country & Timezone (Read-only for Nigerian MVP) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyCountryField />
          <ReadOnlyTimezoneField />
        </div>

        {/* Phone Number (Optional) */}
        <PhoneNumberField
          value={phoneValue || ''}
          onChange={(val) => {
            setValue('phone', val, { shouldDirty: true, shouldValidate: true });
          }}
          phoneVerified={initialValues?.phoneVerified}
          error={errors.phone?.message}
          disabled={isLoading || saveStatus === 'saving'}
        />

        {/* Submit Actions */}
        <div className="pt-4 flex items-center justify-between border-t border-white/10">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#714b67]" />
            <span>Profile updates sync across all your Orvio workspaces.</span>
          </div>

          <Button
            type="submit"
            disabled={isLoading || saveStatus === 'saving' || !isDirty}
            className="bg-[#714b67] hover:bg-[#88597c] text-white font-medium text-xs px-6 rounded-xs h-10 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === 'saving' || isLoading ? (
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
  );
};
