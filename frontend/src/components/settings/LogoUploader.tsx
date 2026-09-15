import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LogoUploaderProps {
  value?: string;
  onChange: (url: string, storageId?: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  label = 'Organization Logo',
  helperText = 'PNG, JPG, or SVG up to 2MB. Square (1:1) recommended.',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(value);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit.');
      return;
    }

    // Validate MIME type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('Invalid image format. Supported formats: PNG, JPG, WebP, SVG.');
      return;
    }

    setIsUploading(true);
    try {
      // Read local preview first
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // In browser demo / local dev, simulate upload or use base64 data URL
      onChange(reader.result as string || URL.createObjectURL(file));
      toast.success('Logo uploaded successfully.');
    } catch (err: any) {
      toast.error('Failed to process image: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onRemove) {
      onRemove();
    } else {
      onChange('');
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-slate-200 block">{label}</label>

      <div className="flex items-center gap-4">
        {/* Preview Box */}
        <div className="relative w-20 h-20 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group">
          {preview ? (
            <>
              <img src={preview} alt="Logo preview" className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-rose-400"
                  title="Remove Logo"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-600" />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#e6a8d6] animate-spin" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5 flex-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={disabled || isUploading}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="h-8 text-xs border-white/10 hover:bg-[#714b67]/20 hover:text-white"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-[#e6a8d6]" />
              {preview ? 'Change Logo' : 'Upload Logo'}
            </Button>

            {preview && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Remove
              </Button>
            )}
          </div>

          <p className="text-[11px] text-slate-400">{helperText}</p>
        </div>
      </div>
    </div>
  );
};
