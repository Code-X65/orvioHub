import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedDataUrl: string) => Promise<void>;
  currentAvatarUrl?: string;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentAvatarUrl,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setErrorMessage(null);
      if (currentAvatarUrl && !imageSrc) {
        setImageSrc(currentAvatarUrl);
      }
    }
  }, [isOpen, currentAvatarUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WEBP, or GIF).');
      return;
    }

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 5MB. Please choose a smaller file.');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageSrc) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageSrc || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !imageSrc || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const generateCroppedImage = useCallback((): string | null => {
    if (!imageSrc || !imageRef.current) return null;

    const canvas = document.createElement('canvas');
    const targetSize = 300; // 300x300 high resolution avatar
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, targetSize, targetSize);

    // Save initial state
    ctx.save();

    // Center coordinates
    ctx.translate(targetSize / 2, targetSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const img = imageRef.current;
    const baseScale = Math.max(targetSize / img.naturalWidth, targetSize / img.naturalHeight);
    const renderWidth = img.naturalWidth * baseScale * zoom;
    const renderHeight = img.naturalHeight * baseScale * zoom;

    // Apply translation from pan
    ctx.drawImage(
      img,
      -renderWidth / 2 + position.x,
      -renderHeight / 2 + position.y,
      renderWidth,
      renderHeight
    );

    ctx.restore();

    // Compress to high quality JPEG
    return canvas.toDataURL('image/jpeg', 0.9);
  }, [imageSrc, zoom, rotation, position]);

  const handleSave = async () => {
    const croppedUrl = generateCroppedImage();
    if (!croppedUrl) {
      toast.error('Failed to generate cropped image.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(croppedUrl);
      toast.success('Profile avatar updated successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save avatar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#714b67]" />
            <h3 className="text-sm font-semibold text-white">Edit Profile Photo</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Viewport / Crop Box */}
          <div className="relative flex flex-col items-center justify-center">
            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              className={`relative w-64 h-64 rounded-full overflow-hidden bg-slate-900 border-2 border-dashed border-[#714b67]/60 shadow-inner flex items-center justify-center cursor-move select-none ${
                !imageSrc ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (!imageSrc) fileInputRef.current?.click();
              }}
            >
              {imageSrc ? (
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    maxWidth: 'none',
                  }}
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <div className="flex flex-col items-center text-center p-6 space-y-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <Upload className="w-8 h-8 text-[#714b67] stroke-[1.5]" />
                  <span className="text-xs font-medium">Click or drag image to upload</span>
                  <span className="text-[10px] text-slate-500">PNG, JPG, WEBP up to 5MB</span>
                </div>
              )}

              {/* Circular Overlay Guideline */}
              {imageSrc && (
                <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" />
              )}
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {imageSrc && (
            <div className="space-y-4 pt-2">
              {/* Zoom & Rotation Controls */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <ZoomOut className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-[#714b67] h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <ZoomIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="h-8 px-2.5 bg-slate-900 border-white/10 hover:bg-slate-800 text-slate-300 text-xs gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate</span>
                </Button>
              </div>

              {/* Upload Different Photo Button */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[#714b67] hover:text-[#9e6890] transition-colors underline underline-offset-4"
                >
                  Choose a different photo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/50">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={!imageSrc || isSaving}
            className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs font-medium px-5 gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Apply Photo
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
