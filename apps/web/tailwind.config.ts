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
  // Source scanning moved to `src/styles/globals.css` as `@source` directives.
  // Tailwind 4 replaced the `content` key with `@source`, and keeping both
  // would leave two lists that can drift. The CSS lists the same directory
  // surface this block used to declare, plus the ui-kit package.
  /**
   * Agent dot colours, served to the browser as class *strings*.
   *
   * `AGENT_COLOR_PALETTE` lives in `apps/api/src/api/routers/agent_commands.py`
   * and reaches the client through `GET /agents/commands` as the `color` field.
   * A `.py` file is outside every source glob, so Tailwind's scanner never sees
   * these names and purges all 26 — an agent avatar dot then renders with no
   * background at all. The backend stays the single source of truth for the
   * palette; the `@source inline(...)` list in `src/styles/globals.css` only
   * guarantees the utilities it names survive the purge. Tailwind 4 removed the
   * `safelist` config key, so that list now lives with the other source
   * directives in CSS.
   *
   * Duplication risk: adding an agent or recolouring one in Python will NOT add the
   * class there, and the new dot ships colourless with nothing to fail a build. A
   * shared token set (CSS variables keyed by agent) would remove the duplication,
   * but it is a cross-stack change to the palette contract, not a config fix, so it
   * is deliberately not taken here. `tailwind.config.ts` is also the only place in
   * the frontend that knows these values, so grep for `bg-slate-700` to audit.
   */
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
        // Standard semantic aliases for component & shadcn interop
        card: {
          DEFAULT: rgb('var(--surface)'),
          foreground: rgb('var(--text)'),
        },
        secondary: {
          DEFAULT: rgb('var(--surface-200)'),
          foreground: rgb('var(--text)'),
        },
        muted: {
          DEFAULT: rgb('var(--surface-200)'),
          foreground: rgb('var(--text-muted)'),
        },
        foreground: rgb('var(--text)'),
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
          // Hover state for primary-as-link. Maps to --primary-400 (dark
          // #818CF8, light #4338CA) so link hover shifts hue within the
          // theme instead of collapsing to the fixed action indigo.
          hover: rgb('var(--primary-400)'),
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
          // Contrast-bearing foreground for content sitting on --accent. Black in
          // the high-contrast theme, where the accent is pure yellow.
          fg: rgb('var(--accent-fg)'),
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
          // Interactive edge hover (cards, inputs, list rows). Reuses
          // --border-strong so hover never invents an off-scale colour.
          hover: rgb('var(--border-strong)'),
        },
        'focus-ring': 'var(--color-focus-ring, #818cf8)',
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
          // Pressed destructive state. Follows the --action family convention of
          // deepening on hover/active so the error ramp is predictable across
          // all three themes. Used by ui-kit Button `active:bg-error-active`.
          active: rgb('var(--error-active)'),
        },
        danger: {
          DEFAULT: rgb('var(--error)'),
          muted: rgb('var(--error-muted)'),
          fg: rgb('var(--error-fg)'),
          // Pressed destructive state. Follows the --action family convention of
          // deepening on hover/active so the error ramp is predictable across
          // all three themes.
          active: rgb('var(--error-active)'),
        },
        // `destructive` is the shadcn/Radix name for the danger action family.
        // It was used in 11 files (cognition error banners, ExecutionTimeline)
        // with NO colour entry, so every one of those banners rendered with no
        // background, border or text colour at all. Aliased onto the same
        // --error tokens as `danger` so there is exactly one danger palette.
        destructive: {
          DEFAULT: rgb('var(--error)'),
          foreground: '255 255 255',
          muted: rgb('var(--error-muted)'),
          fg: rgb('var(--error-fg)'),
          active: rgb('var(--error-active)'),
          border: rgb('var(--error)'),
        },
        info: {
          DEFAULT: rgb('var(--info)'),
          muted: rgb('var(--info-muted)'),
          fg: rgb('var(--info-fg)'),
        },
        /**
         * AI semantic states. These previously existed ONLY in the token JSON
         * as design record with no runtime counterpart, so every AI/memory
         * surface in the app hard-coded raw Tailwind palette values
         * (`text-sky-700`, `bg-violet-500/10`, `text-emerald-700`). The `-700`
         * shades are close to invisible on the near-black dark canvas.
         *
         * `verified`, `needs-review` and `blocked` intentionally resolve to the
         * same values as success/warning/error: a grounded citation IS a
         * success and a blocked tool call IS an error. `proposed` (violet) and
         * `processing` (cyan) are the two genuinely new hues.
         */
        ai: {
          proposed: {
            DEFAULT: rgb('var(--ai-proposed)'),
            muted: rgb('var(--ai-proposed-muted)'),
            fg: rgb('var(--ai-proposed-fg)'),
          },
          processing: {
            DEFAULT: rgb('var(--ai-processing)'),
            muted: rgb('var(--ai-processing-muted)'),
            fg: rgb('var(--ai-processing-fg)'),
          },
          verified: {
            DEFAULT: rgb('var(--ai-verified)'),
            muted: rgb('var(--ai-verified-muted)'),
            fg: rgb('var(--ai-verified-fg)'),
          },
          'needs-review': {
            DEFAULT: rgb('var(--ai-needs-review)'),
            muted: rgb('var(--ai-needs-review-muted)'),
            fg: rgb('var(--ai-needs-review-fg)'),
          },
          blocked: {
            DEFAULT: rgb('var(--ai-blocked)'),
            muted: rgb('var(--ai-blocked-muted)'),
            fg: rgb('var(--ai-blocked-fg)'),
          },
        },
        overlay: rgb('var(--overlay)'),
      },
      boxShadow: {
        // Tailwind 4 ships `shadow-xs` natively; the pin keeps the exact
        // hairline value the design system audited rather than inheriting a
        // future upstream tweak. It is identical to the v4 default today.
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        glow: '0 0 20px rgba(99, 102, 241, 0.12)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.18)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        elevated: 'var(--shadow-elevated)',
        'inner-glow': 'inset 0 1px 0 var(--shadow-inner-highlight)',
        'elevation-none': 'var(--elevation-none)',
        'elevation-raised': 'var(--elevation-raised)',
        'elevation-overlay': 'var(--elevation-overlay)',
        'elevation-modal': 'var(--elevation-modal)',
        'elevation-card': 'var(--elevation-card)',
      },
      spacing: {
        // `0.2` was used in 38 files (capability view chips, Sidebar rows).
        // Below the v3 default floor of 0.5, so it purged. Scaled off the
        // standard 0.25rem step: 0.2 x 0.25rem = 0.05rem.
        '0.2': '0.05rem',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: [
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
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
        // Declared natively because no animation plugin is installed. The
        // plugin spellings -- `animate-in`, `slide-in-from-*`, `zoom-in-*` --
        // are not core utilities, are not generated here, and therefore purge
        // to nothing. Each of those four usages rendered a component that
        // simply appeared, with no motion at all, and nothing failed.
        // `design-system-guardrails.test.ts` now asserts this list stays
        // closed.
        'slide-in-from-right': 'slideInFromRight 0.2s ease-out',
        'zoom-in-95': 'zoomIn95 0.2s ease-out',
      },
      keyframes: {
        slideInFromRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        zoomIn95: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
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
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        container: 'var(--radius-container)',
        pill: 'var(--radius-pill)',
        none: 'var(--radius-none)',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
    },
  },
  plugins: [],
};

export default config;
