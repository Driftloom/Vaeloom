'use client';

/**
 * Shared landing primitives — Vaeloom's existing design language,
 * elevated for a marketing surface. Server-safe where possible;
 * interactive pieces are isolated client components.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/* ------------------------------------------------------------------ */
/* Container / Section                                                 */
/* ------------------------------------------------------------------ */

export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

export function Section({
  id,
  children,
  className = '',
  labelledBy,
  as: Tag = 'section',
  innerRef,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  as?: 'section' | 'div';
  innerRef?: React.RefObject<HTMLElement>;
}) {
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      ref={innerRef as React.Ref<never>}
      className={`relative py-20 sm:py-28 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="landing-eyebrow mb-3">{children}</p>;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  align = 'center',
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]"
      >
        {title}
      </h2>
      {intro ? (
        <p className="mt-5 text-base leading-relaxed text-text-secondary sm:text-lg">{intro}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal — scroll entrance (motion, reduced-motion aware)             */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* GlassCard                                                           */
/* ------------------------------------------------------------------ */

export function GlassCard({
  children,
  className = '',
  hover = true,
  tilt = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!tilt || reduce) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e: MouseEvent): void => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateZ(0)`;
    };
    const onLeave = (): void => {
      el.style.transform = '';
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [tilt, reduce]);

  return (
    <div
      ref={ref}
      className={`landing-panel rounded-2xl transition-[border-color,box-shadow,transform] duration-300 will-change-transform ${
        hover ? 'hover:-translate-y-0.5 hover:border-primary-500/40 hover:shadow-glow' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function PillBadge({
  children,
  dot = false,
  className = '',
}: {
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-elevated/60 px-3.5 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm ${className}`}
    >
      {dot ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

const BTN_VARIANTS = {
  primary:
    'bg-action text-action-fg shadow-glow hover:bg-action-hover active:bg-action-active hover:shadow-glow-lg',
  secondary:
    'border border-border-strong bg-surface-elevated/50 text-text hover:border-primary-500/50 hover:text-text',
  ghost: 'text-text-secondary hover:text-text hover:bg-surface-hover',
} as const;

const BTN_SIZES = {
  md: 'h-10 px-5',
  lg: 'h-12 px-7 text-base',
} as const;

type ButtonLinkProps = {
  href: string;
  variant?: keyof typeof BTN_VARIANTS;
  size?: keyof typeof BTN_SIZES;
  children: React.ReactNode;
  className?: string;
  magnetic?: boolean;
};

/**
 * Magnetic CTA — subtle cursor attraction, disabled for reduced motion
 * and touch. Pure transform; no layout cost.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'lg',
  children,
  className = '',
  magnetic = false,
}: ButtonLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const enabled = magnetic && !reduce;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e: MouseEvent): void => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.12}px, ${dy * 0.18}px)`;
    };
    const onLeave = (): void => {
      el.style.transform = '';
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  const cls = `${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`;
  const external = href.startsWith('#');
  if (external) {
    return (
      <a href={href} ref={ref} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} ref={ref} className={cls}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Inline icons (repo convention: hand-drawn SVG, stroke-based)         */
/* ------------------------------------------------------------------ */

const ICON_PATHS: Record<string, React.ReactNode> = {
  memory: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />
      <circle cx="12" cy="3.5" r="1.4" />
      <circle cx="19" cy="16" r="1.4" />
      <circle cx="5" cy="16" r="1.4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="15.5" r="1.2" />
    </>
  ),
  'check-shield': (
    <>
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4.5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 17.5c5-.5 7.5-3 8-9" strokeDasharray="2.5 3" />
    </>
  ),
  undo: (
    <>
      <path d="M4 10h9a5 5 0 0 1 0 10H8" />
      <path d="M8 6l-4 4 4 4" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  github: (
    <>
      <path d="M12 3a9 9 0 0 0-2.85 17.54c.45.08.61-.2.61-.44v-1.7c-2.4.52-2.94-1.01-2.94-1.01-.41-1.02-.99-1.29-.99-1.29-.81-.55.06-.54.06-.54.89.06 1.36.91 1.36.91.8 1.37 2.09.97 2.6.74.08-.58.31-.97.56-1.19-1.92-.22-3.94-.96-3.94-4.28 0-.95.34-1.72.9-2.33-.09-.22-.39-1.11.08-2.31 0 0 .73-.23 2.4.9a8.3 8.3 0 0 1 4.36 0c1.66-1.13 2.39-.9 2.39-.9.48 1.2.18 2.09.09 2.31.56.61.9 1.38.9 2.33 0 3.33-2.03 4.06-3.96 4.27.32.28.59.81.59 1.64v2.43c0 .24.16.53.62.44A9 9 0 0 0 12 3z" />
    </>
  ),
  drive: (
    <>
      <path d="M8.5 4h7l5 8.5-3.5 6H7L3.5 12.5 8.5 4z" />
      <path d="M8.5 4l5 8.5m5 0H7m0 0L10.5 24" strokeWidth="1.4" opacity="0" />
      <path d="M13.5 12.5L18.5 21M7 12.5h11.5M13.5 12.5L8.5 4" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7z" />
      <path d="M8.5 13.5h7M8.5 13.5l2-2m-2 2l2 2" />
    </>
  ),
  code: (
    <>
      <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
    </>
  ),
  plug: (
    <>
      <path d="M9 7V3.5M15 7V3.5" />
      <path d="M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0V7z" />
      <path d="M12 16v4.5" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6l6 6-6 6" />,
  spark: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" />,
};

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.6,
}: {
  name: keyof typeof ICON_PATHS | string;
  className?: string;
  strokeWidth?: number;
}) {
  const node = ICON_PATHS[name as keyof typeof ICON_PATHS] ?? ICON_PATHS['spark'];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {node}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11 rounded-2xl' : 'h-9 w-9 rounded-xl';
  const letter = size === 'lg' ? 'text-xl' : 'text-base';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center bg-gradient-to-br from-primary-500 to-accent-400 font-display font-bold text-white shadow-glow ${box} ${letter}`}
    >
      V
    </span>
  );
}
