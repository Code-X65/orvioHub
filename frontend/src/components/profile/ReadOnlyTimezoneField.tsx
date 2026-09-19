import React from 'react';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

export interface ReadOnlyTimezoneFieldProps {
  label?: string;
  className?: string;
}

export const ReadOnlyTimezoneField: React.FC<ReadOnlyTimezoneFieldProps> = ({
  label = 'Timezone',
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-slate-300">{label}</Label>
        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-slate-800 px-1.5 py-0.5 rounded-xs border border-white/10">
          <Clock className="w-2.5 h-2.5 text-[#714b67]" />
          <span>UTC +1</span>
        </span>
      </div>
      <div className="relative">
        <input
          type="text"
          value="West Africa Time (WAT)"
          readOnly
          disabled
          aria-readonly="true"
          className="readOnlyField flex h-11 w-full rounded-xs border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 shadow-inner cursor-not-allowed opacity-80 select-none pointer-events-none focus:outline-none"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-[11px] font-mono text-slate-500 pointer-events-none">
          Africa/Lagos
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Canonical IANA timezone for Nigerian timestamps and scheduled operations.
      </p>
    </div>
  );
};
