import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { StateSelector } from '@/components/location/StateSelector';
import { LgaSelector } from '@/components/location/LgaSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Tag, X, Edit2, Mail, MapPin, Copy, Phone } from 'lucide-react';

interface BranchEditModalProps {
  isOpen: boolean;
  branch: Branch | null;
  onClose: () => void;
  onSuccess?: (updated: Branch) => void;
}

export const BranchEditModal: React.FC<BranchEditModalProps> = ({
  isOpen,
  branch,
  onClose,
  onSuccess,
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { updateBranch } = useBranchStore();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split Nigerian Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const [stateCode, setStateCode] = useState('LA');
  const [lga, setLga] = useState('');
  const country = 'Nigeria';

  const cleanPhone = (val: string) => {
    let raw = val.replace(/\s+/g, '');
    if (raw.startsWith('+234')) raw = raw.slice(4);
    else if (raw.startsWith('234')) raw = raw.slice(3);
    else if (raw.startsWith('0')) raw = raw.slice(1);
    return raw;
  };

  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setCode(branch.code || '');
      setEmail(branch.email || '');
      
      if (branch.phone) {
        setPhoneDigits(cleanPhone(branch.phone));
      } else {
        setPhoneDigits('');
      }

      setStreet(branch.street || (typeof branch.address === 'string' && branch.address ? branch.address.split(',')[0] : ''));
      setCity(branch.city || '');
      setStateName(branch.state || 'Lagos');
      setStateCode(branch.stateCode || 'LA');
      setLga(branch.lga || '');
    }
  }, [branch]);

  const handlePrefillFromOrg = async () => {
    try {
      const ws = currentWorkspace as any;
      const meta = ws?.metadata || {};
      let orgStreet = ws?.street || meta.street || '';
      let orgCity = ws?.city || meta.city || '';
      let orgState = ws?.state || meta.state || '';
      let orgPhone = ws?.phone || meta.phone || '';

      const orgId = ws?.id || (branch as any)?.workspaceId;
      if (!orgStreet && !orgPhone && orgId) {
        const res = await api.get<any>(`/workspaces/${orgId}`).catch(() => null);
        const orgData = res?.workspace || res;
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

  if (!isOpen || !branch || typeof document === 'undefined') return null;

  const branchId = branch.id || branch._id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Branch name is required.');
      return;
    }
    if (!branchId) return;

    setIsSubmitting(true);
    try {
      const formattedPhone = phoneDigits.trim() ? `+234${cleanPhone(phoneDigits)}` : undefined;
      const addressParts = [street.trim(), city.trim(), lga.trim(), stateName.trim(), country].filter(Boolean);
      const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

      const updated = await updateBranch(branchId, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        country: 'Nigeria',
        state: stateName.trim() || undefined,
        stateCode: stateCode || undefined,
        lga: lga.trim() || undefined,
        city: city.trim() || undefined,
        street: street.trim() || undefined,
        address: formattedAddress,
        formattedAddress,
        phone: formattedPhone,
        email: email.trim() || undefined,
      });

      toast.success(`Branch '${name}' updated successfully.`);
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Edit Branch Details</h3>
              <p className="text-xs text-slate-400">Update location, contact info, and naming</p>
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
            <span className="text-slate-300 font-medium">Reset to organization details?</span>
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ikeja Store"
                  className="pl-10 h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  required
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
              <StateSelector value={stateCode || stateName} onChange={(code, name) => { setStateCode(code); setStateName(name); setLga(''); }} label="State" />
              <LgaSelector stateCode={stateCode || stateName} value={lga} onChange={setLga} label="LGA" />
              <div className="space-y-1.5"><Label className="text-xs text-slate-300 font-medium">City / Area</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ikeja" className="bg-black/60 border-white/15 text-xs text-white rounded-xl h-10" /></div>
            </div>
          </div>

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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BranchEditModal;
