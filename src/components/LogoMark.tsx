'use client';

// src/components/LogoMark.tsx
// SVG inline logo mark — radio tower with equalizer bars.
// Used in the navbar and any in-app branding spots.
// Accepts size and className props so it scales cleanly at any context.

import React from 'react';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export default function LogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PromptFM logo"
      className={className}
    >
      {/* Dark background circle */}
      <rect width="64" height="64" rx="14" fill="#09090b" />

      {/* Outer signal arc — right */}
      <path
        d="M44 18 C50 23, 53 29.5, 53 36 C53 42.5, 50 49, 44 54"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Inner signal arc — right */}
      <path
        d="M40 22 C44.5 26, 47 31, 47 36 C47 41, 44.5 46, 40 50"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Outer signal arc — left */}
      <path
        d="M20 18 C14 23, 11 29.5, 11 36 C11 42.5, 14 49, 20 54"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Inner signal arc — left */}
      <path
        d="M24 22 C19.5 26, 17 31, 17 36 C17 41, 19.5 46, 24 50"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Center broadcast dot */}
      <circle cx="32" cy="36" r="3.5" fill="#34d399" />

      {/* Equalizer bars rising from center dot */}
      {/* Bar 1 — leftmost, short */}
      <rect x="18" y="28" width="4" height="8" rx="2" fill="#34d399" opacity="0.6" />
      {/* Bar 2 — left-center, tall */}
      <rect x="24" y="22" width="4" height="14" rx="2" fill="#34d399" opacity="0.85" />
      {/* Bar 3 — right-center, medium */}
      <rect x="36" y="25" width="4" height="11" rx="2" fill="#34d399" opacity="0.85" />
      {/* Bar 4 — rightmost, short */}
      <rect x="42" y="29" width="4" height="7" rx="2" fill="#34d399" opacity="0.6" />

      {/* Subtle glow behind bars */}
      <rect x="18" y="22" width="28" height="16" rx="4" fill="#34d399" opacity="0.04" />
    </svg>
  );
}

