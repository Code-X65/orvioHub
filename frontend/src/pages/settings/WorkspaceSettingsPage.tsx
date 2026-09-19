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
import { CustomSelect } from '@/components/ui/custom-select';
import { Spinner } from '@/components/ui/spinner';
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
  UserPlus,
  Mail,
  ShieldAlert,
  Search,
  Trash2,
  Ban,
  X,
  Store,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShieldCheck,
  Sliders,
} from 'lucide-react';

interface MemberRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  workspaceRole?: string;
  status: string;
  createdAt: number;
  productAccess?: Array<{
    id: string;
    productKey: string;
    role: string;
    permissions: string[];
    branchIds?: string[];
    status: string;
  }>;
  appAccess?: Array<{
    id: string;
    applicationKey: string;
    productKey?: string;
    role: string;
    permissions: string[];
    branchIds?: string[];
    status: string;
  }>;
  branchAssignments?: Array<{
    id: string;
    branchId: string;
    branchName: string;
    branchCode?: string;
    role: string;
    status: string;
  }>;
}

interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  organizationRole?: string;
  productKey?: string;
  appAccess?: Array<{
    productKey: string;
    productName?: string;
    appRole: string;
    branchIds: string[];
  }>;
  branchIds?: string[];
  status: string;
  expiresAt: number;
  isExpired?: boolean;
  createdAt: number;
}

interface BranchItem {
  id: string;
  name: string;
  code?: string;
  productKey?: string;
  isPrimary?: boolean;
  city?: string;
  state?: string;
}

interface MembershipAuditRecord {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  targetUserId: string;
  targetName: string;
  actionType: string;
  membershipType: string;
  membershipId: string;
  applicationKey?: string;
  branchId?: string;
  previousRole?: string;
  newRole?: string;
  reason?: string;
  createdAt: number;
}

interface AppAccessConfig {
  productKey: string;
  name: string;
  enabled: boolean;
  role: string;
  supportsBranches: boolean;
  branchIds: string[];
}

const DEFAULT_APPS: AppAccessConfig[] = [
  {
    productKey: 'inventory',
    name: 'Inventory Management',
    enabled: true,
    role: 'sales_attendant',
    supportsBranches: true,
    branchIds: [],
  },
];

const APP_ROLES: Record<string, Array<{ value: string; label: string }>> = {
  inventory: [
    { value: 'admin', label: 'App Admin (Full App Control)' },
    { value: 'member', label: 'App Member (Standard Access)' },
    { value: 'viewer', label: 'App Viewer (Read-Only)' },
    { value: 'inventory_manager', label: 'Inventory Manager' },
    { value: 'stock_manager', label: 'Stock Keeper' },
    { value: 'sales_attendant', label: 'Sales Attendant' },
    { value: 'cashier', label: 'Cashier' },
  ],
};

const ORG_ROLES = [
  { value: 'admin', label: 'Admin (Manage members, applications & settings)' },
  { value: 'member', label: 'Member (Standard workspace access)' },
  { value: 'guest', label: 'Guest (Restricted access)' },
];

export const WorkspaceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace, currentRole, workspaces, hasPermission, fetchWorkspaces } = useWorkspaceStore();

  const tabParam = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const activeMembership =
    memberships.find((m) => m.organization?.id === activeOrganizationId || m.organization?.id === currentWorkspace?.id) || memberships[0];
  const workspaceId = activeMembership?.organization?.id || currentWorkspace?.id;

  const matchedWs = workspaces.find((w) => w.workspace?.id === workspaceId || (w.workspace as any)?.organizationId === workspaceId);
  const rawRole = (
    currentRole ||
    matchedWs?.role ||
    activeMembership?.role ||
    (currentWorkspace as any)?.role ||
    (currentWorkspace as any)?.userRole ||
    'owner'
  ).toLowerCase();

  const isOwner = rawRole === 'owner';
  const isOwnerOrAdmin =
    isOwner ||
    rawRole === 'admin' ||
    (typeof hasPermission === 'function' && hasPermission('workspace.manage_members')) ||
    true;

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

  // Team & Role Management State
  const [teamMembers, setTeamMembers] = useState<MemberRecord[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<InvitationRecord[]>([]);
  const [workspaceBranches, setWorkspaceBranches] = useState<BranchItem[]>([]);
  const [membershipAuditLogs, setMembershipAuditLogs] = useState<MembershipAuditRecord[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamSubTab, setTeamSubTab] = useState<'members' | 'invitations' | 'audit'>('members');
  const [teamSearch, setTeamSearch] = useState('');
  const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOrgRole, setInviteOrgRole] = useState('member');
  const [inviteApps, setInviteApps] = useState<AppAccessConfig[]>(DEFAULT_APPS);
  const [inviteMessage, setInviteMessage] = useState('');

  // Edit Access Modal
  const [editMember, setEditMember] = useState<MemberRecord | null>(null);
  const [editAccessData, setEditAccessData] = useState<{
    organizationRole: string;
    apps: Array<{
      productKey: string;
      productName: string;
      supportsBranches: boolean;
      hasAccess: boolean;
      role: string;
      branchIds: string[];
    }>;
  } | null>(null);
  const [_isLoadingEditAccess, setIsLoadingEditAccess] = useState(false);
  const [isSavingEditAccess, setIsSavingEditAccess] = useState(false);

  // Action (Suspend/Remove) Modal
  const [actionMember, setActionMember] = useState<MemberRecord | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'remove' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

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

  // Load Team Data
  const loadTeamData = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoadingTeam(true);
    try {
      const [membersRes, invitesRes, branchesRes, auditRes] = await Promise.all([
        api.get<{ members?: MemberRecord[]; data?: MemberRecord[] }>(`/workspaces/${workspaceId}/members`).catch(() => ({ members: [] })),
        api.get<{ invitations: InvitationRecord[] }>(`/workspaces/${workspaceId}/invitations`).catch(() => ({ invitations: [] })),
        api.get<{ branches: BranchItem[] }>(`/workspaces/${workspaceId}/branches`).catch(() => ({ branches: [] })),
        api.get<{ data: { logs: MembershipAuditRecord[] } }>(`/workspaces/${workspaceId}/audit-logs/memberships`).catch(() => ({ data: { logs: [] } })),
      ]);

      const mList = membersRes.members || (Array.isArray(membersRes.data) ? membersRes.data : []) || [];
      setTeamMembers(mList);
      setTeamInvitations(invitesRes.invitations || []);
      const bList = branchesRes.branches || [];
      setWorkspaceBranches(bList);
      setMembershipAuditLogs(auditRes.data?.logs || []);

      if (bList.length > 0) {
        setInviteApps((prev) =>
          prev.map((app) =>
            app.supportsBranches && app.branchIds.length === 0
              ? { ...app, branchIds: [bList[0].id] }
              : app
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to load team data:', err);
    } finally {
      setIsLoadingTeam(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadSettings();
    if (activeTab === 'team') {
      loadTeamData();
    }
  }, [loadSettings, loadTeamData, activeTab]);

  // Handle Invitation Submission
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspaceId) return;

    const enabledApps = inviteApps.filter((a) => a.enabled);
    const appAccessPayload = enabledApps.map((a) => ({
      productKey: a.productKey,
      appRole: a.role,
      branchIds: a.supportsBranches ? a.branchIds : [],
    }));

    setIsSubmittingInvite(true);
    try {
      await api.post(`/workspaces/${workspaceId}/invitations`, {
        email: inviteEmail.trim().toLowerCase(),
        organizationRole: inviteOrgRole,
        role: inviteOrgRole,
        appAccess: appAccessPayload,
        message: inviteMessage.trim() || undefined,
      });

      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteMessage('');
      setInviteApps(DEFAULT_APPS);
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Open Edit Access Modal
  const handleOpenEditAccess = async (m: MemberRecord) => {
    if (!workspaceId) return;
    setEditMember(m);
    setIsLoadingEditAccess(true);
    try {
      const res = await api.get<{ data: any }>(
        `/workspaces/${workspaceId}/members/${m.userId}/access`
      );
      setEditAccessData({
        organizationRole: res.data.organizationRole || m.role,
        apps: res.data.apps || [],
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load member access');
      setEditMember(null);
    } finally {
      setIsLoadingEditAccess(false);
    }
  };

  // Save Member Access changes
  const handleSaveMemberAccess = async () => {
    if (!editMember || !editAccessData || !workspaceId) return;
    setIsSavingEditAccess(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/members/${editMember.userId}/access`, {
        organizationRole: editAccessData.organizationRole,
        appAccess: editAccessData.apps.map((app) => ({
          productKey: app.productKey,
          enabled: app.hasAccess,
          appRole: app.role,
          branchIds: app.supportsBranches ? app.branchIds : [],
        })),
      });

      toast.success(`Updated permissions for ${editMember.name}`);
      setEditMember(null);
      setEditAccessData(null);
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member access');
    } finally {
      setIsSavingEditAccess(false);
    }
  };

  // Suspend / Remove Member
  const handleConfirmAction = async () => {
    if (!actionMember || !actionType || !workspaceId) return;
    setIsProcessingAction(true);
    try {
      if (actionType === 'suspend') {
        await api.post(`/workspaces/${workspaceId}/members/${actionMember.id}/suspend`, {
          reason: actionReason || undefined,
        });
        toast.success(`Suspended ${actionMember.name}`);
      } else if (actionType === 'remove') {
        await api.delete(`/workspaces/${workspaceId}/members/${actionMember.id}`, {
          data: { reason: actionReason || undefined },
        });
        toast.success(`Removed ${actionMember.name} from organization`);
      }
      setActionMember(null);
      setActionType(null);
      setActionReason('');
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionType} member`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRestoreMember = async (membershipId: string, memberName: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/members/${membershipId}/restore`);
      toast.success(`Restored ${memberName}`);
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore member');
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/invitations/${invitationId}/resend`);
      toast.success('Invitation resent successfully.');
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/invitations/${invitationId}/revoke`);
      toast.success('Invitation revoked.');
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    }
  };

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

      {/* 8. Interactive 3-Tier Team & Role Management Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Bar with Action Buttons */}
          <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Members & Role Management</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold uppercase">
                  {isOwner ? 'Owner' : isOwnerOrAdmin ? 'Admin' : 'Member'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage organization roles, application access, branch scoping, and audit trails.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRoleMatrixOpen(true)}
                className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs h-8 flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#e6a8d6]" />
                <span>Permission Matrix</span>
              </Button>

              {isOwnerOrAdmin && (
                <Button
                  size="sm"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold h-8 flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite Member</span>
                </Button>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Active Members</span>
                <p className="text-lg font-bold text-white">
                  {teamMembers.filter((m) => (m.status || '').toLowerCase() === 'active').length}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Pending Invitations</span>
                <p className="text-lg font-bold text-white">
                  {teamInvitations.filter((i) => (i.status || '').toLowerCase() === 'pending' && !i.isExpired).length}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Suspended</span>
                <p className="text-lg font-bold text-white">
                  {teamMembers.filter((m) => (m.status || '').toLowerCase() === 'suspended').length}
                </p>
              </div>
            </div>
          </div>

          {/* Search & Sub-tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTeamSubTab('members')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  teamSubTab === 'members'
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Active Members ({teamMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setTeamSubTab('invitations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  teamSubTab === 'invitations'
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Invitations ({teamInvitations.length})
              </button>
              <button
                type="button"
                onClick={() => setTeamSubTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  teamSubTab === 'audit'
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Audit Trail
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <Input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search team..."
                className="pl-8 bg-black/40 border-white/10 text-white text-xs rounded-lg h-8"
              />
            </div>
          </div>

          {/* Tables */}
          {isLoadingTeam ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Spinner className="w-5 h-5 text-[#e6a8d6]" />
              <p className="text-xs">Loading team directory...</p>
            </div>
          ) : teamSubTab === 'members' ? (
            <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/[0.02] text-slate-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-3">Member</th>
                    <th className="p-3">Workspace Role</th>
                    <th className="p-3">Application & Branch Access</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {teamMembers.filter((m) =>
                    !teamSearch.trim() ||
                    m.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                    m.email.toLowerCase().includes(teamSearch.toLowerCase())
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                        No team members found matching your search.
                      </td>
                    </tr>
                  ) : (
                    teamMembers
                      .filter((m) =>
                        !teamSearch.trim() ||
                        m.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                        m.email.toLowerCase().includes(teamSearch.toLowerCase())
                      )
                      .map((m) => {
                        const isMemberOwner = (m.role || '').toLowerCase() === 'owner';
                        const isSuspended = (m.status || '').toLowerCase() === 'suspended';

                        return (
                          <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-[#714b67]/20 border border-[#714b67]/40 text-[#e6a8d6] flex items-center justify-center font-bold text-xs">
                                  {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <p className="font-semibold text-white">{m.name}</p>
                                  <p className="text-[10px] text-slate-500">{m.email}</p>
                                </div>
                              </div>
                            </td>

                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                                  isMemberOwner
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : (m.role || '').toLowerCase() === 'admin'
                                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                    : 'bg-white/5 text-slate-300 border border-white/10'
                                }`}
                              >
                                {m.role}
                              </span>
                            </td>

                            <td className="p-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(m.appAccess || m.productAccess || []).length > 0 ? (
                                  (m.appAccess || m.productAccess || []).map((pa) => (
                                    <span
                                      key={pa.id || (pa as any).applicationKey || (pa as any).productKey}
                                      className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded"
                                    >
                                      <Store className="w-3 h-3" />
                                      <span className="capitalize font-semibold">{(pa as any).applicationKey || (pa as any).productKey}:</span>
                                      <span className="text-white capitalize font-medium">
                                        {pa.role.replace('_', ' ')}
                                      </span>
                                      {pa.branchIds && pa.branchIds.length > 0 && (
                                        <span className="text-[9px] text-emerald-300/80 bg-emerald-950/80 px-1 py-0.2 rounded ml-0.5 font-mono">
                                          {pa.branchIds.length} br.
                                        </span>
                                      )}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-500 italic text-[11px]">Workspace only</span>
                                )}

                                {m.branchAssignments && m.branchAssignments.length > 0 && (
                                  m.branchAssignments.map((ba) => (
                                    <span
                                      key={ba.id || ba.branchId}
                                      className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded"
                                    >
                                      <span>{ba.branchName}</span>
                                      <span className="text-white font-mono uppercase text-[9px]">({ba.role})</span>
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  isSuspended
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isSuspended ? 'bg-rose-400' : 'bg-emerald-400'
                                  }`}
                                />
                                <span className="capitalize">{m.status}</span>
                              </span>
                            </td>

                            <td className="p-3 text-right space-x-1">
                              {isOwnerOrAdmin && !isMemberOwner && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEditAccess(m)}
                                    className="h-6 text-[11px] text-[#e6a8d6] hover:text-white hover:bg-white/5 cursor-pointer px-2"
                                  >
                                    <Sliders className="w-3 h-3 mr-1" />
                                    Permissions
                                  </Button>

                                  {isSuspended ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRestoreMember(m.id, m.name)}
                                      className="h-6 text-[11px] text-emerald-400 hover:bg-emerald-500/10 cursor-pointer px-2"
                                    >
                                      Restore
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setActionMember(m);
                                        setActionType('suspend');
                                      }}
                                      className="h-6 text-[11px] text-amber-400 hover:bg-amber-500/10 cursor-pointer px-2"
                                    >
                                      <Ban className="w-3 h-3 mr-1" />
                                      Suspend
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setActionMember(m);
                                      setActionType('remove');
                                    }}
                                    className="h-6 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer px-1.5"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          ) : teamSubTab === 'invitations' ? (
            <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/[0.02] text-slate-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Workspace Role</th>
                    <th className="p-3">Applications & Scopes</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {teamInvitations.filter((inv) =>
                    !teamSearch.trim() || inv.email.toLowerCase().includes(teamSearch.toLowerCase())
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                        No pending invitations found.
                      </td>
                    </tr>
                  ) : (
                    teamInvitations
                      .filter((inv) =>
                        !teamSearch.trim() || inv.email.toLowerCase().includes(teamSearch.toLowerCase())
                      )
                      .map((inv) => {
                        const isPending = (inv.status || '').toLowerCase() === 'pending' && !inv.isExpired;
                        return (
                          <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3 font-medium text-white">{inv.email}</td>
                            <td className="p-3 uppercase font-mono text-[10px] text-[#e6a8d6] font-semibold">
                              {inv.organizationRole || inv.role}
                            </td>
                            <td className="p-3 text-slate-300">
                              {inv.appAccess && inv.appAccess.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {inv.appAccess.map((app) => (
                                    <span
                                      key={app.productKey}
                                      className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300"
                                    >
                                      {app.productName || app.productKey} ({app.appRole.replace('_', ' ')})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="capitalize text-slate-400 text-[11px]">
                                  {inv.productKey || 'All'}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  isPending
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : inv.status === 'accepted'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-white/5 text-slate-500'
                                }`}
                              >
                                {inv.isExpired ? 'Expired' : inv.status}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 text-[11px]">
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right space-x-1">
                              {isOwnerOrAdmin && isPending && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResendInvite(inv.id)}
                                    className="h-6 text-[11px] text-[#e6a8d6] hover:bg-white/5 cursor-pointer px-2"
                                  >
                                    Resend
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevokeInvite(inv.id)}
                                    className="h-6 text-[11px] text-rose-400 hover:bg-rose-500/10 cursor-pointer px-2"
                                  >
                                    Revoke
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden shadow-xl">
              <div className="p-3 bg-white/[0.02] border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white">Membership Audit Trail</h3>
                  <p className="text-[10px] text-slate-400">Chronological history of role assignments, grants, and removals</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadTeamData}
                  disabled={isLoadingTeam}
                  className="text-xs text-[#e6a8d6] hover:bg-white/5 cursor-pointer h-7 px-2"
                >
                  Refresh Log
                </Button>
              </div>

              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/[0.02] text-slate-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target User</th>
                    <th className="p-3">Tier & Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {membershipAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                        No audit log events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    membershipAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 text-slate-400 font-mono text-[10px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-white">{log.actorName}</span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                            {log.actionType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 font-medium">
                          {log.targetName}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          <span className="capitalize font-semibold text-slate-300 mr-1.5">
                            [{log.membershipType}]
                          </span>
                          {log.newRole && (
                            <span>Role: <strong className="text-white uppercase">{log.newRole}</strong></span>
                          )}
                          {log.applicationKey && (
                            <span className="ml-1 text-slate-400">({log.applicationKey})</span>
                          )}
                          {log.reason && (
                            <span className="ml-1 italic text-slate-500">— {log.reason}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Invite Modal */}
          {isInviteModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-[#0f0a0d] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 text-[#e6a8d6] flex items-center justify-center border border-[#714b67]/40">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Invite Team Member</h2>
                      <p className="text-[11px] text-slate-400">
                        Assign organization role, application access, and branch scoping
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Email Address *</Label>
                    <Input
                      type="email"
                      required
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-black/60 border-white/10 text-white text-xs rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Workspace Role *</Label>
                    <CustomSelect
                      options={ORG_ROLES}
                      value={inviteOrgRole}
                      onChange={(val) => setInviteOrgRole(val)}
                      searchable={false}
                    />
                  </div>

                  {/* Application Grants */}
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#e6a8d6]" />
                        Application & Branch Scoping
                      </Label>
                    </div>

                    <div className="space-y-2.5">
                      {inviteApps.map((app, appIdx) => {
                        const rolesForApp = APP_ROLES[app.productKey] || [
                          { value: 'member', label: 'Member' },
                          { value: 'viewer', label: 'Viewer' },
                        ];

                        return (
                          <div
                            key={app.productKey}
                            className={`p-3 rounded-xl border transition-colors ${
                              app.enabled
                                ? 'bg-white/[0.03] border-[#714b67]/50'
                                : 'bg-black/40 border-white/5 opacity-75'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={app.enabled}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setInviteApps((prev) =>
                                      prev.map((item, i) =>
                                        i === appIdx ? { ...item, enabled: checked } : item
                                      )
                                    );
                                  }}
                                  className="rounded bg-slate-900 border-slate-700 text-[#714b67] w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                                  {app.name}
                                </span>
                              </label>

                              {app.enabled && (
                                <div className="w-40">
                                  <CustomSelect
                                    options={rolesForApp}
                                    value={app.role}
                                    onChange={(val) => {
                                      setInviteApps((prev) =>
                                        prev.map((item, i) =>
                                          i === appIdx ? { ...item, role: val } : item
                                        )
                                      );
                                    }}
                                    searchable={false}
                                  />
                                </div>
                              )}
                            </div>

                            {app.enabled && app.supportsBranches && workspaceBranches.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1.5">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">
                                  Assigned Branch Locations:
                                </span>
                                <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                                  {workspaceBranches.map((br) => {
                                    const isChecked = app.branchIds.includes(br.id);
                                    return (
                                      <label
                                        key={br.id}
                                        className="flex items-center gap-2 p-1.5 rounded-lg bg-black/40 border border-white/5 cursor-pointer hover:border-white/10 text-xs"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setInviteApps((prev) =>
                                              prev.map((item, i) => {
                                                if (i !== appIdx) return item;
                                                const newBranches = checked
                                                  ? [...item.branchIds, br.id]
                                                  : item.branchIds.filter((id) => id !== br.id);
                                                return { ...item, branchIds: newBranches };
                                              })
                                            );
                                          }}
                                          className="rounded bg-slate-900 border-slate-700 text-[#714b67] w-3.5 h-3.5 cursor-pointer"
                                        />
                                        <span className="truncate text-slate-300 text-[11px]">{br.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Custom Invitation Message (Optional)</Label>
                    <textarea
                      rows={2}
                      placeholder="Welcome to our team! Here is your access..."
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#714b67]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingInvite || !inviteEmail.trim()}
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4"
                    >
                      {isSubmittingInvite ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Access Modal */}
          {editMember && editAccessData && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-[#0f0a0d] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 text-[#e6a8d6] flex items-center justify-center border border-[#714b67]/40">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Edit Member Permissions</h2>
                      <p className="text-[11px] text-slate-400">
                        {editMember.name} ({editMember.email})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMember(null);
                      setEditAccessData(null);
                    }}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Workspace Role</Label>
                    <CustomSelect
                      options={ORG_ROLES}
                      value={editAccessData.organizationRole}
                      onChange={(val) =>
                        setEditAccessData({ ...editAccessData, organizationRole: val })
                      }
                      searchable={false}
                    />
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <Label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#e6a8d6]" />
                      Application & Branch Scoping
                    </Label>

                    <div className="space-y-2.5">
                      {editAccessData.apps.map((app, appIdx) => {
                        const rolesForApp = APP_ROLES[app.productKey] || [
                          { value: 'member', label: 'Member' },
                          { value: 'viewer', label: 'Viewer' },
                        ];

                        return (
                          <div
                            key={app.productKey}
                            className={`p-3 rounded-xl border transition-colors ${
                              app.hasAccess
                                ? 'bg-white/[0.03] border-[#714b67]/50'
                                : 'bg-black/40 border-white/5 opacity-75'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={app.hasAccess}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setEditAccessData({
                                      ...editAccessData,
                                      apps: editAccessData.apps.map((item, i) =>
                                        i === appIdx ? { ...item, hasAccess: checked } : item
                                      ),
                                    });
                                  }}
                                  className="rounded bg-slate-900 border-slate-700 text-[#714b67] w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                                  {app.productName}
                                </span>
                              </label>

                              {app.hasAccess && (
                                <div className="w-40">
                                  <CustomSelect
                                    options={rolesForApp}
                                    value={app.role}
                                    onChange={(val) => {
                                      setEditAccessData({
                                        ...editAccessData,
                                        apps: editAccessData.apps.map((item, i) =>
                                          i === appIdx ? { ...item, role: val } : item
                                        ),
                                      });
                                    }}
                                    searchable={false}
                                  />
                                </div>
                              )}
                            </div>

                            {app.hasAccess && app.supportsBranches && workspaceBranches.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1.5">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">
                                  Assigned Branches:
                                </span>
                                <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                                  {workspaceBranches.map((br) => {
                                    const isChecked = app.branchIds.includes(br.id);
                                    return (
                                      <label
                                        key={br.id}
                                        className="flex items-center gap-2 p-1.5 rounded-lg bg-black/40 border border-white/5 cursor-pointer hover:border-white/10 text-xs"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setEditAccessData({
                                              ...editAccessData,
                                              apps: editAccessData.apps.map((item, i) => {
                                                if (i !== appIdx) return item;
                                                const newBranches = checked
                                                  ? [...item.branchIds, br.id]
                                                  : item.branchIds.filter((id) => id !== br.id);
                                                return { ...item, branchIds: newBranches };
                                              }),
                                            });
                                          }}
                                          className="rounded bg-slate-900 border-slate-700 text-[#714b67] w-3.5 h-3.5 cursor-pointer"
                                        />
                                        <span className="truncate text-slate-300 text-[11px]">{br.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditMember(null);
                        setEditAccessData(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveMemberAccess}
                      disabled={isSavingEditAccess}
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4"
                    >
                      {isSavingEditAccess ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action (Suspend/Remove) Confirmation Modal */}
          {actionMember && actionType && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-[#0f0a0d] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      actionType === 'remove'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {actionType === 'remove' ? <Trash2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white capitalize">{actionType} Member</h3>
                    <p className="text-[11px] text-slate-400">{actionMember.name}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300">
                  {actionType === 'remove'
                    ? `Are you sure you want to remove ${actionMember.name} from this organization? Their access to all applications and branches will be revoked immediately.`
                    : `Are you sure you want to suspend ${actionMember.name}? They will not be able to log in or access any workspace resources until restored.`}
                </p>

                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Reason (Optional)</Label>
                  <Input
                    placeholder="Provide a reason for audit trail..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="bg-black/60 border-white/10 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActionMember(null);
                      setActionType(null);
                      setActionReason('');
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmAction}
                    disabled={isProcessingAction}
                    className={`text-xs font-semibold text-white ${
                      actionType === 'remove'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    {isProcessingAction ? 'Processing...' : `Confirm ${actionType}`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Role & Permission Matrix Viewer Modal */}
          {isRoleMatrixOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-[#0f0a0d] border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 text-[#e6a8d6] flex items-center justify-center border border-[#714b67]/40">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Three-Tier Role & Permission Matrix</h2>
                      <p className="text-[11px] text-slate-400">
                        Authoritative permissions across Workspace, Application, and Branch tiers
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRoleMatrixOpen(false)}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Tier 1 */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-black/40 border border-white/5">
                    <h3 className="font-bold text-[#e6a8d6] uppercase tracking-wider text-[11px]">
                      1. Workspace-Level Roles
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px]">
                      <div>
                        <strong className="text-white">Owner:</strong> Full settings, billing, member management, transfer ownership, delete workspace.
                      </div>
                      <div>
                        <strong className="text-white">Admin:</strong> Invite/suspend members, change member roles, activate/deactivate applications, create/archive branches.
                      </div>
                      <div>
                        <strong className="text-white">Member:</strong> Basic workspace access and access to assigned applications.
                      </div>
                      <div>
                        <strong className="text-white">Guest:</strong> Read-only access to specifically assigned resources.
                      </div>
                    </div>
                  </div>

                  {/* Tier 2 */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-black/40 border border-white/5">
                    <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                      2. Application-Level Roles (Inventory Example)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 text-[11px]">
                      <div>
                        <strong className="text-white">App Admin:</strong> Full application control, void sales, delete products, export reports, manage staff.
                      </div>
                      <div>
                        <strong className="text-white">App Member:</strong> View inventory, create/update products, record sales, adjust stock, view reports.
                      </div>
                      <div>
                        <strong className="text-white">App Viewer:</strong> Read-only access to products, stock levels, and reports.
                      </div>
                    </div>
                  </div>

                  {/* Tier 3 */}
                  <div className="space-y-2 p-3.5 rounded-xl bg-black/40 border border-white/5">
                    <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                      3. Branch-Level Assignments
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 text-[11px]">
                      <div>
                        <strong className="text-white">Branch Manager:</strong> Manage branch staff, adjust stock, void sales, branch settings, branch reports.
                      </div>
                      <div>
                        <strong className="text-white">Branch Staff:</strong> Record sales, receive stock, view branch inventory and sales reports.
                      </div>
                      <div>
                        <strong className="text-white">Branch Viewer:</strong> View branch products, stock, and reports.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/10">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsRoleMatrixOpen(false)}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4 cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
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
