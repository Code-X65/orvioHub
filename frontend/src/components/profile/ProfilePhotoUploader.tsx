import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { AvatarCropperModal } from './AvatarCropperModal';

export interface ProfilePhotoUploaderProps {
  avatarUrl?: string | null;
  name?: string;
  email?: string;
  onSaveAvatar: (croppedDataUrl: string) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
  disabled?: boolean;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  avatarUrl,
  name = 'User',
  email,
  onSaveAvatar,
  onRemoveAvatar,
  disabled = false,
}) => {
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const initials = (name || email || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    setIsRemoving(true);
    try {
      await onRemoveAvatar();
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <section className="p-5 rounded-lg border border-white/10 bg-slate-900/40 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className="relative group cursor-pointer"
          onClick={() => !disabled && setIsCropperOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && setIsCropperOpen(true)}
          title="Click to update photo"
        >
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#714b67]/60 bg-slate-800 flex items-center justify-center text-white font-semibold text-lg shadow-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          {!disabled && (
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
              <Camera className="w-5 h-5" />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-white">{name}</h4>
          </div>
          {email && <p className="text-xs text-slate-400">{email}</p>}
          <p className="text-[11px] text-slate-500 mt-0.5">JPEG, PNG, or WEBP up to 5MB.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setIsCropperOpen(true)}
          className="text-xs bg-slate-900 border-white/10 text-slate-200 hover:bg-slate-800 gap-1.5"
        >
          <Camera className="w-3.5 h-3.5 text-[#714b67]" />
          <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
        </Button>

        {avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || isRemoving}
            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2"
            title="Remove Photo"
          >
            {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      <AvatarCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onSave={async (dataUrl) => {
          await onSaveAvatar(dataUrl);
          setIsCropperOpen(false);
        }}
        currentAvatarUrl={avatarUrl || undefined}
      />
    </section>
  );
};
