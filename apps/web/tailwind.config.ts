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
          DEFAULT: '#0a0a0a',
          50: '#0c0c0c',
          100: '#111111',
          200: '#171717',
          300: '#1f1f1f',
          400: '#262626',
          hover: '#141414',
          active: '#1a1a1a',
        },
        primary: {
          DEFAULT: '#ffffff',
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#ffffff',
          600: '#e5e5e5',
          700: '#d4d4d4',
          800: '#a3a3a3',
          900: '#737373',
          hover: '#e5e5e5',
          active: '#d4d4d4',
        },
        accent: {
          DEFAULT: '#a3a3a3',
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          hover: '#d4d4d4',
          active: '#a3a3a3',
        },
        text: {
          DEFAULT: '#fafafa',
          50: '#ffffff',
          100: '#fafafa',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          muted: '#737373',
          dim: '#525252',
        },
        border: {
          DEFAULT: '#262626',
          subtle: '#1f1f1f',
          focus: '#ffffff',
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
        glow: '0 0 20px rgba(255, 255, 255, 0.08)',
        'glow-lg': '0 0 40px rgba(255, 255, 255, 0.12)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)',
        elevated: '0 12px 48px rgba(0, 0, 0, 0.6)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
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
          'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 50%, rgba(0, 0, 0, 0) 100%)',
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
