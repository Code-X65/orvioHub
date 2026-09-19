import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export interface UnsavedChangesGuardProps {
  isDirty: boolean;
  message?: string;
  showBanner?: boolean;
}

export const UnsavedChangesGuard: React.FC<UnsavedChangesGuardProps> = ({
  isDirty,
  message = 'You have unsaved changes on your profile. Are you sure you want to leave?',
  showBanner = true,
}) => {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  if (!isDirty || !showBanner) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xs text-xs animate-in fade-in duration-200">
      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
      <span>You have unsaved profile changes. Remember to save before navigating away.</span>
    </div>
  );
};
