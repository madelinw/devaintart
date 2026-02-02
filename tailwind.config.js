/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark gallery theme
        gallery: {
          bg: '#0a0a0b',
          card: '#141416',
          border: '#27272a',
          accent: '#8b5cf6',
          'accent-hover': '#a78bfa',
        }
      }
    },
  },
  plugins: [],
}
