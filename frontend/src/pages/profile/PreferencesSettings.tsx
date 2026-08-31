import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Globe,
  Calendar,
  DollarSign,
  Loader2,
  Clock,
  Languages,
  Check,
} from 'lucide-react';

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT) - Lagos, Abuja', badge: 'GMT+1' },
  { value: 'Africa/Accra', label: 'Greenwich Mean Time (GMT) - Accra', badge: 'GMT+0' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT) - Nairobi', badge: 'GMT+3' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (SAST)', badge: 'GMT+2' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', badge: 'UTC' },
  { value: 'Europe/London', label: 'London, Edinburgh', badge: 'GMT/BST' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Madrid', badge: 'CET' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)', badge: 'EST' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)', badge: 'CST' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', badge: 'PST' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) - Dubai', badge: 'GST' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', badge: 'IST' },
];

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'en', label: 'English (US / UK)', badge: 'Default' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'yo', label: 'Yorùbá', badge: 'NG' },
  { value: 'ha', label: 'Hausa', badge: 'NG' },
  { value: 'ig', label: 'Igbo', badge: 'NG' },
  { value: 'es', label: 'Español (Spanish)' },
];

const DATE_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 25/08/2026)', badge: 'Standard' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 08/25/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-08-25)', badge: 'ISO' },
];

const NUMBER_FORMAT_OPTIONS: SelectOption[] = [
  { value: '1,234.56', label: '1,234.56 (Standard comma)', badge: '1,234.56' },
  { value: '1.234,56', label: '1.234,56 (European dot)', badge: '1.234,56' },
  { value: '1 234.56', label: '1 234.56 (Space separator)', badge: '1 234.56' },
];

const FIRST_DAY_OPTIONS: SelectOption[] = [
  { value: 'monday', label: 'Monday (Standard business week)', badge: 'Mon' },
  { value: 'sunday', label: 'Sunday', badge: 'Sun' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'NGN', label: 'Nigerian Naira (₦ NGN)', badge: '₦', badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  { value: 'USD', label: 'US Dollar ($ USD)', badge: '$', badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  { value: 'GBP', label: 'British Pound (£ GBP)', badge: '£', badgeColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  { value: 'EUR', label: 'Euro (€ EUR)', badge: '€', badgeColor: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  { value: 'GHS', label: 'Ghanaian Cedi (₵ GHS)', badge: '₵', badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  { value: 'KES', label: 'Kenyan Shilling (KSh KES)', badge: 'KSh', badgeColor: 'bg-teal-500/20 text-teal-400 border border-teal-500/30' },
  { value: 'ZAR', label: 'South African Rand (R ZAR)', badge: 'R', badgeColor: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
];

export const PreferencesSettings: React.FC = () => {
  const { user, updateUser, refreshSession } = useAuthStore();

  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Lagos');
  const [language, setLanguage] = useState(user?.language || 'en');
  const [dateFormat, setDateFormat] = useState(user?.dateFormat || 'DD/MM/YYYY');
  const [numberFormat, setNumberFormat] = useState(user?.numberFormat || '1,234.56');
  const [currencyPreference, setCurrencyPreference] = useState(user?.currencyPreference || 'NGN');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<'monday' | 'sunday'>(
    (user?.firstDayOfWeek as 'monday' | 'sunday') || 'monday'
  );
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    (user?.theme as 'dark' | 'light' | 'system') || 'dark'
  );
  const [layoutDensity, setLayoutDensity] = useState<'compact' | 'comfortable'>(
    (user?.layoutDensity as 'compact' | 'comfortable') || 'comfortable'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.timezone) setTimezone(user.timezone);
      if (user.language) setLanguage(user.language);
      if (user.dateFormat) setDateFormat(user.dateFormat);
      if (user.numberFormat) setNumberFormat(user.numberFormat);
      if (user.currencyPreference) setCurrencyPreference(user.currencyPreference);
      if (user.firstDayOfWeek) setFirstDayOfWeek(user.firstDayOfWeek as 'monday' | 'sunday');
      if (user.theme) setTheme(user.theme as 'dark' | 'light' | 'system');
      if (user.layoutDensity) setLayoutDensity(user.layoutDensity as 'compact' | 'comfortable');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        timezone,
        language,
        dateFormat,
        numberFormat,
        currencyPreference,
        firstDayOfWeek,
        theme,
        layoutDensity,
      };

      await api.patch<{ preferences: any }>('/users/me/preferences', payload);
      updateUser(payload);
      await refreshSession();
      toast.success('Regional & display preferences saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProfileLayout
      title="Regional & Display Preferences"
      description="Customize your time zone, numeric formatting, currency display, and interface layout."
      activeSection="preferences"
    >
      <form onSubmit={handleSave} className="space-y-6">
        {/* Timezone & Language Card */}
        <div className="p-6 rounded-2xl bg-[#0c080b]/90 border border-white/10 shadow-2xl backdrop-blur-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#d4a8c9]" />
            <span>Regional Localization</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Time Zone</Label>
              <CustomSelect
                options={TIMEZONE_OPTIONS}
                value={timezone}
                onChange={(val) => setTimezone(val)}
                placeholder="Select time zone"
                searchable={true}
                searchPlaceholder="Search time zone..."
                icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Language</Label>
              <CustomSelect
                options={LANGUAGE_OPTIONS}
                value={language}
                onChange={(val) => setLanguage(val)}
                placeholder="Select language"
                searchable={false}
                icon={<Languages className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>
          </div>
        </div>

        {/* Date & Number Formats Card */}
        <div className="p-6 rounded-2xl bg-[#0c080b]/90 border border-white/10 shadow-2xl backdrop-blur-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Formatting & Units</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Date Format</Label>
              <CustomSelect
                options={DATE_FORMAT_OPTIONS}
                value={dateFormat}
                onChange={(val) => setDateFormat(val)}
                searchable={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Number Format</Label>
              <CustomSelect
                options={NUMBER_FORMAT_OPTIONS}
                value={numberFormat}
                onChange={(val) => setNumberFormat(val)}
                searchable={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">First Day of Week</Label>
              <CustomSelect
                options={FIRST_DAY_OPTIONS}
                value={firstDayOfWeek}
                onChange={(val) => setFirstDayOfWeek(val as any)}
                searchable={false}
              />
            </div>
          </div>
        </div>

        {/* Currency Display Preference Card */}
        <div className="p-6 rounded-2xl bg-[#0c080b]/90 border border-white/10 shadow-2xl backdrop-blur-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Personal Currency Display Preference</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Display Currency</Label>
              <CustomSelect
                options={CURRENCY_OPTIONS}
                value={currencyPreference}
                onChange={(val) => setCurrencyPreference(val)}
                searchable={true}
                searchPlaceholder="Search currency..."
                icon={<DollarSign className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-11 px-6 bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/20 transition-all cursor-pointer flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </ProfileLayout>
  );
};
