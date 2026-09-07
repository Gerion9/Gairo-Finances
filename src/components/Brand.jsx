import React from 'react';

/** Original Sifran mark. The same geometry is used in the downloadable SVGs. */
export function BrandMark({ size = 32, className = '' }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true" focusable="false">
    <path d="M12 25v-2c0-9 8-15 20-15s20 6 20 15v2H36 M52 39v2c0 9-8 15-20 15S12 50 12 41v-2h16" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export default function Brand({ className = '', tone = 'light', decorative = false }) {
  return <img src={tone === 'dark' ? '/brand/sifran-logo-dark.svg' : '/brand/sifran-logo.svg'} alt={decorative ? '' : 'Sifran'} width="229" height="80" className={`sifran-brand ${className}`} draggable="false" />;
}
