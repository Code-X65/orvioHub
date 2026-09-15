import React from 'react';
import { cn } from '@/lib/utils';

export interface InventoryIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export const InventoryIcon: React.FC<InventoryIconProps> = ({
  className,
  size,
  width,
  height,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size || width || '100%'}
      height={size || height || '100%'}
      className={cn('inline-block shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="18" y="24" width="12" height="16" rx="2" fill="#F59E0B" />
      <rect x="34" y="24" width="12" height="16" rx="2" fill="#06B6D4" />
      <polygon points="26,20 22,24 26,28" fill="#F59E0B" />
      <polygon points="38,36 42,40 38,44" fill="#06B6D4" />
    </svg>
  );
};

export default InventoryIcon;
