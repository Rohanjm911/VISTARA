/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent-color, #38bdf8)',
          hover: 'var(--accent-hover, #0ea5e9)',
        },
        surface: {
          DEFAULT: 'var(--surface-color, #161d27)',
          secondary: 'var(--surface-secondary, #121821)',
          border: 'var(--border-color, #243040)',
          hover: 'var(--hover-color, #1d2633)',
        },
        bg: {
          DEFAULT: 'var(--bg-color, #0f141b)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

