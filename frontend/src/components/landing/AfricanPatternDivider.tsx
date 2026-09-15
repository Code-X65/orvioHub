import React from 'react';

export const AfricanPatternDivider: React.FC<{ className?: string; opacity?: number }> = ({
  className = '',
  opacity = 0.8,
}) => {
  return (
    <div className={`w-full overflow-hidden flex items-center justify-center py-2 ${className}`}>
      <svg
        width="100%"
        height="18"
        viewBox="0 0 1200 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full text-[#FDB02F]"
        style={{ opacity }}
        preserveAspectRatio="repeat-x"
      >
        <pattern id="africanPattern" width="120" height="18" patternUnits="userSpaceOnUse">
          {/* Chevron and zig-zag motifs in gold (#FDB02F) and purple (#714B67) */}
          <path d="M 0 9 L 10 0 L 20 9 L 30 0 L 40 9 L 50 0 L 60 9" stroke="#FDB02F" strokeWidth="1.5" fill="none" opacity="0.9" />
          <path d="M 0 9 L 10 18 L 20 9 L 30 18 L 40 9 L 50 18 L 60 9" stroke="#714B67" strokeWidth="1.5" fill="none" opacity="0.9" />
          
          {/* Diamond center with dot */}
          <polygon points="75,2 85,9 75,16 65,9" stroke="#FDB02F" strokeWidth="1.5" fill="none" />
          <circle cx="75" cy="9" r="2" fill="#714B67" />
          
          {/* Parallel geometric hatch marks */}
          <line x1="92" y1="3" x2="92" y2="15" stroke="#FDB02F" strokeWidth="1.5" />
          <line x1="97" y1="3" x2="97" y2="15" stroke="#714B67" strokeWidth="1.5" />
          <line x1="102" y1="3" x2="102" y2="15" stroke="#FDB02F" strokeWidth="1.5" />
          <line x1="107" y1="3" x2="107" y2="15" stroke="#714B67" strokeWidth="1.5" />
          
          {/* Triangular end symbol */}
          <polygon points="112,4 118,9 112,14" fill="#FDB02F" opacity="0.8" />
        </pattern>
        <rect width="100%" height="18" fill="url(#africanPattern)" />
      </svg>
    </div>
  );
};

export default AfricanPatternDivider;
