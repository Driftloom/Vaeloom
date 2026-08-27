'use client';

import { useEffect, useRef } from 'react';

type MeteorShowerProps = {
  /** Override the auto-detected theme. */
  theme?: 'dark' | 'light';
  /** Density multiplier — more simultaneous streaks. Default 1. */
  density?: number;
  className?: string;
  /** z-index of the canvas layer. Default 1 (behind text, above background). */
  zIndex?: number;
};

type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  decay: number;
  base: string; // rgba prefix, e.g. 'rgba(120,200,255,'
  width: number;
};

/**
 * Lightweight shooting-star / meteor shower rendered on a 2D canvas.
 * Self-contained: auto-detects the active theme from the <html> class and
 * pauses under prefers-reduced-motion, when the tab is hidden, or when the
 * canvas scrolls off-screen. Drop it into any `relative`/`absolute` container.
 */
export default function MeteorShower({
  theme,
  density = 1,
  className = '',
  zIndex = 1,
}: MeteorShowerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // static fallback: no animation

    const themeRef = { current: theme ?? 'dark' };
    const syncTheme = () => {
      themeRef.current =
        theme ?? (document.documentElement.classList.contains('light') ? 'light' : 'dark');
    };
    syncTheme();
    const mo = new MutationObserver(syncTheme);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const palette = () =>
      themeRef.current === 'dark'
        ? { head: 'rgba(225,245,255,', trail: 'rgba(120,200,255,' }
        : { head: 'rgba(40,70,110,', trail: 'rgba(90,140,200,' };

    let width = 0;
    let height = 0;
    let dpr = 1;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const meteors: Meteor[] = [];
    let lastSpawn = 0;
    const d = Math.max(0.4, density);
    const spawnInterval = 380 / d;
    const maxMeteors = Math.round(16 * d);

    const spawn = () => {
      const c = palette();
      const startX = Math.random() * width;
      const startY = -20 - Math.random() * height * 0.15;
      const angle = ((18 + Math.random() * 16) * Math.PI) / 180;
      const speed = 7 + Math.random() * 7;
      meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed * (Math.random() < 0.8 ? 1 : -1),
        vy: Math.sin(angle) * speed,
        len: 90 + Math.random() * 140,
        life: 1,
        decay: 0.006 + Math.random() * 0.01,
        base: Math.random() < 0.5 ? c.head : c.trail,
        width: 1 + Math.random() * 1.6,
      });
    };

    let raf = 0;
    let last = performance.now();
    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      last = now;
      if (!onScreen || document.hidden) return;

      ctx.clearRect(0, 0, width, height);

      lastSpawn += dt;
      if (lastSpawn > spawnInterval && meteors.length < maxMeteors) {
        lastSpawn = 0;
        spawn();
        if (Math.random() < 0.3) spawn();
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        if (!m) continue;
        m.x += m.vx;
        m.y += m.vy;
        m.life -= m.decay;
        if (m.life <= 0 || m.y > height + 60 || m.x < -80 || m.x > width + 80) {
          meteors.splice(i, 1);
          continue;
        }
        const sp = Math.hypot(m.vx, m.vy) || 1;
        const tx = m.x - (m.vx / sp) * m.len;
        const ty = m.y - (m.vy / sp) * m.len;
        const a = Math.max(0, Math.min(1, m.life)) * 0.9;
        const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, `${m.base}${a})`);
        grad.addColorStop(1, `${m.base}0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = `${palette().head}${a})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.width * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [theme, density]);

  return (
    <canvas
      ref={canvasRef}
      data-meteor-shower=""
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ zIndex }}
    />
  );
}
