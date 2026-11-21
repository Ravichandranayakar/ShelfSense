/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#F5F3ED',
        'surface-subtle': '#EAE7DF',
        'surface-card': '#FFFFFF',
        'border-subtle': '#DEDAD1',
        'on-surface': '#171717',
        'on-surface-muted': '#77746D',
        accent: {
          DEFAULT: '#C7F36B',
          hover: '#bbf055',
          dark: '#171717',
        },
        // Fallback backward-compatible aliases
        charcoal: '#171717',
        terracotta: '#C7F36B',
        ivory: '#F5F3ED',
        muted: '#77746D',
        'surface-border': '#DEDAD1',
        ink: '#171717',
        'ink-muted': '#77746D',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
        editorial: '0.12em',
      },
      boxShadow: {
        editorial: '0 12px 40px -15px rgba(23, 23, 23, 0.06)',
      },
    },
  },
  plugins: [],
};
