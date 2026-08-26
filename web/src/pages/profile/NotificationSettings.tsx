import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Shield,
  Layers,
  CreditCard,
  Megaphone,
  Lock,
  Loader2,
} from 'lucide-react';

interface NotificationPrefs {
  marketingEmailEnabled: boolean;
  productEmailEnabled: boolean;
  securityEmailEnabled: boolean;
  inventoryAlertsEnabled: boolean;
  taskRemindersEnabled: boolean;
  billingAlertsEnabled: boolean;
}

export const NotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    securityEmailEnabled: true,
    marketingEmailEnabled: true,
    productEmailEnabled: true,
    inventoryAlertsEnabled: true,
    taskRemindersEnabled: true,
    billingAlertsEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        setIsLoading(true);
        const res = await api.get<{ notificationPreferences: NotificationPrefs }>(
          '/users/me/notifications/preferences'
        );
        if (res.notificationPreferences) {
          setPrefs(res.notificationPreferences);
        }
      } catch {
        // Default values
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleToggle = (key: keyof NotificationPrefs) => {
    if (key === 'securityEmailEnabled') return; // Cannot disable security
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/users/me/notifications/preferences', prefs);
      toast.success('Notification preferences updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ProfileLayout
        title="Notification Preferences"
        description="Configure your personal alerts, digests, and email notifications."
        activeSection="notifications"
      >
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading preferences...</span>
        </div>
      </ProfileLayout>
    );
  }

  return (
    <ProfileLayout
      title="Notification Preferences"
      description="Choose how and when Orvio contacts you. Security alerts are always active to protect your account."
      activeSection="notifications"
    >
      <div className="space-y-8">
        {/* Security Category (Locked) */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Security & Account Alerts</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Mandatory
                  </span>
                </h4>
                <p className="text-xs text-slate-400">
                  New login from unknown device, password changes, email changes, session revocations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Always Enabled</span>
            </div>
          </div>
        </div>

        {/* Product & Operational Alerts */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Product & Work Operations</h4>
              <p className="text-xs text-slate-400">Alerts from products you actively use in workspaces.</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <div>
                <div className="text-xs font-medium text-white">Inventory Low Stock & Sync Alerts</div>
                <div className="text-[11px] text-slate-400">
                  Receive notifications when items hit minimum thresholds or sync issues occur.
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.inventoryAlertsEnabled}
                onChange={() => handleToggle('inventoryAlertsEnabled')}
                className="accent-[#714b67] w-4 h-4 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <div>
                <div className="text-xs font-medium text-white">Task Management & Reminders</div>
                <div className="text-[11px] text-slate-400">
                  Assigned task updates, due date reminders, and team activity mentions.
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.taskRemindersEnabled}
                onChange={() => handleToggle('taskRemindersEnabled')}
                className="accent-[#714b67] w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Workspace & Billing */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Workspace & Billing</h4>
              <p className="text-xs text-slate-400">Invoices, payment receipts, and membership updates.</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <div>
                <div className="text-xs font-medium text-white">Billing & Payment Invoices</div>
                <div className="text-[11px] text-slate-400">
                  Payment success, subscription renewals, and failed payment alerts.
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.billingAlertsEnabled}
                onChange={() => handleToggle('billingAlertsEnabled')}
                className="accent-[#714b67] w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Marketing & Announcements */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Marketing & Product Updates</h4>
              <p className="text-xs text-slate-400">Optional product news, educational tips, and new features.</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <div>
                <div className="text-xs font-medium text-white">Product Announcements & Features</div>
                <div className="text-[11px] text-slate-400">
                  Stay updated with quarterly major feature releases and platform tips.
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.marketingEmailEnabled}
                onChange={() => handleToggle('marketingEmailEnabled')}
                className="accent-[#714b67] w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="pt-4 flex justify-end border-t border-white/10">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs px-6"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </div>
    </ProfileLayout>
  );
};
