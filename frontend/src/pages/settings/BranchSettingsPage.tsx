import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSidebar, type SettingsNavItem } from '@/components/settings/SettingsSidebar';
import { BranchSelector, type BranchOption } from '@/components/settings/BranchSelector';
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
  Sliders,
  ShieldAlert,
  Loader2,
  Save,
  Archive,
  PowerOff,
  Star,
  Phone,
  Plus,
  X,
} from 'lucide-react';

export const BranchSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { branchId: urlBranchId } = useParams<{ branchId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const tabParam = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const activeMembership =
    memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  const workspaceId = activeMembership?.organization?.id || currentWorkspace?.id;
  const isOwnerOrAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(urlBranchId || '');
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
    sunday: { open: '10:00', close: '16:00', closed: true },
  });

  // Operational Settings State
  const [operationalForm, setOperationalForm] = useState({
    receiptFooter: '',
    negativeStockAllowed: false,
    lowStockThreshold: 10,
  });

  // Modals
  const [actionModal, setActionModal] = useState<'primary' | 'suspend' | 'restore' | 'archive' | null>(null);
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

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

  const handleAddBranchClick = () => {
    const isTrial = (currentWorkspace?.planKey || (currentWorkspace as any)?.planId || 'free_trial').toLowerCase() === 'free_trial';
    if (isTrial && branches.length >= 1) {
      setIsUpgradeModalOpen(true);
      return;
    }
    if (branches.length >= 3) {
      toast.error('Standard plan limit reached (3 branches). Contact support for custom volume.');
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
      const newId = res.branchId || res.id;
      if (newId) {
        setSelectedBranchId(newId);
        navigate(`/settings/branches/${newId}?tab=general`);
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
      const res = await api.get<{ data: { branch: any } }>(
        `/workspaces/${workspaceId}/branches/${selectedBranchId}/settings`
      );
      const b = res.data?.branch;
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
          street: b.street || b.addressLine1 || '',
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
      toast.error('Failed to load branch details: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, selectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchBranchDetails();
    }
  }, [selectedBranchId, fetchBranchDetails]);

  // Save Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedBranchId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/branches/${selectedBranchId}`, profileForm);
      toast.success('Branch profile updated.');
      fetchBranches();
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
    } catch (err: any) {
      toast.error('Failed to archive branch: ' + err.message);
    }
  };

  const navItems: SettingsNavItem[] = [
    { id: 'general', label: 'Branch Profile', icon: Store },
    { id: 'address', label: 'Location & Address', icon: MapPin },
    { id: 'hours', label: 'Opening Hours', icon: Clock },
    { id: 'operations', label: 'Operational Rules', icon: Sliders },
    { id: 'team', label: 'Branch Staff Access', icon: Users },
    { id: 'actions', label: 'Branch Status & Archive', icon: ShieldAlert, danger: true },
  ];

  const currentBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <SettingsLayout
      title="Branch Settings"
      subtitle="Location-specific operational rules, staff assignments, and opening schedules"
      contextTag="Branch"
      badge={currentBranch?.name}
      headerRight={
        <div className="flex items-center gap-2">
          {currentBranch?.isPrimary && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-300" />
              Primary Store
            </span>
          )}
        </div>
      }
      sidebar={
        <SettingsSidebar
          items={navItems}
          activeId={activeTab}
          onSelect={(tab) => {
            setActiveTab(tab);
            setSearchParams({ tab });
          }}
          header={
            <BranchSelector
              branches={branches}
              selectedBranchId={selectedBranchId}
              onSelectBranch={(id) => {
                setSelectedBranchId(id);
                navigate(`/settings/branches/${id}?tab=${activeTab}`);
              }}
              onAddBranch={handleAddBranchClick}
            />
          }
        />
      }
    >
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading branch settings...</p>
        </div>
      ) : (
        <>
          {/* 1. Branch Profile Tab */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveProfile} className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Branch Profile</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Core identification and contact details for this specific store or warehouse.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Branch Name *</Label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Branch Code (Unique) *</Label>
                  <Input
                    value={profileForm.code}
                    onChange={(e) => setProfileForm({ ...profileForm, code: e.target.value })}
                    required
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs font-mono uppercase"
                  />
                  <p className="text-[10px] text-slate-500">
                    Used for SKU barcode prefixes and branch transfer logs (e.g. LAG-MAIN).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Branch Direct Phone</Label>
                  <div className="relative flex items-center h-10 bg-black/40 border border-white/10 rounded-md text-xs transition-all focus-within:ring-1 focus-within:ring-[#714b67] focus-within:border-[#714b67]">
                    <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs font-medium text-slate-200">+234</span>
                    </div>
                    <input
                      type="tel"
                      value={profileForm.phone?.replace(/^\+234|^0/, '') || ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s+/g, '');
                        setProfileForm({
                          ...profileForm,
                          phone: raw ? `+234${raw}` : '',
                        });
                      }}
                      placeholder="800 000 0000"
                      disabled={!isOwnerOrAdmin}
                      className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-600 text-xs focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Branch Direct Email</Label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="branch@company.com"
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs text-slate-200">Branch Description / Notes</Label>
                  <textarea
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    rows={3}
                    placeholder="Location notes, landmark directions, or internal purpose..."
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
                    Save Branch Profile
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* 2. Branch Address Tab */}
          {activeTab === 'address' && (
            <form onSubmit={handleSaveAddress} className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Branch Location & Structured Address</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nigerian structured address used on sales receipts and tax invoices for this location.
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
                    Save Location Address
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* 3. Opening Hours Tab */}
          {activeTab === 'hours' && (
            <form onSubmit={handleSaveOperational} className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Store Operating Hours</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Opening and closing times for daily shifts and sales register availability.
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
                    className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Save Opening Hours
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* 4. Operational Rules Tab */}
          {activeTab === 'operations' && (
            <form onSubmit={handleSaveOperational} className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Branch Operational Rules</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Thresholds and policies applied to inventory transactions at this location.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Allow Negative Stock</h4>
                      <p className="text-[11px] text-slate-400">
                        Allow cashiers to complete checkout even if item quantity in stock reaches zero.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={operationalForm.negativeStockAllowed}
                        onChange={(e) => setOperationalForm({ ...operationalForm, negativeStockAllowed: e.target.checked })}
                        disabled={!isOwnerOrAdmin}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#714b67]" />
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <Label className="text-xs font-bold text-white">Low-Stock Alert Threshold</Label>
                  <p className="text-[11px] text-slate-400">
                    Triggers a restock alert when inventory at this branch drops below this quantity.
                  </p>
                  <Input
                    type="number"
                    min={0}
                    value={operationalForm.lowStockThreshold}
                    onChange={(e) => setOperationalForm({ ...operationalForm, lowStockThreshold: parseInt(e.target.value) || 0 })}
                    disabled={!isOwnerOrAdmin}
                    className="w-40 bg-black/50 border-white/10 text-xs"
                  />
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-black/40 space-y-2">
                  <Label className="text-xs font-bold text-white">Branch-Specific Receipt Footer</Label>
                  <p className="text-[11px] text-slate-400">
                    Custom message printed on receipts issued by registers at this location.
                  </p>
                  <Input
                    value={operationalForm.receiptFooter}
                    onChange={(e) => setOperationalForm({ ...operationalForm, receiptFooter: e.target.value })}
                    placeholder="e.g. Thanks for shopping at Ikeja Mall! Return policy: 7 days."
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/50 border-white/10 text-xs"
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
                    Save Operational Rules
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* 5. Branch Staff Access Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Branch Staff & Access Assignments</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Assign members to this branch, set roles, and manage branch-level permissions.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/settings/members')}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold"
                >
                  Manage Team Permissions
                </Button>
              </div>

              <div className="p-8 text-center bg-black/20 border border-white/5 rounded-2xl space-y-3">
                <Users className="w-10 h-10 text-[#e6a8d6] mx-auto" />
                <h3 className="text-sm font-bold text-white">Branch Team Management</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Staff assigned to this location can log in to the POS register and receive restock alerts for {currentBranch?.name}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings/members')}
                  className="border-white/10 text-xs"
                >
                  Open Team Permissions
                </Button>
              </div>
            </div>
          )}

          {/* 6. Branch Status & Archive Actions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-rose-500/20 pb-4 text-rose-400">
                <h2 className="text-base font-bold text-rose-300">Branch Status & Lifecycle</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage branch operational status, promote to primary, or safely archive.
                </p>
              </div>

              <div className="space-y-4">
                {/* Promote to Primary */}
                {!currentBranch?.isPrimary && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400" />
                        Set as Primary Branch
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Makes this location the default branch for new customer sales and product imports.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActionModal('primary')}
                      className="text-xs shrink-0 border-amber-500/30 text-amber-300 hover:bg-amber-500/15"
                    >
                      Set as Primary
                    </Button>
                  </div>
                )}

                {/* Suspend / Restore */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/10 bg-black/40 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <PowerOff className="w-4 h-4 text-amber-400" />
                      {profileForm.status === 'suspended' ? 'Restore Branch Operations' : 'Suspend Branch Operations'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {profileForm.status === 'suspended'
                        ? 'Re-enable POS sales and inventory transactions at this location.'
                        : 'Temporarily pause register checkout and product adjustments at this branch.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActionModal(profileForm.status === 'suspended' ? 'restore' : 'suspend')}
                    className="text-xs shrink-0 border-white/10 hover:bg-white/5"
                  >
                    {profileForm.status === 'suspended' ? 'Restore Branch' : 'Suspend Branch'}
                  </Button>
                </div>

                {/* Archive Branch */}
                {isOwnerOrAdmin && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
                        <Archive className="w-4 h-4 text-rose-400" />
                        Archive Branch
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Close this location while preserving all historical sales receipts, customer orders, and stock movements.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setActionModal('archive')}
                      className="text-xs shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50"
                    >
                      Archive Branch
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Modals */}
              <ConfirmationModal
                isOpen={actionModal === 'primary'}
                onClose={() => setActionModal(null)}
                title="Set Primary Branch"
                description={`Make "${profileForm.name}" the primary branch for your organization?`}
                confirmButtonText="Confirm Primary Branch"
                onConfirm={handleSetPrimary}
              />

              <ConfirmationModal
                isOpen={actionModal === 'suspend'}
                onClose={() => setActionModal(null)}
                title="Suspend Branch Operations"
                description={`Suspend "${profileForm.name}"? Register checkouts will be paused.`}
                confirmButtonText="Suspend Branch"
                onConfirm={handleSuspend}
              />

              <ConfirmationModal
                isOpen={actionModal === 'restore'}
                onClose={() => setActionModal(null)}
                title="Restore Branch Operations"
                description={`Restore operations for "${profileForm.name}"?`}
                confirmButtonText="Restore Branch"
                onConfirm={handleRestore}
              />

              <ConfirmationModal
                isOpen={actionModal === 'archive'}
                onClose={() => setActionModal(null)}
                title="Archive Branch"
                description={`Are you sure you want to archive "${profileForm.name}"? At least one active branch must remain.`}
                confirmationPhrase={`archive ${profileForm.code.toLowerCase() || 'branch'}`}
                requireReason
                isDangerous
                confirmButtonText="Archive Location"
                onConfirm={handleArchive}
              />
            </div>
          )}
        </>
      )}

      {/* Add Branch Modal */}
      {isAddBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-md w-full rounded-2xl bg-[#120b10] border border-white/10 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#FDB02F]" />
                <h3 className="text-sm font-bold text-white">Add New Branch Location</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBranchModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">
                  Branch Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  placeholder="e.g. Ikeja Outlet or Abuja Store"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="bg-black/50 border-white/10 text-white text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">Branch Code</Label>
                  <Input
                    placeholder="e.g. IKJ"
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
                    className="bg-black/50 border-white/10 text-white text-xs uppercase"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-200">Branch Phone</Label>
                  <Input
                    placeholder="e.g. 08012345678"
                    value={newBranchPhone}
                    onChange={(e) => setNewBranchPhone(e.target.value)}
                    className="bg-black/50 border-white/10 text-white text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">Address / Location</Label>
                <Input
                  placeholder="e.g. 14 Allen Avenue, Ikeja, Lagos"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="bg-black/50 border-white/10 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddBranchModalOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingBranch}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold"
                >
                  {isCreatingBranch ? 'Creating...' : 'Create Branch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgrade Entitlement Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        workspaceId={workspaceId || ''}
        currentPlanKey="free_trial"
        triggerReason="branch_limit"
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={() => {
          fetchBranches();
        }}
      />
    </SettingsLayout>
  );
};
