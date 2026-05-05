import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'crawl-purple': '#7f13ec',
        'crawl-purple-light': '#a855f7',
        'crawl-purple-dark': '#5b0daa',
        'crawl-bg': '#0a0a0f',
        'crawl-card': '#1a1a2e',
        'crawl-surface': '#16162a',
        'crawl-green': '#22c55e',
        'crawl-text-muted': '#9ca3af',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '0.8' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        glow: 'glow 2s ease-in-out infinite alternate',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
