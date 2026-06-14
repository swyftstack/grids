/**
 * Shared Tailwind preset for Swyftgrid.
 *
 * Apps extend this in their own tailwind.config.js. It wires the semantic colour tokens defined in
 * `src/tokens.css` into Tailwind utilities (e.g. `bg-surface`, `text-muted`, `border-default`),
 * so the whole UI themes from a single source of truth.
 */

/** Build an rgb() value that respects Tailwind's <alpha-value>. */
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: rgb('--sg-bg'),
        surface: {
          DEFAULT: rgb('--sg-surface'),
          2: rgb('--sg-surface-2'),
        },
        overlay: rgb('--sg-overlay'),
        border: {
          DEFAULT: rgb('--sg-border'),
          strong: rgb('--sg-border-strong'),
        },
        content: {
          DEFAULT: rgb('--sg-text'),
          muted: rgb('--sg-text-muted'),
          subtle: rgb('--sg-text-subtle'),
        },
        accent: {
          DEFAULT: rgb('--sg-accent'),
          fg: rgb('--sg-accent-fg'),
          soft: rgb('--sg-accent-soft'),
        },
        success: rgb('--sg-success'),
        warning: rgb('--sg-warning'),
        danger: {
          DEFAULT: rgb('--sg-danger'),
          soft: rgb('--sg-danger-soft'),
        },
        info: rgb('--sg-info'),
      },
      borderColor: {
        DEFAULT: rgb('--sg-border'),
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: 'var(--sg-radius)',
        lg: 'calc(var(--sg-radius) + 2px)',
        xl: 'calc(var(--sg-radius) + 6px)',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        popover:
          '0 10px 38px -10px rgb(0 0 0 / 0.35), 0 10px 20px -15px rgb(0 0 0 / 0.2)',
        glow: '0 0 0 1px rgb(var(--sg-accent) / 0.4), 0 4px 24px rgb(var(--sg-accent) / 0.25)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'scale-in': 'scale-in 120ms ease-out',
        'slide-up': 'slide-up 140ms ease-out',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
