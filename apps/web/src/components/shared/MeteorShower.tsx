'use client';

import { useEffect, useRef } from 'react';

type MeteorShowerProps = {
  /** Force a theme; otherwise auto-detected from the <html> class. */
  theme?: 'dark' | 'light';
  /** Density multiplier. Default 1. */
  density?: number;
  className?: string;
  /** z-index of the canvas. Default 0 (behind content). */
  zIndex?: number;
  /**
   * 'auth' → dims meteors behind the auth form (responsive safe-zone).
   * 'free' → no protection (e.g. landing hero).
   */
  variant?: 'auth' | 'free';
};

type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  decay: number;
  width: number;
  layer: 0 | 1 | 2; // far / mid / near
  hero: boolean;
  alpha: number;
  headR: number;
  headG: number;
  headB: number;
  trailR: number;
  trailG: number;
  trailB: number;
};

type Star = {
  x: number;
  y: number;
  r: number;
  base: number;
  phase: number;
  tw: number;
};

const cssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const parseRGB = (s: string): [number, number, number] => {
  const parts = s.split(/[ ,]+/).map((n) => parseInt(n, 10));
  return [parts[0] || 255, parts[1] || 255, parts[2] || 255];
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Cinematic, fully procedural meteor-shower background rendered on a 2D canvas.
 *
 * Features: consistent directional flow, far/mid/near depth layers, a subtle
 * atmospheric star field, occasional hero meteors, continuous edge-to-edge
 * respawning (no visible restart), a responsive form "clear zone", full
 * theme-token colouring, reduced-motion fallback (static stars), tab-visibility
 * pause and complete cleanup. Drop it into any `relative`/`absolute` container.
 */
export default function MeteorShower({
  theme,
  density = 1,
  className = '',
  zIndex = 0,
  variant = 'free',
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

    const themeRef = { current: theme ?? 'dark' };
    const syncTheme = () => {
      themeRef.current =
        theme ?? (document.documentElement.classList.contains('light') ? 'light' : 'dark');
    };
    syncTheme();
    const mo = new MutationObserver(() => {
      syncTheme();
      if (reduce) paintStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
    const isLg = () => window.matchMedia('(min-width: 1024px)').matches;

    const textRGB = () => parseRGB(cssVar('--text', '245,247,255'));
    const primaryRGB = () => parseRGB(cssVar('--primary', '165,180,252'));
    const accentRGB = () => parseRGB(cssVar('--accent', '129,140,248'));

    let width = 0;
    let height = 0;
    let dpr = 1;

    // --- atmospheric star field ---
    let stars: Star[] = [];
    const rebuildStars = () => {
      const count = Math.min(280, Math.max(40, Math.round((width * height) / 7000)));
      stars = new Array(count).fill(0).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: rand(0.3, 1.2),
        base: rand(0.12, 0.5),
        phase: Math.random() * Math.PI * 2,
        tw: rand(0.4, 1.4),
      }));
    };

    const paintStatic = () => {
      ctx.clearRect(0, 0, width, height);
      const light = themeRef.current === 'light';
      const sc = light ? '40,48,80' : '200,210,255';
      for (const s of stars) {
        ctx.fillStyle = `rgba(${sc},${s.base})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // --- meteor pool ---
    const DIRECTION = (20 * Math.PI) / 180; // consistent down-right vector
    const meteors: Meteor[] = [];

    const spawn = (m: Meteor) => {
      const fromTop = Math.random() < (isLg() ? 0.72 : 0.82);
      if (fromTop) {
        m.x = rand(-width * 0.1, width * 1.05);
        m.y = rand(-height * 0.25, -10);
      } else {
        m.x = rand(-width * 0.2, -10);
        m.y = rand(-height * 0.1, height * 0.6);
      }

      const roll = Math.random();
      let layer: 0 | 1 | 2 = 0;
      if (roll >= 0.9) layer = 2;
      else if (roll >= 0.55) layer = 1;
      const hero = Math.random() < 0.02;

      const angle = DIRECTION + rand(-0.1, 0.1);
      let speed: number, len: number, widthM: number, alpha: number, decay: number;
      if (layer === 0) {
        speed = rand(2.4, 4.4);
        len = rand(28, 64);
        widthM = rand(0.4, 0.9);
        alpha = rand(0.18, 0.4);
        decay = rand(0.004, 0.008);
      } else if (layer === 1) {
        speed = rand(4.4, 7);
        len = rand(70, 150);
        widthM = rand(0.9, 1.8);
        alpha = rand(0.4, 0.8);
        decay = rand(0.003, 0.006);
      } else {
        speed = rand(7, 11);
        len = rand(140, 240);
        widthM = rand(1.8, 3.2);
        alpha = rand(0.6, 1);
        decay = rand(0.0025, 0.005);
      }
      if (hero) {
        speed = rand(9, 13);
        len = rand(240, 360);
        widthM = rand(3, 4.5);
        alpha = rand(0.85, 1);
        decay = rand(0.002, 0.004);
      }
      if (themeRef.current === 'light') alpha *= 1.25;

      const [hr, hg, hb] = textRGB();
      const useAccent = Math.random() < 0.4;
      const [tr, tg, tb] = useAccent ? accentRGB() : primaryRGB();

      m.vx = Math.cos(angle) * speed;
      m.vy = Math.sin(angle) * speed;
      m.len = len;
      m.life = 1;
      m.decay = decay;
      m.width = widthM;
      m.layer = layer;
      m.hero = hero;
      m.alpha = alpha;
      m.headR = hr;
      m.headG = hg;
      m.headB = hb;
      m.trailR = tr;
      m.trailG = tg;
      m.trailB = tb;
    };

    const targetCount = () => {
      let base = ((width * height) / 10500) * density;
      if (isMobile()) base *= 0.55;
      return Math.round(Math.max(12, Math.min(180, base)));
    };

    const rebuildMeteors = () => {
      const target = targetCount();
      while (meteors.length < target) {
        const m = {} as Meteor;
        spawn(m);
        meteors.push(m);
      }
      if (meteors.length > target) meteors.length = target;
    };

    // --- form clear-zone (auth variant) ---
    const inSafe = (x: number, y: number) => {
      if (variant !== 'auth') return false;
      if (isLg()) {
        const zx = width * 0.5;
        return x >= zx && y >= 0 && y <= height;
      }
      const zx = width * 0.14;
      const zw = width * 0.72;
      const zy = height * 0.08;
      const zh = height * 0.84;
      return x >= zx && x <= zx + zw && y >= zy && y <= zy + zh;
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildStars();
      rebuildMeteors();
      if (reduce) paintStatic();
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      const light = themeRef.current === 'light';
      const sc = light ? '40,48,80' : '200,210,255';
      for (const s of stars) {
        const a = s.base * (0.55 + 0.45 * Math.sin(now * 0.001 * s.tw + s.phase));
        ctx.fillStyle = `rgba(${sc},${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const m of meteors) {
        const sp = Math.hypot(m.vx, m.vy) || 1;
        const tx = m.x - (m.vx / sp) * m.len;
        const ty = m.y - (m.vy / sp) * m.len;
        let a = Math.max(0, Math.min(1, m.life)) * m.alpha;
        let glow = m.layer === 2 || m.hero;
        if (inSafe(m.x, m.y)) {
          a *= 0.22;
          if (m.layer === 2 || m.hero) {
            a *= 0.4;
            glow = false;
          }
        }
        const hr = m.headR;
        const hg = m.headG;
        const hb = m.headB;
        const tr = m.trailR;
        const tg = m.trailG;
        const tb = m.trailB;

        if (glow) {
          const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
          g.addColorStop(0, `rgba(${tr},${tg},${tb},${a * 0.22})`);
          g.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
          ctx.strokeStyle = g;
          ctx.lineWidth = m.width * 3.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }

        const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, `rgba(${hr},${hg},${hb},${a})`);
        grad.addColorStop(0.25, `rgba(${tr},${tg},${tb},${a * 0.8})`);
        grad.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.fillStyle = `rgba(${hr},${hg},${hb},${Math.min(1, a * 1.1)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.width * (m.hero ? 1.4 : 1.05), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();

    let raf = 0;
    if (reduce) {
      paintStatic();
    } else {
      let last = performance.now();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(50, now - last);
        last = now;
        if (document.hidden) return;
        const step = dt / 16.67;
        for (const m of meteors) {
          m.x += m.vx * step;
          m.y += m.vy * step;
          m.life -= m.decay * step;
          if (m.life <= 0 || m.y > height + 80 || m.x > width + 90 || m.x < -120) {
            spawn(m);
          }
        }
        draw(now);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [theme, density, variant]);

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
