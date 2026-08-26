import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password?: string;
  showRequirements?: boolean;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password = '',
  showRequirements = true,
}) => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const passedCount = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  let strengthLabel = 'Weak';
  let strengthColor = 'bg-rose-500';

  if (passedCount <= 2) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-rose-500';
  } else if (passedCount === 3) {
    strengthLabel = 'Fair';
    strengthColor = 'bg-amber-500';
  } else if (passedCount === 4) {
    strengthLabel = 'Good';
    strengthColor = 'bg-blue-500';
  } else if (passedCount === 5) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500';
  }

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Password strength:</span>
        <span className={`font-semibold ${
          passedCount >= 4 ? 'text-emerald-600 dark:text-emerald-400' :
          passedCount === 3 ? 'text-blue-600 dark:text-blue-400' :
          passedCount === 2 ? 'text-amber-600 dark:text-amber-400' :
          'text-rose-600 dark:text-rose-400'
        }`}>
          {strengthLabel}
        </span>
      </div>

      {/* Strength Bar */}
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
        {[1, 2, 3, 4, 5].map((index) => {
          const isFilled = index <= passedCount;
          return (
            <div
              key={index}
              className={`h-full flex-1 rounded-full transition-all duration-300 ${
                isFilled ? strengthColor : 'bg-slate-200 dark:bg-slate-700/60'
              }`}
            />
          );
        })}
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
          <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            {hasMinLength ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
            <span>At least 8 characters</span>
          </div>

          <div className={`flex items-center gap-1.5 ${hasUppercase && hasLowercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            {hasUppercase && hasLowercase ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
            <span>Upper & lowercase letters</span>
          </div>

          <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            {hasNumber ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
            <span>At least one number</span>
          </div>

          <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
            {hasSpecial ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
            <span>Special character (!@#$)</span>
          </div>
        </div>
      )}
    </div>
  );
};
