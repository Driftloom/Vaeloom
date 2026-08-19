import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: {
          DEFAULT: '#09090b',
          50: '#09090b',
          100: '#0f0f12',
          200: '#18181b',
          300: '#27272a',
          400: '#3f3f46',
          hover: '#18181b',
          active: '#27272a',
        },
        primary: {
          DEFAULT: '#fafafa',
          50: '#ffffff',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          hover: '#f4f4f5',
          active: '#e4e4e7',
        },
        accent: {
          DEFAULT: '#818cf8',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          hover: '#a5b4fc',
          active: '#6366f1',
        },
        text: {
          DEFAULT: '#fafafa',
          50: '#ffffff',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          muted: '#a1a1aa',
          dim: '#71717a',
        },
        border: {
          DEFAULT: '#27272a',
          subtle: '#1e1e22',
          focus: '#818cf8',
        },
        success: {
          DEFAULT: '#22c55e',
          muted: '#4ade80',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#fbbf24',
        },
        error: {
          DEFAULT: '#ef4444',
          muted: '#f87171',
        },
        info: {
          DEFAULT: '#737373',
          muted: '#a3a3a3',
        },
        // Light mode
        'l-bg': '#fafbfc',
        'l-surface': {
          DEFAULT: '#ffffff',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          hover: '#f3f4f8',
          active: '#e8ecf4',
        },
        'l-text': {
          DEFAULT: '#111827',
          muted: '#6b7280',
        },
        'l-border': '#e5e7eb',
        'l-success': '#16a34a',
        'l-warning': '#d97706',
        'l-error': '#dc2626',
        'l-info': '#2563eb',
      },
      boxShadow: {
        glow: '0 0 20px rgba(129, 140, 248, 0.1)',
        'glow-lg': '0 0 40px rgba(129, 140, 248, 0.15)',
        card: '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
        elevated: '0 8px 32px rgba(0, 0, 0, 0.5)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'l-subtle': '0 1px 3px rgba(0,0,0,0.06)',
        'l-card': '0 4px 16px rgba(0,0,0,0.06)',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh':
          'linear-gradient(135deg, rgba(129, 140, 248, 0.03) 0%, rgba(99, 102, 241, 0.01) 50%, rgba(0, 0, 0, 0) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
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
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
