import React, { useEffect } from 'react';
import { useLocationStore, type NigerianLga } from '@/stores/useLocationStore';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Building2 } from 'lucide-react';

interface LgaSelectorProps {
  stateCode?: string;
  value?: string;
  onChange: (lgaName: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export const LgaSelector: React.FC<LgaSelectorProps> = ({
  stateCode,
  value,
  onChange,
  label = 'Local Government Area (LGA)',
  error,
  disabled = false,
  required = false,
  className = '',
  placeholder = 'Select Local Government Area',
}) => {
  const { lgasByState, isLoadingLgas, fetchLgas } = useLocationStore();

  const normalizedStateCode = stateCode ? stateCode.trim().toUpperCase() : '';
  const lgas = normalizedStateCode ? lgasByState[normalizedStateCode] || [] : [];
  const isLoading = normalizedStateCode ? Boolean(isLoadingLgas[normalizedStateCode]) : false;

  useEffect(() => {
    if (normalizedStateCode) {
      fetchLgas(normalizedStateCode);
    }
  }, [normalizedStateCode, fetchLgas]);

  const options: SelectOption[] = lgas.map((l: NigerianLga) => ({
    value: l.name,
    label: l.name,
  }));

  const dynamicPlaceholder = !normalizedStateCode
    ? 'Select state first'
    : isLoading
    ? 'Loading LGAs...'
    : placeholder;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label className="text-xs text-slate-300 font-medium flex items-center justify-between">
          <span>
            {label} {required && <span className="text-red-400">*</span>}
          </span>
          {isLoading && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Spinner size="sm" />
              <span>Loading LGAs...</span>
            </span>
          )}
        </Label>
      )}

      <CustomSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={dynamicPlaceholder}
        searchable={true}
        searchPlaceholder="Search LGA..."
        icon={<Building2 className="w-3.5 h-3.5" />}
        disabled={disabled || !normalizedStateCode || isLoading}
        error={error}
      />

      {!normalizedStateCode && !disabled && (
        <p className="text-[10px] text-slate-500">
          Please select a state to load local government areas.
        </p>
      )}
    </div>
  );
};
