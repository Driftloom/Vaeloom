import type { Config } from 'tailwindcss';

const config: Config = {
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
