import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Globe,
  Calendar,
  DollarSign,
  Layout,
  Info,
  Loader2,
} from 'lucide-react';

const TIMEZONES = [
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT) - Lagos, Abuja (GMT+1)' },
  { value: 'Africa/Accra', label: 'Greenwich Mean Time (GMT) - Accra (GMT+0)' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT) - Nairobi (GMT+3)' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (SAST) (GMT+2)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Europe/London', label: 'London, Edinburgh (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Madrid (CET/CEST)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) - Dubai' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
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
      <form onSubmit={handleSave} className="space-y-8">
        {/* Timezone & Language */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#714b67]" />
            Regional Localization
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Time Zone</Label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Language</Label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="en">English (US / UK)</option>
                <option value="fr">Français (French)</option>
                <option value="yo">Yorùbá</option>
                <option value="ha">Hausa</option>
                <option value="ig">Igbo</option>
                <option value="es">Español (Spanish)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date & Number Formats */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Formatting & Units
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Date Format</Label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none font-mono text-xs"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 25/08/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/25/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-25)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Number Format</Label>
              <select
                value={numberFormat}
                onChange={(e) => setNumberFormat(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none font-mono text-xs"
              >
                <option value="1,234.56">1,234.56 (Standard comma)</option>
                <option value="1.234,56">1.234,56 (European dot)</option>
                <option value="1 234.56">1 234.56 (Space separator)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">First Day of Week</Label>
              <select
                value={firstDayOfWeek}
                onChange={(e) => setFirstDayOfWeek(e.target.value as 'monday' | 'sunday')}
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="monday">Monday (Standard business)</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>
        </div>

        {/* Currency Display Preference */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Personal Currency Display Preference
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={currencyPreference}
              onChange={(e) => setCurrencyPreference(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none"
            >
              <option value="NGN">NGN - Nigerian Naira (₦)</option>
              <option value="USD">USD - US Dollar ($)</option>
              <option value="GBP">GBP - British Pound (£)</option>
              <option value="EUR">EUR - Euro (€)</option>
              <option value="GHS">GHS - Ghanaian Cedi (GH₵)</option>
              <option value="KES">KES - Kenyan Shilling (KSh)</option>
              <option value="ZAR">ZAR - South African Rand (R)</option>
            </select>
          </div>

          <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Important distinction:</strong> Your personal currency preference is for analytical display. Workspace accounting currencies control real store sales, inventory valuation, and invoices.
            </span>
          </div>
        </div>

        {/* Theme & Layout Density */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layout className="w-4 h-4 text-pink-400" />
            Display Theme & Density
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Interface Theme</Label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                      theme === t
                        ? 'border-[#714b67] bg-[#714b67]/20 text-white shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Table & List Density</Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setLayoutDensity(d)}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                      layoutDensity === d
                        ? 'border-[#714b67] bg-[#714b67]/20 text-white shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end border-t border-white/10">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs px-6"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving Preferences...
              </>
            ) : (
              'Save All Preferences'
            )}
          </Button>
        </div>
      </form>
    </ProfileLayout>
  );
};
