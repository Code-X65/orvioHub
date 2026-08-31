import React, { useEffect } from 'react';
import { useLocationStore, type NigerianState } from '@/stores/useLocationStore';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { MapPin } from 'lucide-react';

interface StateSelectorProps {
  value?: string;
  onChange: (stateCode: string, stateName: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export const StateSelector: React.FC<StateSelectorProps> = ({
  value,
  onChange,
  label = 'State',
  error,
  disabled = false,
  required = false,
  className = '',
  placeholder = 'Select Nigerian State',
}) => {
  const { states, isLoadingStates, fetchStates } = useLocationStore();

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  const options: SelectOption[] = states.map((s: NigerianState) => {
    const code = s.code || s.stateCode || '';
    return {
      value: code,
      label: s.name,
      badge: code,
      badgeColor: 'bg-[#714b67]/20 text-[#d4a8c9] border border-[#714b67]/30',
    };
  });

  const handleSelect = (selectedCode: string) => {
    const selectedObj = states.find(
      (s) => s.code === selectedCode || s.stateCode === selectedCode || s.name === selectedCode
    );
    onChange(selectedCode, selectedObj?.name || selectedCode);
  };

  // Find matching value code if state name was passed instead of code
  const resolvedValue = React.useMemo(() => {
    if (!value) return '';
    const match = states.find(
      (s) => s.code === value || s.stateCode === value || s.name.toLowerCase() === value.toLowerCase()
    );
    return match ? (match.code || match.stateCode || value) : value;
  }, [value, states]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label className="text-xs text-slate-300 font-medium flex items-center justify-between">
          <span>
            {label} {required && <span className="text-red-400">*</span>}
          </span>
          {isLoadingStates && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Spinner size="sm" />
              <span>Loading states...</span>
            </span>
          )}
        </Label>
      )}

      <CustomSelect
        options={options}
        value={resolvedValue}
        onChange={handleSelect}
        placeholder={isLoadingStates ? 'Loading states...' : placeholder}
        searchable={true}
        searchPlaceholder="Search Nigerian state..."
        icon={<MapPin className="w-3.5 h-3.5" />}
        disabled={disabled || isLoadingStates}
        error={error}
      />
    </div>
  );
};
