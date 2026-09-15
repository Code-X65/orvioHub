import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Tag, X, PlusCircle, Mail, MapPin, Copy, Phone, ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper custom searchable select
const CustomSelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, options, placeholder = 'Select...', disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3 h-10 rounded-xl bg-[#160f14] border border-white/10 text-xs text-left transition-all',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20 focus:border-[#714b67]',
          selectedOption ? 'text-white' : 'text-slate-500'
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#160f14] border border-white/15 rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-100">
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#714b67]"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-1 divide-y divide-white/5">
            {filtered.length === 0 ? (
              <div className="p-2.5 text-center text-xs text-slate-500">No options found</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors cursor-pointer',
                      isSelected ? 'bg-[#714b67]/30 text-white font-semibold' : 'text-slate-300 hover:bg-white/5'
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#d4a8c9]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface BranchCreationModalProps {
  isOpen: boolean;
  workspaceId: string;
  applicationKey?: string;
  onClose: () => void;
  onSuccess?: (newBranch: Branch) => void;
}

export const BranchCreationModal: React.FC<BranchCreationModalProps> = ({
  isOpen,
  workspaceId,
  applicationKey = 'inventory',
  onClose,
  onSuccess,
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { createBranch, branches } = useBranchStore();
  const { states, fetchStates } = useLocationStore();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(branches.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split Nigerian Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const country = 'Nigeria';

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  const cleanPhone = (val: string) => {
    let raw = val.replace(/\s+/g, '');
    if (raw.startsWith('+234')) raw = raw.slice(4);
    else if (raw.startsWith('234')) raw = raw.slice(3);
    else if (raw.startsWith('0')) raw = raw.slice(1);
    return raw;
  };

  const handlePrefillFromOrg = async () => {
    try {
      const ws = currentWorkspace as any;
      const meta = ws?.metadata || {};
      let orgStreet = ws?.street || meta.street || '';
      let orgCity = ws?.city || meta.city || '';
      let orgState = ws?.state || meta.state || '';
      let orgPhone = ws?.phone || meta.phone || '';

      if (!orgStreet && !orgPhone && workspaceId) {
        const res = await api.get<any>(`/organizations/${workspaceId}`).catch(() => null);
        const orgData = res?.organization || res?.data?.organization || res;
        if (orgData) {
          orgStreet = orgData.street || orgData.address || '';
          orgCity = orgData.city || '';
          orgState = orgData.state || '';
          orgPhone = orgData.phone || '';
        }
      }

      if (orgStreet) setStreet(orgStreet);
      if (orgCity) setCity(orgCity);
      if (orgState) setStateName(orgState);
      if (orgPhone) setPhoneDigits(cleanPhone(orgPhone));

      toast.success('Pre-filled address and contact details from organization!');
    } catch {
      toast.info('Could not retrieve organization address details.');
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const generateCode = (val: string) => {
    return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'MAIN';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Branch name is required.');
      return;
    }
    if (!workspaceId) {
      toast.error('Organization context is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedPhone = phoneDigits.trim() ? `+234${cleanPhone(phoneDigits)}` : undefined;
      const addressParts = [street.trim(), city.trim(), stateName.trim(), country].filter(Boolean);
      const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

      const newBranch = await createBranch({
        workspaceId,
        organizationId: workspaceId,
        applicationKey,
        name: name.trim(),
        code: code.trim().toUpperCase() || generateCode(name),
        isPrimary: isPrimary || branches.length === 0,
        country: 'Nigeria',
        state: stateName.trim() || undefined,
        city: city.trim() || undefined,
        street: street.trim() || undefined,
        address: formattedAddress,
        formattedAddress,
        phone: formattedPhone,
        email: email.trim() || undefined,
      });

      toast.success(`Branch '${newBranch.name}' created successfully!`);
      if (onSuccess) onSuccess(newBranch);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stateOptions = states.map((s) => ({ label: s.name, value: s.name }));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0c080b]/95 border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-7 relative overflow-hidden my-auto max-h-[90vh] flex flex-col backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 text-[#d4a8c9] flex items-center justify-center shrink-0 shadow-inner">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Create New Branch</h3>
              <p className="text-xs text-slate-400">Add a store, warehouse, or operational branch</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1">
          {/* Quick-fill Button */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
            <span className="text-slate-300 font-medium">Use organization details?</span>
            <button
              type="button"
              onClick={handlePrefillFromOrg}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#714b67]/30 hover:bg-[#714b67]/50 border border-[#714b67]/40 text-[#d4a8c9] text-xs font-semibold transition cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Use Org Address & Phone</span>
            </button>
          </div>

          {/* General Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">
                Branch Name <span className="text-rose-400">*</span>
              </Label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!code) {
                      setCode(generateCode(e.target.value));
                    }
                  }}
                  placeholder="e.g. Ikeja Store or Abuja Warehouse"
                  className="pl-10 h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Branch Code</Label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="e.g. IKJ"
                  maxLength={6}
                  className="pl-10 h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs font-mono uppercase focus:border-[#714b67] shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Branch Phone</Label>
              <div className="relative flex items-center h-10 bg-[#160f14] border border-white/10 rounded-xl text-xs transition-all focus-within:ring-1 focus-within:ring-[#714b67] focus-within:border-[#714b67]">
                <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-200">+234</span>
                </div>
                <input
                  type="tel"
                  placeholder="801 234 5678"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value)}
                  className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-600 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Branch Email (Optional)</Label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="branch@company.com"
                  className="pl-10 h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Split Physical Address */}
          <div className="p-4 rounded-2xl bg-[#160f14]/80 border border-white/10 space-y-3 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-[#d4a8c9]" />
              <span>Physical Address</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Street / Area Address</Label>
              <Input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. 14 Marina Road, Victoria Island"
                className="bg-black/60 border-white/15 text-xs text-white rounded-xl h-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">City / Town</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Ikeja"
                  className="bg-black/60 border-white/15 text-xs text-white rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">State</Label>
                <CustomSelect
                  value={stateName}
                  onChange={setStateName}
                  options={stateOptions}
                  placeholder="Select State"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Country</Label>
                <Input
                  value={country}
                  disabled
                  className="bg-white/5 border-white/10 text-slate-400 cursor-not-allowed text-xs rounded-xl h-10"
                />
              </div>
            </div>
          </div>

          {/* Primary Checkbox */}
          {branches.length > 0 && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#160f14] border border-white/10 text-xs text-slate-300 cursor-pointer hover:border-white/20 transition-all">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-black text-[#714b67] focus:ring-[#714b67]"
              />
              <span>Set as Primary Branch for this organization</span>
            </label>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs h-10 px-4 bg-transparent border-white/10 hover:bg-white/5 text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs h-10 px-5 bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white font-medium rounded-xl shadow-lg shadow-[#714b67]/20 cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Branch'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BranchCreationModal;
