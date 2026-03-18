/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        crawl: {
          purple: '#7f13ec',
          'purple-light': '#a855f7',
          'purple-dark': '#5b0daa',
          bg: '#0a0a0f',
          card: '#1a1a2e',
          surface: '#16162a',
          green: '#22c55e',
          'text-muted': '#9ca3af',
        },
      },
    },
  },
  plugins: [],
};
