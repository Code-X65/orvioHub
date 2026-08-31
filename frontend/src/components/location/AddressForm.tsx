import React from 'react';
import { StateSelector } from './StateSelector';
import { LgaSelector } from './LgaSelector';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { COUNTRY_DIAL_CODES } from '@/lib/countryCodes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Home, Hash, Compass, Mail, Globe } from 'lucide-react';

export interface NigerianAddress {
  country?: string; // Default "Nigeria"
  state: string;
  stateCode?: string;
  lga: string;
  city: string;
  street: string;
  blockNumber: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
}

interface AddressFormProps {
  value: NigerianAddress;
  onChange: (updated: NigerianAddress) => void;
  errors?: Partial<Record<keyof NigerianAddress, string>>;
  disabled?: boolean;
  countryFixed?: boolean;
  className?: string;
}

export const AddressForm: React.FC<AddressFormProps> = ({
  value,
  onChange,
  errors = {},
  disabled = false,
  countryFixed = false,
  className = '',
}) => {
  const currentCountry = value.country || 'Nigeria';

  const handleFieldChange = (field: keyof NigerianAddress, val: string) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handleStateChange = (stateCode: string, stateName: string) => {
    onChange({
      ...value,
      state: stateName,
      stateCode: stateCode,
      lga: '', // Reset LGA when state changes
    });
  };

  const countryOptions: SelectOption[] = React.useMemo(() => {
    return COUNTRY_DIAL_CODES.map((c) => ({
      value: c.name,
      label: `${c.flag} ${c.name}`,
      badge: c.dialCode,
      badgeColor: 'bg-white/5 text-slate-300 border border-white/10',
    }));
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Country Selection */}
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300 font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            Country
          </span>
          {currentCountry === 'Nigeria' && (
            <span className="text-[10px] text-[#d4a8c9] font-medium bg-[#714b67]/20 border border-[#714b67]/30 px-2 py-0.5 rounded-full">
              Full State & LGA Directory Active
            </span>
          )}
        </Label>

        <CustomSelect
          options={countryOptions}
          value={currentCountry}
          onChange={(val) => handleFieldChange('country', val)}
          placeholder="Select country"
          searchable={true}
          searchPlaceholder="Search country..."
          icon={<Globe className="w-3.5 h-3.5" />}
          disabled={disabled || countryFixed}
        />
      </div>

      {/* Nigerian State & LGA Grid */}
      {currentCountry === 'Nigeria' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <StateSelector
            value={value.stateCode || value.state}
            onChange={handleStateChange}
            label="State"
            required
            disabled={disabled}
            error={errors.state}
          />

          <LgaSelector
            stateCode={value.stateCode || value.state}
            value={value.lga}
            onChange={(lga) => handleFieldChange('lga', lga)}
            label="Local Government Area (LGA)"
            required
            disabled={disabled}
            error={errors.lga}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-medium">
              State / Province / Region <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={value.state || ''}
                onChange={(e) => handleFieldChange('state', e.target.value)}
                disabled={disabled}
                placeholder="e.g. California, Greater London"
                className="pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-medium">District / County</Label>
            <div className="relative">
              <Compass className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={value.lga || ''}
                onChange={(e) => handleFieldChange('lga', e.target.value)}
                disabled={disabled}
                placeholder="e.g. Orange County"
                className="pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner"
              />
            </div>
          </div>
        </div>
      )}

      {/* City & Area / Neighborhood */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">
            City / Town <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Navigation className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={value.city || ''}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Ikeja, Lekki, Victoria Island"
              className={`pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner ${
                errors.city ? 'border-red-500/80' : ''
              }`}
            />
          </div>
          {errors.city && <p className="text-[11px] text-red-400">{errors.city}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">Area / Neighborhood (Optional)</Label>
          <div className="relative">
            <Compass className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={value.area || ''}
              onChange={(e) => handleFieldChange('area', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Opebi, Allen, Phase 1"
              className="pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Street Address & Block / House Number */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">
            Street Address <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Home className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={value.street || ''}
              onChange={(e) => handleFieldChange('street', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Adeola Odeku Street"
              className={`pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner ${
                errors.street ? 'border-red-500/80' : ''
              }`}
            />
          </div>
          {errors.street && <p className="text-[11px] text-red-400">{errors.street}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">
            Block / House No. <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={value.blockNumber || ''}
              onChange={(e) => handleFieldChange('blockNumber', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Plot 12, Block B"
              className={`pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner ${
                errors.blockNumber ? 'border-red-500/80' : ''
              }`}
            />
          </div>
          {errors.blockNumber && <p className="text-[11px] text-red-400">{errors.blockNumber}</p>}
        </div>
      </div>

      {/* Landmark & Postal Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">Nearest Landmark (Optional)</Label>
          <div className="relative">
            <Compass className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={value.landmark || ''}
              onChange={(e) => handleFieldChange('landmark', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Opposite GTBank, Behind City Mall"
              className="pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white rounded-xl shadow-inner"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300 font-medium">Postal Code (Optional)</Label>
          <div className="relative">
            <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={value.postalCode || ''}
              onChange={(e) => handleFieldChange('postalCode', e.target.value)}
              disabled={disabled}
              placeholder="e.g. 100001"
              maxLength={10}
              className="pl-9 h-10 bg-[#160f14] border-white/10 focus:border-[#714b67] text-xs text-white font-mono rounded-xl shadow-inner"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
