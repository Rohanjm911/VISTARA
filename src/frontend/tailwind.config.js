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
          DEFAULT: 'var(--accent-color, #35c6b0)',
          hover: 'var(--accent-hover, #2ba895)',
        },
        surface: {
          DEFAULT: 'var(--surface-color, #12151b)',
          secondary: 'var(--surface-secondary, #181c24)',
          border: 'var(--border-color, #242a36)',
          hover: 'var(--hover-color, #1f242f)',
        },
        bg: {
          DEFAULT: 'var(--bg-color, #0b0d11)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

