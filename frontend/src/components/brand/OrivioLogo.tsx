import React from 'react';

export interface OrivioLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  showWordmark?: boolean;
}

export const OrivioLogo: React.FC<OrivioLogoProps> = ({
  className = '',
  size = 32,
  showWordmark = true,
  ...props
}) => {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Orivio Symbol: Purple (#714B67) top-left, Gold (#FDB02F) bottom-right with compass pointer */}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        {...props}
      >
        {/* Top-left Arc - Purple (#714B67) */}
        <path
          d="M 50 14 A 36 36 0 0 0 24.5 75.5 L 34.5 65.5 A 22 22 0 0 1 50 28 Z"
          fill="#714B67"
        />

        {/* Bottom-right Arc - Gold (#FDB02F) */}
        <path
          d="M 24.5 75.5 A 36 36 0 0 0 86 50 L 72 50 A 22 22 0 0 1 34.5 65.5 Z"
          fill="#FDB02F"
        />

        {/* Compass Pointer Arrow - Gold/Amber pointing Top-Right */}
        <path
          d="M 68 18 L 88 12 L 82 32 L 68 32 L 74 24 Z"
          fill="#FDB02F"
        />
        {/* Arrow base stem shadow / accent */}
        <polygon
          points="50,50 88,12 68,32"
          fill="#714B67"
          opacity="0.8"
        />
        <polygon
          points="50,50 88,12 82,32"
          fill="#FDB02F"
        />

        {/* Outer Circular Ring Ring Blend */}
        <circle cx="50" cy="50" r="30" stroke="transparent" strokeWidth="0" fill="none" />
      </svg>

      {showWordmark && (
        <span className="text-2xl font-bold tracking-tight text-white font-sans flex items-center">
          <span className="text-white">rivio</span>
        </span>
      )}
    </div>
  );
};

export default OrivioLogo;
