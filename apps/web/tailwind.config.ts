import type { Config } from 'tailwindcss';

/**
 * Vaeloom dual-theme design tokens (Phase 02A / Wave 03).
 *
 * Every semantic color resolves through a CSS custom property so ONE class
 * set produces BOTH the deep-navy enterprise dark theme and the premium
 * white enterprise light theme. Values are defined in src/styles/globals.css
 * (`:root`/`.dark` and `.light`). Triplets are R G B for alpha support.
 *
 * Black policy: pure black is NOT the app background anywhere. It remains
 * available intentionally for scrims/overlays, graph canvas voids, code
 * surfaces, and shadows (see globals.css `.bg-scrim` and raw `black`
 * utilities where already justified).
 */

const rgb = (v: string) => `rgb(${v} / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // F-06 fix: ui-kit classes were previously purged (Modal backdrop,
    // Button hover/active/focus states) because the package was not scanned.
    '../../packages/ui-kit/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // App canvas
        background: rgb('var(--bg)'),
        // Surface hierarchy
        surface: {
          DEFAULT: rgb('var(--surface)'),
          elevated: rgb('var(--surface-elevated)'),
          50: rgb('var(--surface-50)'),
          100: rgb('var(--surface-100)'),
          200: rgb('var(--surface-200)'),
          300: rgb('var(--surface-300)'),
          400: rgb('var(--surface-400)'),
          500: rgb('var(--surface-500)'),
          900: rgb('var(--surface-900)'),
          hover: rgb('var(--surface-hover)'),
          active: rgb('var(--surface-active)'),
          selected: rgb('var(--surface-selected)'),
        },
        // Canonical primary ACTION family (indigo) — identical across themes.
        primary: {
          DEFAULT: rgb('var(--primary)'),
          fg: rgb('var(--primary-fg)'),
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: rgb('var(--primary-300)'),
          400: rgb('var(--primary-400)'),
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Solid button/action surface — fixed indigo, white label, both themes.
        action: {
          DEFAULT: rgb('var(--action)'),
          hover: rgb('var(--action-hover)'),
          active: rgb('var(--action-active)'),
          fg: rgb('var(--action-fg)'),
        },
        accent: {
          DEFAULT: rgb('var(--accent)'),
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: rgb('var(--accent-300)'),
          400: rgb('var(--accent-400)'),
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          hover: rgb('var(--accent-hover)'),
          active: rgb('var(--accent-active)'),
        },
        text: {
          DEFAULT: rgb('var(--text)'),
          secondary: rgb('var(--text-secondary)'),
          muted: rgb('var(--text-muted)'),
          dim: rgb('var(--text-dim)'),
          200: rgb('var(--text-200)'),
          300: rgb('var(--text-300)'),
          400: rgb('var(--text-400)'),
          500: rgb('var(--text-500)'),
          600: rgb('var(--text-600)'),
        },
        border: {
          DEFAULT: rgb('var(--border)'),
          subtle: rgb('var(--border-subtle)'),
          strong: rgb('var(--border-strong)'),
          focus: rgb('var(--accent)'),
        },
        // Semantic status — designed per theme for WCAG AA on real surfaces.
        success: {
          DEFAULT: rgb('var(--success)'),
          muted: rgb('var(--success-muted)'),
          fg: rgb('var(--success-fg)'),
        },
        warning: {
          DEFAULT: rgb('var(--warning)'),
          muted: rgb('var(--warning-muted)'),
          fg: rgb('var(--warning-fg)'),
        },
        error: {
          DEFAULT: rgb('var(--error)'),
          muted: rgb('var(--error-muted)'),
          fg: rgb('var(--error-fg)'),
        },
        info: {
          DEFAULT: rgb('var(--info)'),
          muted: rgb('var(--info-muted)'),
          fg: rgb('var(--info-fg)'),
        },
        overlay: rgb('var(--overlay)'),
      },
      boxShadow: {
        glow: '0 0 20px rgba(99, 102, 241, 0.12)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.18)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        elevated: 'var(--shadow-elevated)',
        'inner-glow': 'inset 0 1px 0 var(--shadow-inner-highlight)',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh':
          'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(67, 56, 202, 0.02) 50%, rgba(0, 0, 0, 0) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        // Landing system
        'spin-slow': 'spin 24s linear infinite',
        breathe: 'breathe 7s ease-in-out infinite',
        flow: 'flowDash 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        flowDash: {
          to: { strokeDashoffset: '-24' },
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
