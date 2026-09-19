import React from 'react';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

export interface ReadOnlyCountryFieldProps {
  label?: string;
  className?: string;
}

export const ReadOnlyCountryField: React.FC<ReadOnlyCountryFieldProps> = ({
  label = 'Country',
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-slate-300">{label}</Label>
        <span className="text-[10px] text-amber-400/90 flex items-center gap-1 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded-xs border border-amber-400/20">
          <Lock className="w-2.5 h-2.5" />
          <span>Regional MVP</span>
        </span>
      </div>
      <div className="relative">
        <input
          type="text"
          value="Nigeria"
          readOnly
          disabled
          aria-readonly="true"
          className="readOnlyField flex h-11 w-full rounded-xs border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 shadow-inner cursor-not-allowed opacity-80 select-none pointer-events-none focus:outline-none"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400 pointer-events-none">
          <span className="text-base leading-none" role="img" aria-label="Nigeria">🇳🇬</span>
          <span className="text-[11px] font-mono text-slate-500">NG</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Orviohub MVP is currently available for businesses and users in Nigeria only.
      </p>
    </div>
  );
};
