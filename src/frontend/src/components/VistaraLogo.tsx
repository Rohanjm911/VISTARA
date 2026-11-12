import React from 'react';

interface VistaraLogoProps {
  size?: number | string;
  className?: string;
  withGlow?: boolean;
  withBadge?: boolean;
  animated?: boolean;
  badgeClassName?: string;
}

export const VistaraLogo: React.FC<VistaraLogoProps> = ({
  size = 32,
  className = '',
  withGlow = false,
  withBadge = false,
  animated = false,
  badgeClassName = '',
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  const logoSvg = (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative select-none ${animated ? 'transition-transform duration-300 hover:scale-105' : ''} ${className}`}
    >
      <defs>
        {/* Left Wing Gradient: Deep Cyan to Vivid Glacier Blue */}
        <linearGradient id="vlLeftWing" x1="16%" y1="20%" x2="48%" y2="86%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="55%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Right Wing Gradient: Vivid Glacier Blue to Pure Specular Sheen */}
        <linearGradient id="vlRightWing" x1="84%" y1="20%" x2="52%" y2="86%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#E0F2FE" />
        </linearGradient>

        {/* Inner Chamber Facet Shadow */}
        <linearGradient id="vlInnerFacet" x1="50%" y1="52%" x2="50%" y2="86%">
          <stop offset="0%" stopColor="#0369A1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#082F49" stopOpacity="0.95" />
        </linearGradient>

        {/* Center Pulsar Core Glow */}
        <radialGradient id="vlCoreGlow" cx="50%" cy="28%" r="45%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
        </radialGradient>

        {/* Specular Edge Highlight */}
        <linearGradient id="vlEdgeHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0.1" />
        </linearGradient>

        {/* Ambient Drop Glow Filter */}
        <filter id="vlNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background Ambient Glow Halo when requested */}
      {withGlow && (
        <circle
          cx="50"
          cy="48"
          r="38"
          fill="#38BDF8"
          opacity="0.22"
          filter="blur(10px)"
        />
      )}

      {/* Orbit Ring: Cosmic Media Horizon */}
      <ellipse
        cx="50"
        cy="48"
        rx="40"
        ry="13"
        transform="rotate(-20 50 48)"
        stroke="url(#vlEdgeHighlight)"
        strokeWidth="1.2"
        strokeDasharray="4 8 26 10"
        opacity="0.45"
      />

      {/* LEFT WING: Precision Aerodynamic Blade */}
      <path
        d="M 16 22 L 47 85 L 47 52 L 32 22 Z"
        fill="url(#vlLeftWing)"
      />

      {/* RIGHT WING: Dynamic Specular Reflection Blade */}
      <path
        d="M 84 22 L 53 85 L 53 52 L 68 22 Z"
        fill="url(#vlRightWing)"
      />

      {/* INNER APEX NOTCH / KEYSTONE */}
      <path
        d="M 47 52 L 50 85 L 53 52 L 50 48 Z"
        fill="url(#vlInnerFacet)"
      />

      {/* UPPER APERTURE STAR BEACON: Precision 4-Point Prismatic Core */}
      <polygon
        points="50,15 57,28 50,41 43,28"
        fill="url(#vlCoreGlow)"
        filter={withGlow ? 'url(#vlNeonGlow)' : undefined}
      />
      {/* Central Diamond Sparkle */}
      <polygon
        points="50,22 53,28 50,34 47,28"
        fill="#FFFFFF"
      />

      {/* Precision Chamfer Edge Highlights */}
      <path
        d="M 16 22 L 32 22 L 47 52"
        stroke="url(#vlEdgeHighlight)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M 84 22 L 68 22 L 53 52"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <line
        x1="50"
        y1="56"
        x2="50"
        y2="85"
        stroke="#38BDF8"
        strokeWidth="1.2"
        opacity="0.8"
      />
    </svg>
  );

  if (withBadge) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-xl bg-[#111722] border border-white/[0.08] shadow-inner p-1.5 transition-all duration-200 ${badgeClassName}`}
      >
        {logoSvg}
      </div>
    );
  }

  return logoSvg;
};
