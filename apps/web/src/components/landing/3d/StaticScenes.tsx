'use client';

/**
 * Static fallbacks — beautiful SVG compositions shown when WebGL is
 * unavailable or prefers-reduced-motion is set. They preserve the full
 * product story with zero canvas dependency and render server-side.
 */

import { useEffect, useState } from 'react';
import { Container } from '@/components/landing/shared/LandingKit';

/* ---------------------------- Memory core ---------------------------- */

/** Server/client trig can differ in the last ulp — pin to 3 decimals so SSR HTML matches hydration exactly. */
const fp = (v: number): number => Math.round(v * 1000) / 1000;

const CORE_COLORS = {
  dark: { line: '#7c8cf8', cyan: '#22d3ee', pink: '#e879f9' },
  light: { line: '#4f46e5', cyan: '#0891b2', pink: '#c026d3' },
} as const;

export function StaticMemoryCore() {
  // Hydration-safe: SSR always paints brand-dark; resolved post-mount.
  const [mode, setMode] = useState<keyof typeof CORE_COLORS>('dark');
  useEffect(() => {
    setMode(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  }, []);
  const { line, cyan, pink } = CORE_COLORS[mode];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" aria-hidden="true">
      <svg viewBox="0 0 400 400" className="h-full w-full">
        <defs>
          <radialGradient id="smc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={line} stopOpacity="0.5" />
            <stop offset="60%" stopColor={line} stopOpacity="0.12" />
            <stop offset="100%" stopColor={line} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="150" fill="url(#smc-glow)" />
        {/* converging streams */}
        {[0, 72, 144, 216, 288].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = fp(200 + Math.cos(rad) * 185);
          const y1 = fp(200 + Math.sin(rad) * 185);
          const x2 = fp(200 + Math.cos(rad) * 62);
          const y2 = fp(200 + Math.sin(rad) * 62);
          const color = i % 2 === 0 ? cyan : i % 3 === 0 ? pink : line;
          return (
            <g key={deg}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeOpacity="0.55"
                strokeWidth="1.6"
                className="landing-flow-line"
                pathLength={100}
              />
              <circle cx={x1} cy={y1} r="5" fill={color} fillOpacity="0.9" />
            </g>
          );
        })}
        {/* lattice shell */}
        <circle
          cx="200"
          cy="200"
          r="62"
          fill="none"
          stroke={line}
          strokeOpacity="0.7"
          strokeWidth="1.4"
        />
        <circle
          cx="200"
          cy="200"
          r="88"
          fill="none"
          stroke={line}
          strokeOpacity="0.28"
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        <circle cx="200" cy="200" r="26" fill={line} fillOpacity="0.9" />
        {/* remembered motes */}
        {[
          [120, 140],
          [280, 130],
          [300, 250],
          [110, 260],
          [200, 320],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill={line} fillOpacity="0.6" />
        ))}
      </svg>
    </div>
  );
}

/* -------------------------- Knowledge graph -------------------------- */

const STATIC_NODES: Array<{ x: number; y: number; r: number; c: string }> = [
  { x: 200, y: 205, r: 10, c: 'var(--landing-node-skill)' },
  { x: 96, y: 120, r: 7, c: 'var(--landing-node-project)' },
  { x: 300, y: 105, r: 7, c: 'var(--landing-node-project)' },
  { x: 330, y: 220, r: 8, c: 'var(--landing-node-org)' },
  { x: 70, y: 250, r: 6, c: 'var(--landing-node-person)' },
  { x: 160, y: 320, r: 6, c: 'var(--landing-node-document)' },
  { x: 275, y: 315, r: 6, c: 'var(--landing-node-event)' },
  { x: 40, y: 165, r: 5, c: 'var(--landing-node-person)' },
  { x: 250, y: 55, r: 5, c: 'var(--landing-node-document)' },
];

const STATIC_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 7],
  [2, 8],
  [3, 6],
];

export function StaticGraph() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" aria-hidden="true">
      <svg viewBox="0 0 400 380" className="h-full w-full">
        {STATIC_EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={STATIC_NODES[a]!.x}
            y1={STATIC_NODES[a]!.y}
            x2={STATIC_NODES[b]!.x}
            y2={STATIC_NODES[b]!.y}
            stroke="currentColor"
            className="text-text-muted"
            strokeOpacity="0.35"
            strokeWidth="1.2"
          />
        ))}
        {STATIC_NODES.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r + 6} fill={n.c} fillOpacity="0.15" />
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------- Agent orbit ----------------------------- */

export function StaticOrbit({
  labels,
  activeIndex,
  colors,
}: {
  labels: Array<{ id: string; name: string }>;
  activeIndex: number;
  colors: Record<string, string>;
}) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px]">
      <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
        <circle
          cx="200"
          cy="200"
          r="132"
          fill="none"
          stroke="currentColor"
          className="text-text-muted"
          strokeOpacity="0.25"
        />
        <circle cx="200" cy="200" r="30" fill="var(--landing-node-org)" fillOpacity="0.85" />
        <circle
          cx="200"
          cy="200"
          r="52"
          fill="none"
          stroke="var(--landing-node-org)"
          strokeOpacity="0.5"
        />
        <text
          x="200"
          y="204"
          textAnchor="middle"
          fontSize="11"
          fill="currentColor"
          className="fill-text"
        >
          memory
        </text>
      </svg>
      {/* agent chips positioned on the ring */}
      {labels.map((agent, i) => {
        const angle = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        const x = fp(50 + Math.cos(angle) * 33);
        const y = fp(50 + Math.sin(angle) * 33);
        const active = i === activeIndex;
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => {
              /* selection handled by parent tabs */
            }}
            tabIndex={-1}
            aria-hidden="true"
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[11px] font-medium transition-all ${
              active
                ? 'scale-110 border-primary-400 text-text shadow-glow'
                : 'border-border-subtle text-text-secondary'
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              background: `${colors[agent.id] ?? '#6366f1'}22`,
            }}
          >
            {agent.name}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------- Full-scene fallback wrapper -------------------- */

export function FallbackFrame({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <Container className="relative">
      <div className="landing-panel rounded-3xl p-6 sm:p-10">
        {children}
        {caption ? <p className="mt-4 text-center text-xs text-text-muted">{caption}</p> : null}
      </div>
    </Container>
  );
}
