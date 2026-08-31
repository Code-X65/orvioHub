import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { AddressForm, type NigerianAddress } from '@/components/location/AddressForm';
import { PhoneInput } from '@/components/phone/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Tag, X, Edit2, Mail, MapPin } from 'lucide-react';

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
  const { updateBranch } = useBranchStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Structured Nigerian Address State
  const [address, setAddress] = useState<NigerianAddress>({
    country: 'Nigeria',
    state: '',
    stateCode: '',
    lga: '',
    city: '',
    street: '',
    blockNumber: '',
    area: '',
    landmark: '',
    postalCode: '',
  });

  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof NigerianAddress, string>>>({});

  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setCode(branch.code || '');
      setPhone(branch.phone || '');
      setEmail(branch.email || '');

      setAddress({
        country: branch.country || 'Nigeria',
        state: branch.state || '',
        stateCode: branch.stateCode || '',
        lga: branch.lga || '',
        city: branch.city || '',
        street: branch.street || '',
        blockNumber: branch.blockNumber || '',
        area: branch.area || '',
        landmark: branch.landmark || '',
        postalCode: branch.postalCode || '',
      });
    }
  }, [branch]);

  if (!isOpen || !branch || typeof document === 'undefined') return null;

  const branchId = branch.id || branch._id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Branch name is required.');
      return;
    }
    if (!branchId) return;

    // Validate structured address if any address field is touched
    const errors: Partial<Record<keyof NigerianAddress, string>> = {};
    if (address.state && !address.lga) {
      errors.lga = 'Please select LGA';
    }
    if ((address.state || address.lga) && !address.city) {
      errors.city = 'City / Town is required';
    }
    if ((address.state || address.city) && !address.street) {
      errors.street = 'Street address is required';
    }

    if (Object.keys(errors).length > 0) {
      setAddressErrors(errors);
      toast.error('Please complete the required location address fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateBranch(branchId, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        country: address.country || 'Nigeria',
        state: address.state || undefined,
        stateCode: address.stateCode || undefined,
        lga: address.lga || undefined,
        city: address.city || undefined,
        street: address.street || undefined,
        blockNumber: address.blockNumber || undefined,
        area: address.area || undefined,
        landmark: address.landmark || undefined,
        postalCode: address.postalCode || undefined,
        phone: phone.trim() || undefined,
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
          {/* General Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-branch-name" className="text-xs text-slate-300 font-medium">
                Branch Name <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  id="edit-branch-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ikeja Branch"
                  className="pl-10 h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs focus:border-[#714b67] shadow-inner"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-branch-code" className="text-xs text-slate-300 font-medium">
                Branch Code
              </Label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  id="edit-branch-code"
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
            <PhoneInput
              value={phone}
              onChange={(val) => setPhone(val)}
              label="Contact Phone"
              placeholder="0801 234 5678"
              showVerificationButton={false}
            />

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

          {/* Structured Nigerian Address Form */}
          <div className="p-4 rounded-2xl bg-[#160f14]/80 border border-white/10 space-y-3 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-[#d4a8c9]" />
              <span>Nigerian Physical Address</span>
            </div>
            <AddressForm
              value={address}
              onChange={(updated) => {
                setAddress(updated);
                setAddressErrors({});
              }}
              errors={addressErrors}
            />
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
