import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSidebar, type SettingsNavItem } from '@/components/settings/SettingsSidebar';
import { WorkspaceContextHeader } from '@/components/settings/WorkspaceContextHeader';
import { LogoUploader } from '@/components/settings/LogoUploader';
import { AddressForm, type NigerianAddress } from '@/components/location/AddressForm';
import { AuditLogTable, type AuditLogRecord } from '@/components/settings/AuditLogTable';
import { DangerZone } from '@/components/settings/DangerZone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Building2,
  Briefcase,
  MapPin,
  Palette,
  Globe,
  Bell,
  Grid,
  Users,
  ScrollText,
  AlertTriangle,
  Loader2,
  Save,
} from 'lucide-react';

export const WorkspaceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace, fetchWorkspaces } = useWorkspaceStore();

  const tabParam = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const activeMembership =
    memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  const workspaceId = activeMembership?.organization?.id || currentWorkspace?.id;
  const isOwner = activeMembership?.role === 'OWNER';
  const isOwnerOrAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [generalForm, setGeneralForm] = useState({
    name: '',
    displayName: '',
    slug: '',
    type: 'retail',
    category: '',
    description: '',
  });

  const [businessForm, setBusinessForm] = useState({
    email: '',
    phone: '',
    category: '',
    description: '',
  });

  const [addressForm, setAddressForm] = useState<NigerianAddress>({
    country: 'Nigeria',
    state: 'Lagos',
    stateCode: 'LA',
    lga: 'Ikeja',
    city: 'Ikeja',
    street: '',
    blockNumber: '',
    area: '',
    landmark: '',
    postalCode: '',
  });

  const [brandingForm, setBrandingForm] = useState({
    logoUrl: '',
    logoStorageId: '',
    faviconUrl: '',
    primaryColor: '#714b67',
    secondaryColor: '#FDB02F',
  });

  const [localizationForm, setLocalizationForm] = useState({
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    country: 'Nigeria',
    defaultLanguage: 'en',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'standard',
    weekStartsOn: 'monday',
  });

  const [notificationsForm, setNotificationsForm] = useState({
    defaultNotificationMode: 'all',
  });

  const [applications, setApplications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // Sync tab with URL
  useEffect(() => {
    if (tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabSelect = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Fetch Full Settings
  const loadSettings = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ data: { settings: any } }>(`/workspaces/${workspaceId}/settings`);
      const s = res.data?.settings;
      if (s) {
        setGeneralForm({
          name: s.name || '',
          displayName: s.displayName || s.name || '',
          slug: s.slug || '',
          type: s.type || 'retail',
          category: s.category || '',
          description: s.description || '',
        });
        setBusinessForm({
          email: s.email || '',
          phone: s.phone || '',
          category: s.category || '',
          description: s.description || '',
        });
        setAddressForm({
          country: s.country || 'Nigeria',
          state: s.state || 'Lagos',
          lga: 'Ikeja',
          city: s.city || 'Ikeja',
          street: s.addressLine1 || '',
          blockNumber: '',
          area: '',
          landmark: '',
          postalCode: s.postalCode || '',
        });
        setBrandingForm({
          logoUrl: s.logoUrl || '',
          logoStorageId: s.logoStorageId || '',
          faviconUrl: s.faviconUrl || '',
          primaryColor: s.primaryColor || '#714b67',
          secondaryColor: s.secondaryColor || '#FDB02F',
        });
        setLocalizationForm({
          currency: s.currency || 'NGN',
          timezone: s.timezone || 'Africa/Lagos',
          country: s.country || 'Nigeria',
          defaultLanguage: s.defaultLanguage || 'en',
          dateFormat: s.dateFormat || 'YYYY-MM-DD',
          numberFormat: s.numberFormat || 'standard',
          weekStartsOn: s.weekStartsOn || 'monday',
        });
        setNotificationsForm({
          defaultNotificationMode: s.defaultNotificationMode || 'all',
        });
      }

      // Fetch Applications
      try {
        const appsRes = await api.get<{ data: { applications: any[] } }>(`/workspaces/${workspaceId}/applications`);
        setApplications(appsRes.data?.applications || []);
      } catch {}

      // Fetch Audit Logs
      try {
        const auditRes = await api.get<{ data?: { logs: any[] }; logs?: any[] }>(`/organizations/${workspaceId}/audit`);
        const rawLogs = auditRes.data?.logs || auditRes.logs || [];
        setAuditLogs(
          rawLogs.map((l: any) => ({
            id: l._id || l.id || Math.random().toString(),
            eventType: l.eventType || l.action || 'settings.updated',
            action: l.action,
            actorName: l.actorName || l.actorUserId,
            actorEmail: l.actorEmail,
            createdAt: l.createdAt || l.timestamp || Date.now(),
            ipAddress: l.ipAddress,
            reason: l.reason || l.metadata?.description,
            beforeValues: l.beforeValues || l.metadata?.before,
            afterValues: l.afterValues || l.metadata?.after,
          }))
        );
      } catch {}
    } catch (err: any) {
      toast.error('Failed to load organization settings: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save Handlers
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/settings/general`, generalForm);
      toast.success('General settings saved.');
      fetchWorkspaces().catch(() => {});
    } catch (err: any) {
      toast.error('Failed to save general settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/settings/business`, businessForm);
      toast.success('Business information updated.');
    } catch (err: any) {
      toast.error('Failed to save business info: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/settings/address`, {
        country: addressForm.country,
        state: addressForm.state,
        city: addressForm.city,
        addressLine1: [addressForm.blockNumber ? `Block ${addressForm.blockNumber}` : '', addressForm.street].filter(Boolean).join(', '),
        addressLine2: addressForm.area || addressForm.landmark || '',
        postalCode: addressForm.postalCode,
      });
      toast.success('Organization address updated.');
    } catch (err: any) {
      toast.error('Failed to save address: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/settings/branding`, brandingForm);
      toast.success('Branding & colors updated.');
      fetchWorkspaces().catch(() => {});
    } catch (err: any) {
      toast.error('Failed to save branding: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLocalization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/settings/localization`, localizationForm);
      toast.success('Localization preferences saved.');
    } catch (err: any) {
      toast.error('Failed to save localization: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/settings/notifications`, notificationsForm);
      toast.success('Notification preferences updated.');
    } catch (err: any) {
      toast.error('Failed to save notifications: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleApplication = async (productKey: string, currentStatus: string) => {
    if (!workspaceId) return;
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    try {
      await api.post(`/workspaces/${workspaceId}/applications/${productKey}/${action}`);
      toast.success(`Application ${productKey} ${action}d successfully.`);
      loadSettings();
    } catch (err: any) {
      toast.error(`Failed to ${action} application: ` + err.message);
    }
  };

  // Nav items definition
  const navItems: SettingsNavItem[] = [
    { id: 'general', label: 'General & Profile', icon: Building2 },
    { id: 'business', label: 'Business Details', icon: Briefcase },
    { id: 'address', label: 'Headquarters Address', icon: MapPin },
    { id: 'branding', label: 'Branding & Logo', icon: Palette },
    { id: 'localization', label: 'Localization & Currency', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'applications', label: 'Applications & Modules', icon: Grid, badge: applications.length || undefined },
    { id: 'team', label: 'Members & Roles', icon: Users },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
    { id: 'danger', label: 'Data & Retention', icon: AlertTriangle, danger: true },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin" />
        <p className="text-xs text-slate-400">Loading organization settings...</p>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Organization Settings"
      subtitle="Manage workspace profile, branding, team access, and regional rules"
      contextTag="Organization"
      sidebar={
        <SettingsSidebar
          items={navItems}
          activeId={activeTab}
          onSelect={handleTabSelect}
          header={<WorkspaceContextHeader />}
        />
      }
    >
      {/* 1. General Tab */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">General Information</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Public name, business categorization, and workspace identification.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Legal Organization Name *</Label>
              <Input
                value={generalForm.name}
                onChange={(e) => setGeneralForm({ ...generalForm, name: e.target.value })}
                required
                disabled={!isOwnerOrAdmin}
                className="bg-black/40 border-white/10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Display Name / Trade Name</Label>
              <Input
                value={generalForm.displayName}
                onChange={(e) => setGeneralForm({ ...generalForm, displayName: e.target.value })}
                placeholder="e.g. Code X Stores"
                disabled={!isOwnerOrAdmin}
                className="bg-black/40 border-white/10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Organization Slug</Label>
              <Input
                value={generalForm.slug}
                onChange={(e) => setGeneralForm({ ...generalForm, slug: e.target.value })}
                disabled={!isOwner}
                className="bg-black/40 border-white/10 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500">
                Unique tenant handle. Slug changes require owner privileges.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Business Model Type</Label>
              <select
                value={generalForm.type}
                onChange={(e) => setGeneralForm({ ...generalForm, type: e.target.value })}
                disabled={!isOwnerOrAdmin}
                className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="retail">Retail & Point of Sale</option>
                <option value="wholesale">Wholesale & Distribution</option>
                <option value="services">Services & Consulting</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="general">General Commerce</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-slate-200">Business Description</Label>
              <textarea
                value={generalForm.description}
                onChange={(e) => setGeneralForm({ ...generalForm, description: e.target.value })}
                rows={3}
                placeholder="A brief overview of your business operations..."
                disabled={!isOwnerOrAdmin}
                className="w-full p-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
              />
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save General Settings
              </Button>
            </div>
          )}
        </form>
      )}

      {/* 2. Business Details Tab */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveBusiness} className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Business Contact & Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Official business contact information used for customer invoices and invitations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Official Business Email</Label>
              <Input
                type="email"
                value={businessForm.email}
                onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                placeholder="contact@company.com"
                disabled={!isOwnerOrAdmin}
                className="bg-black/40 border-white/10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Official Business Phone</Label>
              <Input
                type="tel"
                value={businessForm.phone}
                onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                placeholder="+234 800 000 0000"
                disabled={!isOwnerOrAdmin}
                className="bg-black/40 border-white/10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Primary Industry Category</Label>
              <Input
                value={businessForm.category}
                onChange={(e) => setBusinessForm({ ...businessForm, category: e.target.value })}
                placeholder="e.g. Supermarket, Pharmacy, Electronics"
                disabled={!isOwnerOrAdmin}
                className="bg-black/40 border-white/10 text-xs"
              />
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Business Profile
              </Button>
            </div>
          )}
        </form>
      )}

      {/* 3. Address Tab */}
      {activeTab === 'address' && (
        <form onSubmit={handleSaveAddress} className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Headquarters Address</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Structured Nigerian address for headquarters registration and tax compliance.
            </p>
          </div>

          <AddressForm
            value={addressForm}
            onChange={setAddressForm}
            disabled={!isOwnerOrAdmin}
          />

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Address
              </Button>
            </div>
          )}
        </form>
      )}

      {/* 4. Branding Tab */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBranding} className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Branding & Logo</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual identity rendered across application headers, receipts, and email invitations.
            </p>
          </div>

          <LogoUploader
            value={brandingForm.logoUrl}
            onChange={(url, storageId) => setBrandingForm({ ...brandingForm, logoUrl: url, logoStorageId: storageId || '' })}
            onRemove={() => setBrandingForm({ ...brandingForm, logoUrl: '', logoStorageId: '' })}
            disabled={!isOwnerOrAdmin}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Primary Brand Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandingForm.primaryColor}
                  onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                  disabled={!isOwnerOrAdmin}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                />
                <Input
                  value={brandingForm.primaryColor}
                  onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                  disabled={!isOwnerOrAdmin}
                  className="bg-black/40 border-white/10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Secondary Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandingForm.secondaryColor}
                  onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                  disabled={!isOwnerOrAdmin}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                />
                <Input
                  value={brandingForm.secondaryColor}
                  onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                  disabled={!isOwnerOrAdmin}
                  className="bg-black/40 border-white/10 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Branding
              </Button>
            </div>
          )}
        </form>
      )}

      {/* 5. Localization Tab */}
      {activeTab === 'localization' && (
        <form onSubmit={handleSaveLocalization} className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Localization & Regional Rules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Accounting currency, timezone calculation, and calendar formats.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Operating Currency (ISO Code) *</Label>
              <select
                value={localizationForm.currency}
                onChange={(e) => setLocalizationForm({ ...localizationForm, currency: e.target.value })}
                disabled={!isOwner}
                className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none font-mono"
              >
                <option value="NGN">NGN - Nigerian Naira (₦)</option>
                <option value="USD">USD - US Dollar ($)</option>
                <option value="GBP">GBP - British Pound (£)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="GHS">GHS - Ghanaian Cedi (GH₵)</option>
                <option value="KES">KES - Kenyan Shilling (KSh)</option>
              </select>
              <p className="text-[10px] text-amber-400">
                Operating currency governs all stock pricing, sales totals, and inventory ledger records.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Timezone (IANA)</Label>
              <select
                value={localizationForm.timezone}
                onChange={(e) => setLocalizationForm({ ...localizationForm, timezone: e.target.value })}
                disabled={!isOwnerOrAdmin}
                className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
                <option value="Africa/Accra">Africa/Accra (GMT, UTC+0)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST, UTC+2)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Date Format</Label>
              <select
                value={localizationForm.dateFormat}
                onChange={(e) => setLocalizationForm({ ...localizationForm, dateFormat: e.target.value })}
                disabled={!isOwnerOrAdmin}
                className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">First Day of the Week</Label>
              <select
                value={localizationForm.weekStartsOn}
                onChange={(e) => setLocalizationForm({ ...localizationForm, weekStartsOn: e.target.value })}
                disabled={!isOwnerOrAdmin}
                className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Localization
              </Button>
            </div>
          )}
        </form>
      )}

      {/* 6. Notifications Tab */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveNotifications} className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Notification Preferences</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Control workspace-level alerts, low-stock threshold triggers, and billing summaries.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { id: 'all', title: 'All Activity Notifications', desc: 'Receive real-time notifications for team invites, stock alerts, and invoice payments.' },
              { id: 'critical_only', title: 'Critical Only', desc: 'Receive only security alerts, failed synchronization, and low-stock out-of-stock events.' },
              { id: 'digest_daily', title: 'Daily Digest', desc: 'Receive a daily consolidated email summary of sales and inventory activity.' },
            ].map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-black/30 cursor-pointer hover:bg-white/[0.02]"
              >
                <input
                  type="radio"
                  name="notificationMode"
                  value={opt.id}
                  checked={notificationsForm.defaultNotificationMode === opt.id}
                  onChange={(e) => setNotificationsForm({ ...notificationsForm, defaultNotificationMode: e.target.value })}
                  className="mt-1"
                />
                <div>
                  <div className="text-xs font-bold text-white">{opt.title}</div>
                  <div className="text-[11px] text-slate-400">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Preferences
              </Button>
            </div>
          )}
        </form>
      )}

      {/* 7. Applications Catalog Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white">Application Catalog & Modules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enable or suspend product modules for this organization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {applications.map((app) => {
              const isActive = app.status === 'active';

              return (
                <div
                  key={app.key}
                  className="p-5 rounded-2xl border border-white/10 bg-black/40 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {app.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }`}
                      >
                        {isActive ? 'Active' : 'Available'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{app.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Category: {app.category}
                    </span>

                    {isOwnerOrAdmin && (
                      <Button
                        type="button"
                        variant={isActive ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToggleApplication(app.key, app.status)}
                        className={`h-8 text-xs font-semibold ${
                          isActive
                            ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                            : 'bg-[#714b67] hover:bg-[#86597a] text-white shadow-lg shadow-[#714b67]/25'
                        }`}
                      >
                        {isActive ? 'Deactivate' : 'Activate Module'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Team & Roles Redirect Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="border-b border-white/10 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Members & Role Management</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage organization memberships, invite teammates, and set granular role privileges.
              </p>
            </div>
            <Button
              onClick={() => navigate('/settings/members')}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold"
            >
              Open Team Manager
            </Button>
          </div>

          <div className="p-8 text-center bg-black/20 border border-white/5 rounded-2xl space-y-3">
            <Users className="w-10 h-10 text-[#e6a8d6] mx-auto" />
            <h3 className="text-sm font-bold text-white">Team Directory</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Use the centralized Team Manager to manage invitations, cross-organization teammates, and branch assignments.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/members')}
              className="border-white/10 text-xs"
            >
              Manage Team & Invitations
            </Button>
          </div>
        </div>
      )}

      {/* 9. Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="animate-in fade-in duration-150">
          <AuditLogTable logs={auditLogs} onRefresh={loadSettings} />
        </div>
      )}

      {/* 10. Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="animate-in fade-in duration-150">
          <DangerZone
            organizationName={generalForm.name}
            isOwner={isOwner}
            onExportData={async () => {
              const res = await api.get(`/workspaces/${workspaceId}/settings`);
              const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${generalForm.slug || 'organization'}-export-${Date.now()}.json`;
              a.click();
            }}
            onArchive={async (reason) => {
              await api.post(`/organizations/${workspaceId}/archive`, { reason });
              toast.success('Organization archived.');
              navigate('/dashboard');
            }}
            onDeleteRequest={async (reason) => {
              await api.post(`/organizations/${workspaceId}/delete-request`, { reason });
              toast.success('Deletion request submitted.');
              navigate('/dashboard');
            }}
          />
        </div>
      )}
    </SettingsLayout>
  );
};
