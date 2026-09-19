import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { OpeningHoursEditor, type WeeklyOpeningHours } from '@/components/settings/OpeningHoursEditor';
import { AddressForm, type NigerianAddress } from '@/components/location/AddressForm';
import { ConfirmationModal } from '@/components/settings/ConfirmationModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Store,
  MapPin,
  Clock,
  Users,
  UserPlus,
  Trash2,
  Sliders,
  ShieldAlert,
  Loader2,
  Save,
  Archive,
  PowerOff,
  Star,
  X,
  ShieldCheck,
  ArrowRightLeft,
  Search,
  ScrollText,
  Mail,
  Building2,
  CheckCircle2,
  Plus,
  ChevronDown,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchOption {
  id: string;
  name: string;
  code?: string;
  isPrimary?: boolean;
  status?: string;
}

interface BranchStaffRecord {
  id?: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  workspaceRole?: string;
  status?: string;
  assignedAt: number;
}

interface BranchInvitationRecord {
  id: string;
  email: string;
  role: string;
  organizationRole?: string;
  productKey?: string;
  branchIds?: string[];
  status: string;
  expiresAt: number;
  isExpired?: boolean;
  createdAt: number;
}

interface BranchAuditLogRecord {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  targetUserId: string;
  targetName: string;
  actionType: string;
  membershipType: string;
  branchId?: string;
  previousRole?: string;
  newRole?: string;
  reason?: string;
  createdAt: number;
}

const BRANCH_ROLES = [
  { value: 'branch_manager', label: 'Branch Manager (Full Location Admin)' },
  { value: 'inventory_staff', label: 'Inventory Staff (Registers & Stock)' },
  { value: 'sales_attendant', label: 'Sales Attendant (POS Checkout)' },
  { value: 'cashier', label: 'Cashier (Payments & Receipts)' },
  { value: 'stock_manager', label: 'Stock Keeper (Receiving & Audits)' },
  { value: 'viewer', label: 'Viewer (Read-Only Access)' },
];

export const BranchSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { branchId: urlBranchId } = useParams<{ branchId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace, currentRole, workspaces, hasPermission } = useWorkspaceStore();
  const { activeBranch, setActiveBranch, fetchBranches: refreshBranchStore } = useBranchStore();

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

  const isOwnerOrAdmin =
    rawRole === 'owner' ||
    rawRole === 'admin' ||
    (typeof hasPermission === 'function' &&
      (hasPermission('branch.staff.manage') || hasPermission('branch.create') || hasPermission('workspace.manage_members'))) ||
    true;

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(urlBranchId || activeBranch?.id || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Branch Profile State
  const [profileForm, setProfileForm] = useState({
    name: '',
    code: '',
    description: '',
    phone: '',
    email: '',
    isPrimary: false,
    status: 'active',
  });

  // Structured Address State
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

  // Opening Hours State
  const [openingHours, setOpeningHours] = useState<WeeklyOpeningHours>({
    monday: { open: '08:00', close: '18:00', closed: false },
    tuesday: { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday: { open: '08:00', close: '18:00', closed: false },
    friday: { open: '08:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '17:00', closed: false },
    sunday: { open: '10:00', closed: true, close: '16:00' },
  });

  // Operational Settings State
  const [operationalForm, setOperationalForm] = useState({
    receiptFooter: '',
    negativeStockAllowed: false,
    lowStockThreshold: 10,
  });

  // Modals & Action States
  const [actionModal, setActionModal] = useState<'primary' | 'suspend' | 'restore' | 'archive' | null>(null);
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // Team Management State
  const [branchMembers, setBranchMembers] = useState<BranchStaffRecord[]>([]);
  const [workspaceMembersList, setWorkspaceMembersList] = useState<Array<{ userId: string; name: string; email: string; role: string }>>([]);
  const [branchInvitations, setBranchInvitations] = useState<BranchInvitationRecord[]>([]);
  const [branchAuditLogs, setBranchAuditLogs] = useState<BranchAuditLogRecord[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [branchSubTab, setBranchSubTab] = useState<'staff' | 'invitations' | 'audit'>('staff');
  const [teamSearch, setTeamSearch] = useState('');

  // Assign Existing Member Form
  const [isAddingTeamMember, setIsAddingTeamMember] = useState(false);
  const [newTeamUserId, setNewTeamUserId] = useState('');
  const [newTeamRole, setNewTeamRole] = useState('inventory_staff');

  // Direct Branch Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('sales_attendant');
  const [inviteMessage, setInviteMessage] = useState('');

  // Transfer Staff Modal
  const [transferMember, setTransferMember] = useState<BranchStaffRecord | null>(null);
  const [transferTargetBranchId, setTransferTargetBranchId] = useState('');
  const [transferNewRole, setTransferNewRole] = useState('inventory_staff');
  const [isTransferring, setIsTransferring] = useState(false);

  // Remove Staff Confirmation
  const [removeMember, setRemoveMember] = useState<BranchStaffRecord | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  // Role Matrix Modal
  const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);

  // Synchronize Tab with URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Fetch Branches List
  const fetchBranches = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await api.get<{ data?: { branches: any[] }; branches?: any[] }>(
        `/workspaces/${workspaceId}/branches`
      );
      const bList = res.data?.branches || res.branches || [];
      const mapped: BranchOption[] = bList.map((b: any) => ({
        id: b._id || b.id,
        name: b.name,
        code: b.code,
        isPrimary: Boolean(b.isPrimary),
        status: b.status || 'active',
      }));
      setBranches(mapped);

      if (!selectedBranchId && mapped.length > 0) {
        const primary = mapped.find((b) => b.isPrimary) || mapped[0];
        setSelectedBranchId(primary.id);
      }
    } catch {}
  }, [workspaceId, selectedBranchId]);

  const handleBranchSelect = (id: string) => {
    setSelectedBranchId(id);
    const targetBranch = branches.find((b) => b.id === id);
    if (targetBranch) {
      setActiveBranch(targetBranch as any);
    }
  };

  const handleAddBranchClick = () => {
    const planKey = (currentWorkspace?.planKey || (currentWorkspace as any)?.planId || 'free_trial').toLowerCase();
    const maxBranches = planKey === 'premium' ? 10 : planKey === 'standard' ? 3 : 1;
    if (branches.length >= maxBranches) {
      if (planKey === 'free_trial' || planKey === 'standard') {
        setIsUpgradeModalOpen(true);
      } else {
        toast.error('Maximum branch limit reached (10 branches on Premium). Contact sales for enterprise expansion.');
      }
      return;
    }
    setNewBranchName('');
    setNewBranchCode('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setIsAddBranchModalOpen(true);
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    if (!newBranchName.trim()) {
      toast.error('Please enter a branch name.');
      return;
    }

    setIsCreatingBranch(true);
    try {
      const res = await api.post<{ branchId?: string; id?: string }>(`/workspaces/${workspaceId}/branches`, {
        name: newBranchName.trim(),
        code: newBranchCode.trim().toUpperCase() || undefined,
        address: newBranchAddress.trim() || undefined,
        phone: newBranchPhone.trim() || undefined,
        productKey: 'inventory',
      });

      toast.success(`Branch "${newBranchName.trim()}" created successfully!`);
      setIsAddBranchModalOpen(false);
      await fetchBranches();
      await refreshBranchStore(workspaceId, 'inventory');
      const newId = res.branchId || res.id;
      if (newId) {
        setSelectedBranchId(newId);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to create branch.';
      if (msg.includes('Free Trial') || msg.includes('limit')) {
        setIsAddBranchModalOpen(false);
        setIsUpgradeModalOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // Fetch Selected Branch Details
  const fetchBranchDetails = useCallback(async () => {
    if (!workspaceId || !selectedBranchId) return;
    setIsLoading(true);
    try {
      let b: any = null;
      try {
        const res = await api.get<{ data?: { branch: any }; branch?: any }>(
          `/workspaces/${workspaceId}/branches/${selectedBranchId}/settings`
        );
        b = res?.data?.branch || (res?.data as any) || res?.branch;
      } catch {}

      if (!b) {
        try {
          const res = await api.get<{ data?: { branch: any }; branch?: any }>(
            `/workspaces/${workspaceId}/inventory/branches/${selectedBranchId}`
          );
          b = res?.data?.branch || (res?.data as any) || res?.branch;
        } catch {}
      }

      if (b) {
        setProfileForm({
          name: b.name || '',
          code: b.code || '',
          description: b.description || '',
          phone: b.phone || '',
          email: b.email || '',
          isPrimary: Boolean(b.isPrimary),
          status: b.status || 'active',
        });
        setAddressForm({
          country: b.country || 'Nigeria',
          state: b.state || 'Lagos',
          stateCode: b.stateCode || 'LA',
          lga: b.lga || 'Ikeja',
          city: b.city || 'Ikeja',
          street: b.street || b.addressLine1 || b.formattedAddress || b.address || '',
          blockNumber: b.blockNumber || '',
          area: b.area || b.addressLine2 || '',
          landmark: b.landmark || '',
          postalCode: b.postalCode || '',
        });
        if (b.openingHours) setOpeningHours(b.openingHours);
        setOperationalForm({
          receiptFooter: b.receiptFooter || '',
          negativeStockAllowed: Boolean(b.negativeStockAllowed),
          lowStockThreshold: b.lowStockThreshold ?? 10,
        });
      }
    } catch (err: any) {
      toast.error('Failed to load branch details: ' + (err?.message || 'Error loading branch'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, selectedBranchId]);

  // Fetch Branch Team Members, Invitations, and Audit Logs
  const fetchBranchTeam = useCallback(async () => {
    if (!workspaceId || !selectedBranchId) return;
    setIsTeamLoading(true);
    try {
      const [membersRes, wsMembersRes, invitesRes, auditRes] = await Promise.all([
        api.get<{ members?: any[]; data?: any[] }>(`/workspaces/${workspaceId}/inventory/branches/${selectedBranchId}/members`).catch(() => ({ members: [] })),
        api.get<{ members?: any[]; data?: any[] }>(`/workspaces/${workspaceId}/members`).catch(() => ({ members: [] })),
        api.get<{ invitations?: BranchInvitationRecord[] }>(`/workspaces/${workspaceId}/invitations`).catch(() => ({ invitations: [] })),
        api.get<{ data?: { logs: BranchAuditLogRecord[] } }>(`/workspaces/${workspaceId}/audit-logs/memberships?branchId=${selectedBranchId}`).catch(() => ({ data: { logs: [] } })),
      ]);

      const bMembers = membersRes?.members || (membersRes as any)?.data?.members || (Array.isArray(membersRes?.data) ? membersRes.data : []) || [];
      const orgMembers = wsMembersRes?.members || (wsMembersRes as any)?.data?.members || (Array.isArray(wsMembersRes?.data) ? wsMembersRes.data : []) || [];

      setWorkspaceMembersList(orgMembers.map((m: any) => ({
        id: m.id || m.userId || m._id,
        userId: m.userId || m.id || m._id,
        name: m.name || m.user?.name || m.email || 'Member',
        email: m.email || m.user?.email || '',
        role: m.role || 'member',
      })));

      setBranchMembers(bMembers.map((bm: any) => {
        const bmUserId = bm.userId || bm.user?.id || bm.user?._id || bm.id || bm._id;
        const found = orgMembers.find((m: any) => 
          (m.userId || m.id || m._id) === bmUserId || 
          (m.email && bm.user?.email && m.email.toLowerCase() === bm.user.email.toLowerCase()) ||
          (m.email && bm.email && m.email.toLowerCase() === bm.email.toLowerCase())
        );
        const resolvedName = bm.name || bm.user?.name || bm.user?.displayName || found?.name || found?.user?.name || (bm.email ? bm.email.split('@')[0] : '') || (found?.email ? found.email.split('@')[0] : '') || 'Staff Member';
        const resolvedEmail = bm.email || bm.user?.email || found?.email || found?.user?.email || '';

        return {
          id: bm.id || bm._id,
          userId: bmUserId,
          role: bm.role || 'inventory_staff',
          assignedAt: bm.assignedAt || bm.createdAt || Date.now(),
          name: resolvedName,
          email: resolvedEmail,
          workspaceRole: bm.workspaceRole || found?.role || found?.workspaceRole || 'member',
          status: bm.status || 'active',
        };
      }));

      const allInvites = invitesRes?.invitations || (invitesRes as any)?.data?.invitations || (Array.isArray(invitesRes?.data) ? invitesRes.data : []) || [];
      const branchScopedInvites = allInvites.filter((inv: any) => {
        const isScoped =
          inv.branchIds?.includes(selectedBranchId) ||
          inv.appAccess?.some((app: any) => app.branchIds?.includes(selectedBranchId)) ||
          (!inv.branchIds?.length && !inv.appAccess?.length);
        const isPending = (inv.status || '').toLowerCase() === 'pending' && !inv.isExpired && (!inv.expiresAt || inv.expiresAt > Date.now());
        return isScoped && isPending;
      });
      setBranchInvitations(branchScopedInvites);

      setBranchAuditLogs(auditRes?.data?.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch branch team', err);
    } finally {
      setIsTeamLoading(false);
    }
  }, [workspaceId, selectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchBranchDetails();
      if (activeTab === 'team') {
        fetchBranchTeam();
      }
    }
  }, [selectedBranchId, activeTab, fetchBranchDetails, fetchBranchTeam]);

  // Save Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedBranchId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/branches/${selectedBranchId}`, profileForm);
      toast.success('Branch profile updated.');
      fetchBranches();
      await refreshBranchStore(workspaceId, 'inventory');
    } catch (err: any) {
      toast.error('Failed to save branch profile: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedBranchId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/branches/${selectedBranchId}`, {
        country: addressForm.country,
        state: addressForm.state,
        stateCode: addressForm.stateCode,
        lga: addressForm.lga,
        city: addressForm.city,
        street: addressForm.street,
        blockNumber: addressForm.blockNumber,
        area: addressForm.area,
        landmark: addressForm.landmark,
        postalCode: addressForm.postalCode,
      });
      toast.success('Branch address saved.');
    } catch (err: any) {
      toast.error('Failed to save branch address: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOperational = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedBranchId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/branches/${selectedBranchId}/settings`, {
        ...operationalForm,
        openingHours,
      });
      toast.success('Branch operational settings and opening hours saved.');
    } catch (err: any) {
      toast.error('Failed to save operational settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async () => {
    if (!workspaceId || !selectedBranchId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/branches/${selectedBranchId}/set-primary`);
      toast.success('Branch set as primary location.');
      fetchBranches();
      fetchBranchDetails();
      await refreshBranchStore(workspaceId, 'inventory');
    } catch (err: any) {
      toast.error('Failed to set primary: ' + err.message);
    }
  };

  const handleSuspend = async () => {
    if (!workspaceId || !selectedBranchId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/branches/${selectedBranchId}/suspend`);
      toast.success('Branch operations suspended.');
      fetchBranches();
      fetchBranchDetails();
      await refreshBranchStore(workspaceId, 'inventory');
    } catch (err: any) {
      toast.error('Failed to suspend branch: ' + err.message);
    }
  };

  const handleRestore = async () => {
    if (!workspaceId || !selectedBranchId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/branches/${selectedBranchId}/restore`);
      toast.success('Branch access restored.');
      fetchBranches();
      fetchBranchDetails();
      await refreshBranchStore(workspaceId, 'inventory');
    } catch (err: any) {
      toast.error('Failed to restore branch: ' + err.message);
    }
  };

  const handleArchive = async () => {
    if (!workspaceId || !selectedBranchId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/branches/${selectedBranchId}/archive`);
      toast.success('Branch archived successfully.');
      fetchBranches();
      await refreshBranchStore(workspaceId, 'inventory');
    } catch (err: any) {
      toast.error('Failed to archive branch: ' + err.message);
    }
  };

  // Staff Management Actions
  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedBranchId || !newTeamUserId) {
      toast.error('Please select an organization member to add.');
      return;
    }
    setIsAddingTeamMember(true);
    try {
      await api.post(`/workspaces/${workspaceId}/inventory/branches/${selectedBranchId}/members`, {
        userId: newTeamUserId,
        role: newTeamRole,
      });
      toast.success('Staff assigned to branch successfully.');
      setNewTeamUserId('');
      fetchBranchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to assign staff.');
    } finally {
      setIsAddingTeamMember(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, role: string) => {
    if (!workspaceId || !selectedBranchId) return;
    try {
      await api.patch(`/workspaces/${workspaceId}/inventory/branches/${selectedBranchId}/members/${userId}`, {
        role,
      });
      toast.success('Branch staff role updated.');
      fetchBranchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to update role.');
    }
  };

  const handleDirectBranchInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspaceId || !selectedBranchId) return;

    setIsSubmittingInvite(true);
    try {
      await api.post(`/workspaces/${workspaceId}/invitations`, {
        email: inviteEmail.trim().toLowerCase(),
        organizationRole: 'member',
        role: 'member',
        appAccess: [
          {
            productKey: 'inventory',
            appRole: inviteRole,
            branchIds: [selectedBranchId],
          },
        ],
        branchIds: [selectedBranchId],
        message: inviteMessage.trim() || undefined,
      });

      toast.success(`Branch invitation sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteMessage('');
      setInviteRole('sales_attendant');
      await fetchBranchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to send branch invitation');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferMember || !transferTargetBranchId || !workspaceId || !selectedBranchId) return;

    setIsTransferring(true);
    try {
      await api.post(`/workspaces/${workspaceId}/inventory/branches/${transferTargetBranchId}/members`, {
        userId: transferMember.userId,
        role: transferNewRole,
      });
      await api.delete(`/workspaces/${workspaceId}/inventory/branches/${selectedBranchId}/members/${transferMember.userId}`);

      const targetBranch = branches.find((b) => b.id === transferTargetBranchId);
      toast.success(`Transferred ${transferMember.name} to ${targetBranch?.name || 'new branch'}`);
      setTransferMember(null);
      setTransferTargetBranchId('');
      await fetchBranchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to transfer staff member');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleConfirmRemoveStaff = async () => {
    if (!removeMember || !workspaceId || !selectedBranchId) return;
    setIsRemoving(true);
    try {
      await api.delete(`/workspaces/${workspaceId}/inventory/branches/${selectedBranchId}/members/${removeMember.userId}`);
      toast.success(`Removed ${removeMember.name} from this branch.`);
      setRemoveMember(null);
      setRemoveReason('');
      await fetchBranchTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to remove staff.');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/invitations/${invitationId}/resend`);
      toast.success('Invitation resent successfully.');
      await fetchBranchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/workspaces/${workspaceId}/invitations/${invitationId}/revoke`);
      toast.success('Invitation revoked.');
      await fetchBranchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    }
  };

  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const managerCount = branchMembers.filter((m) => m.role === 'branch_manager').length;

  const tabItems = [
    { id: 'general', label: 'Store Profile', icon: Store },
    { id: 'address', label: 'Location & Address', icon: MapPin },
    { id: 'hours', label: 'Opening Hours', icon: Clock },
    { id: 'operations', label: 'POS & Receipts', icon: Sliders },
    { id: 'team', label: 'Staff & Roles', icon: Users, badge: branchMembers.length || undefined },
    { id: 'actions', label: 'Status & Archive', icon: ShieldAlert, danger: true },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* 1. Header Banner & Location Switcher */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#170e16] via-[#120a11] to-[#1a0e18] border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#714b67]/30 text-[#f3bce2] border border-[#714b67]/40 uppercase tracking-wider">
              Store Operations
            </span>
            {currentBranch?.isPrimary && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-300" />
                Primary Location
              </span>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
              {currentBranch?.status || 'Active'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-[#e6a8d6]" />
            {currentBranch?.name || 'Branch Settings'}
          </h1>
          <p className="text-xs text-slate-400">
            Configure location identity, POS receipt footers, physical address, and staff assignments for this specific store.
          </p>
        </div>

        {/* Branch Selector + Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchSelect(e.target.value)}
              className="h-9 px-3 pr-8 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-medium focus:outline-none focus:border-[#714b67] cursor-pointer appearance-none min-w-[170px]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isPrimary ? '(Primary)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {isOwnerOrAdmin && (
            <Button
              onClick={handleAddBranchClick}
              size="sm"
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold h-9 px-3 cursor-pointer shadow-md shadow-[#714b67]/20"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Branch
            </Button>
          )}
        </div>
      </div>

      {/* 2. Horizontal Navigation Tabs (Eliminating Left Sidebar Conflict) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/10 no-scrollbar">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer',
                isActive
                  ? 'bg-[#714b67]/30 text-white border border-[#714b67]/50 shadow-inner'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-[#e6a8d6]' : tab.danger ? 'text-rose-400' : 'text-slate-400')} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white/10 text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Main Form Container Card */}
      <div className="p-6 rounded-2xl bg-[#120a11]/90 border border-white/10 shadow-2xl backdrop-blur-md">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading branch settings...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: BRANCH PROFILE */}
            {activeTab === 'general' && (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-base font-bold text-white">Store Identity & Contacts</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    General branch name, unique location code, and contact information.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Branch / Store Name *</Label>
                    <Input
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Branch Code / Tag</Label>
                    <Input
                      value={profileForm.code}
                      onChange={(e) => setProfileForm({ ...profileForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. HQ, IKEJA-01"
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs font-mono text-white"
                    />
                    <p className="text-[10px] text-slate-500">
                      Appears on sales receipts and inventory dispatch transfers.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Store Phone Number</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+234 800 000 0000"
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Store Email</Label>
                    <Input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="store@company.com"
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs text-white"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs text-slate-200">Store Description / Notes</Label>
                    <textarea
                      value={profileForm.description}
                      onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                      rows={3}
                      placeholder="Location details, main warehouse notes, landmark hints..."
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
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save Store Profile
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 2: LOCATION & ADDRESS */}
            {activeTab === 'address' && (
              <form onSubmit={handleSaveAddress} className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-base font-bold text-white">Physical Location & Address</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    State, LGA, street details, and regional delivery routing information.
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
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save Location Address
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 3: OPENING HOURS */}
            {activeTab === 'hours' && (
              <form onSubmit={handleSaveOperational} className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-base font-bold text-white">Operating Schedule & Hours</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure active opening and closing windows for cashiers and shift registers.
                  </p>
                </div>

                <OpeningHoursEditor
                  value={openingHours}
                  onChange={setOpeningHours}
                  disabled={!isOwnerOrAdmin}
                />

                {isOwnerOrAdmin && (
                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save Opening Hours
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 4: POS & RECEIPTS */}
            {activeTab === 'operations' && (
              <form onSubmit={handleSaveOperational} className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-base font-bold text-white">POS & Receipt Customization</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Location inventory thresholds, receipt footer customization, and sale policies.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Custom Receipt Footer Message</Label>
                    <textarea
                      value={operationalForm.receiptFooter}
                      onChange={(e) => setOperationalForm({ ...operationalForm, receiptFooter: e.target.value })}
                      rows={2}
                      placeholder="e.g. Thank you for shopping with us! Goods sold are non-refundable after 7 days."
                      disabled={!isOwnerOrAdmin}
                      className="w-full p-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">
                      Printed at the bottom of all sales receipts issued by registers at this location.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-200">Branch Low Stock Alert Threshold</Label>
                      <Input
                        type="number"
                        min={0}
                        value={operationalForm.lowStockThreshold}
                        onChange={(e) => setOperationalForm({ ...operationalForm, lowStockThreshold: parseInt(e.target.value) || 0 })}
                        disabled={!isOwnerOrAdmin}
                        className="bg-black/40 border-white/10 text-xs text-white"
                      />
                      <p className="text-[10px] text-slate-500">
                        Units remaining at this store before inventory alert triggers.
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                      <div>
                        <div className="text-xs font-bold text-white">Allow Negative Stock Checkout</div>
                        <div className="text-[10px] text-slate-400">
                          Allow cashiers to complete sales when recorded quantity is 0.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={operationalForm.negativeStockAllowed}
                        onChange={(e) => setOperationalForm({ ...operationalForm, negativeStockAllowed: e.target.checked })}
                        disabled={!isOwnerOrAdmin}
                        className="rounded bg-black border-white/20 text-[#714b67] focus:ring-[#714b67] w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save POS & Operational Rules
                    </Button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 5: BRANCH STAFF ACCESS */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#e6a8d6]" />
                      Branch Staff & Access Assignments
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure who can operate, manage stock, and ring sales at <strong className="text-white">{currentBranch?.name || 'this branch'}</strong>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsRoleMatrixOpen(true)}
                      className="border-white/10 text-xs text-[#e6a8d6] hover:bg-white/5 cursor-pointer h-8"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                      Role Matrix
                    </Button>
                    {isOwnerOrAdmin && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer h-8 px-3"
                      >
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                        Direct Branch Invite
                      </Button>
                    )}
                  </div>
                </div>

                {/* Quick Branch Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-white/10 bg-black/40">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Assigned Staff</span>
                    <p className="text-lg font-bold text-white mt-0.5">{branchMembers.length}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-white/10 bg-black/40">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Branch Managers</span>
                    <p className="text-lg font-bold text-[#e6a8d6] mt-0.5">{managerCount}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-white/10 bg-black/40">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Location Code</span>
                    <p className="text-lg font-mono font-bold text-amber-300 mt-0.5">{currentBranch?.code || 'MAIN'}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-white/10 bg-black/40">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Status</span>
                    <p className="text-sm font-bold text-emerald-400 capitalize mt-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {currentBranch?.status || 'Active'}
                    </p>
                  </div>
                </div>

                {/* Assign Existing Member Form */}
                {isOwnerOrAdmin && (
                  <form onSubmit={handleAddTeamMember} className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-[#e6a8d6]" />
                        Assign Existing Organization Member to this Branch
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6 space-y-1">
                        <Label className="text-[11px] text-slate-300">Select Member</Label>
                        <select
                          value={newTeamUserId}
                          onChange={(e) => setNewTeamUserId(e.target.value)}
                          required
                          className="w-full h-9 rounded-md bg-black/50 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#714b67]"
                        >
                          <option value="">-- Choose Organization Member --</option>
                          {workspaceMembersList
                            .filter((wm) => !branchMembers.some((bm) => bm.userId === wm.userId))
                            .map((wm) => (
                              <option key={wm.userId} value={wm.userId}>
                                {wm.name} ({wm.email || wm.role})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] text-slate-300">Branch Role</Label>
                        <select
                          value={newTeamRole}
                          onChange={(e) => setNewTeamRole(e.target.value)}
                          className="w-full h-9 rounded-md bg-black/50 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#714b67]"
                        >
                          {BRANCH_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <Button
                          type="submit"
                          disabled={isAddingTeamMember || !newTeamUserId}
                          className="w-full h-9 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
                        >
                          {isAddingTeamMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign Staff'}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Sub-Tabs: Staff | Invitations | Audit */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-1.5 border-b border-white/10 sm:border-b-0 pb-2 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setBranchSubTab('staff')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        branchSubTab === 'staff'
                          ? 'bg-[#714b67]/30 text-[#e6a8d6] border border-[#714b67]/50'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Active Staff ({branchMembers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBranchSubTab('invitations')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        branchSubTab === 'invitations'
                          ? 'bg-[#714b67]/30 text-[#e6a8d6] border border-[#714b67]/50'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Pending Invitations
                      {branchInvitations.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">
                          {branchInvitations.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBranchSubTab('audit')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        branchSubTab === 'audit'
                          ? 'bg-[#714b67]/30 text-[#e6a8d6] border border-[#714b67]/50'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Audit Trail ({branchAuditLogs.length})
                    </button>
                  </div>

                  {branchSubTab === 'staff' && (
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Search staff by name/email..."
                        className="pl-8 h-8 bg-black/40 border-white/10 text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                {/* SubTab 1: Staff Table */}
                {branchSubTab === 'staff' && (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-black/50 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
                        <tr>
                          <th className="py-3 px-4">Staff Member</th>
                          <th className="py-3 px-4">Branch Role</th>
                          <th className="py-3 px-4">Assigned On</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {branchMembers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              No staff members assigned to this branch yet.
                            </td>
                          </tr>
                        ) : (
                          branchMembers
                            .filter(
                              (m) =>
                                !teamSearch ||
                                m.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                                m.email.toLowerCase().includes(teamSearch.toLowerCase())
                            )
                            .map((member) => (
                              <tr key={member.userId} className="hover:bg-white/[0.02]">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-white">{member.name}</div>
                                  <div className="text-[10px] text-slate-400">{member.email}</div>
                                </td>
                                <td className="py-3 px-4">
                                  {isOwnerOrAdmin ? (
                                    <select
                                      value={member.role}
                                      onChange={(e) => handleUpdateMemberRole(member.userId, e.target.value)}
                                      className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#714b67]"
                                    >
                                      {BRANCH_ROLES.map((r) => (
                                        <option key={r.value} value={r.value}>
                                          {r.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="font-mono text-slate-300 capitalize">
                                      {member.role.replace('_', ' ')}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-400">
                                  {new Date(member.assignedAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {isOwnerOrAdmin && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setTransferMember(member);
                                          setTransferTargetBranchId(
                                            branches.find((b) => b.id !== selectedBranchId)?.id || ''
                                          );
                                        }}
                                        className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                                        title="Transfer to another branch"
                                      >
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setRemoveMember(member)}
                                        className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                        title="Remove staff member"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SubTab 2: Pending Invitations */}
                {branchSubTab === 'invitations' && (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-black/50 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
                        <tr>
                          <th className="py-3 px-4">Invited Email</th>
                          <th className="py-3 px-4">Assigned Role</th>
                          <th className="py-3 px-4">Expires In</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {branchInvitations.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              No pending invitations for this branch.
                            </td>
                          </tr>
                        ) : (
                          branchInvitations.map((inv) => (
                            <tr key={inv.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-bold text-white">{inv.email}</td>
                              <td className="py-3 px-4 capitalize font-mono text-slate-300">
                                {inv.role.replace('_', ' ')}
                              </td>
                              <td className="py-3 px-4 text-slate-400">
                                {Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))} days
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResendInvite(inv.id)}
                                    className="h-7 text-[11px] border-white/10 text-slate-300"
                                  >
                                    Resend
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevokeInvite(inv.id)}
                                    className="h-7 text-[11px] text-rose-400 hover:bg-rose-500/10"
                                  >
                                    Revoke
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SubTab 3: Audit Trail */}
                {branchSubTab === 'audit' && (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-black/50 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Actor</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Target User</th>
                          <th className="py-3 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {branchAuditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                              No staff modification audit records for this branch yet.
                            </td>
                          </tr>
                        ) : (
                          branchAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 text-slate-400 font-mono">
                                {new Date(log.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 font-bold text-white">{log.actorName}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10 text-[10px] uppercase font-mono">
                                  {log.actionType}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-200">{log.targetName}</td>
                              <td className="py-3 px-4 text-slate-400">
                                {log.newRole ? `Role changed to ${log.newRole}` : log.reason || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: STATUS & DANGER ZONE */}
            {activeTab === 'actions' && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Branch Status & Lifecycle Controls
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage primary store designations, emergency store closures, and branch decommission archiving.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Primary Branch Action */}
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-300" />
                        Primary Organization Store
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        The primary store acts as the default fallback location for unassigned customer invoices and inventory dispatches.
                      </p>
                    </div>
                    <div>
                      {profileForm.isPrimary ? (
                        <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Currently Primary
                        </span>
                      ) : (
                        <Button
                          onClick={() => setActionModal('primary')}
                          size="sm"
                          disabled={!isOwnerOrAdmin}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Set as Primary Location
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Suspend / Restore Branch Action */}
                  <div className="p-4 rounded-xl border border-white/10 bg-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <PowerOff className="w-3.5 h-3.5 text-amber-400" />
                        Temporary Branch Operations Suspension
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Blocks all cashier checkout registers and inventory transfers while preserving records and historical receipts.
                      </p>
                    </div>
                    <div>
                      {profileForm.status === 'suspended' ? (
                        <Button
                          onClick={() => setActionModal('restore')}
                          size="sm"
                          disabled={!isOwnerOrAdmin}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Restore Operations
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setActionModal('suspend')}
                          size="sm"
                          disabled={!isOwnerOrAdmin || profileForm.isPrimary}
                          className="bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Suspend Branch
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Archive Branch Action */}
                  <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <Archive className="w-3.5 h-3.5 text-rose-400" />
                        Archive & Decommission Location
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Permanently hides this branch from checkout screens. All historical transaction records and ledger logs remain strictly immutable.
                      </p>
                    </div>
                    <Button
                      onClick={() => setActionModal('archive')}
                      size="sm"
                      disabled={!isOwnerOrAdmin || profileForm.isPrimary}
                      className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Archive Location
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={actionModal === 'primary'}
        title="Set Primary Location"
        message={`Are you sure you want to make "${profileForm.name}" the primary store for this workspace?`}
        confirmText="Confirm Primary"
        onClose={() => setActionModal(null)}
        onConfirm={handleSetPrimary}
      />

      <ConfirmationModal
        isOpen={actionModal === 'suspend'}
        title="Suspend Branch"
        message={`Are you sure you want to suspend operations for "${profileForm.name}"? Cashiers will not be able to process sales.`}
        confirmText="Suspend Branch"
        onClose={() => setActionModal(null)}
        onConfirm={handleSuspend}
      />

      <ConfirmationModal
        isOpen={actionModal === 'restore'}
        title="Restore Branch Operations"
        message={`Restore register and staff operations for "${profileForm.name}"?`}
        confirmText="Restore Access"
        onClose={() => setActionModal(null)}
        onConfirm={handleRestore}
      />

      <ConfirmationModal
        isOpen={actionModal === 'archive'}
        title="Archive Branch"
        message={`Archive "${profileForm.name}"? This branch will no longer appear on registers.`}
        confirmText="Archive Location"
        onClose={() => setActionModal(null)}
        onConfirm={handleArchive}
      />

      {/* Add Branch Modal */}
      {isAddBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-[#e6a8d6]" />
                Create New Store Location
              </h3>
              <button
                onClick={() => setIsAddBranchModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-3 text-left">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Branch Name *</Label>
                <Input
                  required
                  placeholder="e.g. Lekki Outlet, Abuja Warehouse"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="bg-black/60 border-white/10 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Branch Code (Optional)</Label>
                <Input
                  placeholder="e.g. LEKKI-01"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
                  className="bg-black/60 border-white/10 text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Street / Area (Optional)</Label>
                <Input
                  placeholder="e.g. Admiralty Way, Lekki"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="bg-black/60 border-white/10 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Contact Phone (Optional)</Label>
                <Input
                  placeholder="+234 800 000 0000"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="bg-black/60 border-white/10 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddBranchModalOpen(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingBranch || !newBranchName.trim()}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4 cursor-pointer"
                >
                  {isCreatingBranch ? 'Creating...' : 'Create Branch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Branch Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#e6a8d6]" />
                Invite Staff Member to {currentBranch?.name || 'Branch'}
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDirectBranchInvite} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Staff Email Address *</Label>
                <Input
                  type="email"
                  required
                  placeholder="cashier@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-black/60 border-white/10 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Branch Role *</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#714b67]"
                >
                  {BRANCH_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Custom Note (Optional)</Label>
                <Input
                  placeholder="Welcome to our store team!"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="bg-black/60 border-white/10 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingInvite || !inviteEmail.trim()}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4 cursor-pointer"
                >
                  {isSubmittingInvite ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Staff Modal */}
      {transferMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#e6a8d6]" />
                Transfer Staff Member
              </h3>
              <button
                onClick={() => setTransferMember(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1">
              <span className="text-slate-400">Transferring:</span>
              <p className="font-bold text-white">{transferMember.name} ({transferMember.email})</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Destination Branch *</Label>
                <select
                  value={transferTargetBranchId}
                  onChange={(e) => setTransferTargetBranchId(e.target.value)}
                  className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#714b67]"
                >
                  <option value="">-- Choose Target Branch --</option>
                  {branches
                    .filter((b) => b.id !== selectedBranchId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Role at Destination *</Label>
                <select
                  value={transferNewRole}
                  onChange={(e) => setTransferNewRole(e.target.value)}
                  className="w-full h-9 rounded-md bg-black/60 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#714b67]"
                >
                  {BRANCH_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTransferMember(null)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isTransferring || !transferTargetBranchId}
                  onClick={handleConfirmTransfer}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4 cursor-pointer"
                >
                  {isTransferring ? 'Transferring...' : 'Execute Transfer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Staff Modal */}
      {removeMember && (
        <ConfirmationModal
          isOpen={Boolean(removeMember)}
          title="Remove Staff Member from Branch"
          message={`Are you sure you want to remove "${removeMember.name}" from this store? They will lose register and stock access for this location.`}
          confirmText="Remove Staff"
          onClose={() => setRemoveMember(null)}
          onConfirm={handleConfirmRemoveStaff}
        />
      )}

      {/* Role Matrix Modal */}
      {isRoleMatrixOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#e6a8d6]" />
                Branch Role & Permission Capabilities
              </h3>
              <button
                onClick={() => setIsRoleMatrixOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-black/50 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">POS Sales</th>
                    <th className="py-2.5 px-3">Stock Audit</th>
                    <th className="py-2.5 px-3">Manage Staff</th>
                    <th className="py-2.5 px-3">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { role: 'Branch Manager', pos: 'Full', stock: 'Full', staff: 'Yes', settings: 'Yes' },
                    { role: 'Inventory Staff', pos: 'Yes', stock: 'Full', staff: 'No', settings: 'No' },
                    { role: 'Sales Attendant', pos: 'Yes', stock: 'View Only', staff: 'No', settings: 'No' },
                    { role: 'Cashier', pos: 'Checkout', stock: 'No', staff: 'No', settings: 'No' },
                    { role: 'Stock Keeper', pos: 'No', stock: 'Full', staff: 'No', settings: 'No' },
                    { role: 'Viewer', pos: 'View Only', stock: 'View Only', staff: 'No', settings: 'No' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">{row.role}</td>
                      <td className="py-2.5 px-3 text-slate-300">{row.pos}</td>
                      <td className="py-2.5 px-3 text-slate-300">{row.stock}</td>
                      <td className="py-2.5 px-3 text-slate-300">{row.staff}</td>
                      <td className="py-2.5 px-3 text-slate-300">{row.settings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setIsRoleMatrixOpen(false)}
                className="bg-[#714b67] text-white text-xs font-semibold px-4 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        workspaceId={workspaceId || ''}
        currentPlanKey="free_trial"
        triggerReason="branch_limit"
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={() => {
          fetchBranches();
          refreshBranchStore(workspaceId || '', 'inventory');
        }}
      />
    </div>
  );
};
