'use client';

import React from 'react';

/**
 * Graceful fallback shown in place of the live WebGL stage when it can't run
 * (no WebGL / reduced motion). Renders the pre-captured poster for the beat,
 * over a brand-gradient safety net so nothing ever looks broken.
 */
export function StagePoster({
  beat,
  className,
}: {
  beat: string;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={className}
      aria-hidden
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0b1020 0%, #111a33 50%, #1a2747 100%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/landing/beats/${beat}.png`}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}
