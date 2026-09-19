import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Phone, CheckCircle2 } from 'lucide-react';

export interface PhoneNumberFieldProps {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  phoneVerified?: boolean;
  disabled?: boolean;
  className?: string;
}

export const PhoneNumberField: React.FC<PhoneNumberFieldProps> = ({
  value = '',
  onChange,
  error,
  phoneVerified = false,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-slate-300">Phone Number</Label>
          <span className="text-[11px] text-slate-500 font-normal">(Optional)</span>
        </div>
        {phoneVerified ? (
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-xs border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Verified</span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-normal">Unverified</span>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-500 pointer-events-none">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <Input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g. 0801 234 5678 or +234 801 234 5678"
          className="bg-black/60 border-white/10 text-white pl-9 focus:border-[#714b67] rounded-xs h-11 text-sm placeholder:text-slate-600"
        />
      </div>

      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Used for recovery and optional SMS notifications. Nigerian mobile networks supported.
        </p>
      )}
    </div>
  );
};
