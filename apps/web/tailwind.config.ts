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
        // Deep ink background
        background: '#0a0a0f',
        surface: {
          DEFAULT: '#12121a',
          hover: '#1a1a24',
          active: '#242430',
        },
        // Periwinkle-blue accent
        primary: {
          DEFAULT: '#8b9af0',
          hover: '#a3b1ff',
          active: '#7382d6',
        },
        // Coral highlight
        accent: {
          DEFAULT: '#ff7b72',
          hover: '#ff948d',
          active: '#e6655c',
        },
        text: {
          DEFAULT: '#e2e8f0',
          muted: '#94a3b8',
        },
        border: '#2e3347',
        // Light mode colors
        'l-bg': '#f8f9fc',
        'l-surface': {
          DEFAULT: '#ffffff',
          hover: '#f1f3f8',
          active: '#e8ecf4',
        },
        'l-text': {
          DEFAULT: '#1a1a2e',
          muted: '#64748b',
        },
        'l-border': '#e2e8f0',
      },
      boxShadow: {
        'l-subtle': '0 1px 3px rgba(0,0,0,0.06)',
        'l-card': '0 4px 12px rgba(0,0,0,0.05)',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        sans: ['var(--font-space-grotesk)', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
