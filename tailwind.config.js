/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        canvas: '#080D14',
        surface: '#111B29',
        mint: '#7DE4BF',
        lavender: '#B8AFF8',
        slate: {
          50: '#FAFCFF', 100: '#F4F7FB', 200: '#E1E7EF',
          300: '#C6CEDA', 400: '#A4B1C3', 500: '#8996AA',
          600: '#64798E', 700: '#354960', 800: '#223248',
          900: '#111B29', 950: '#080D14',
        },
        emerald: {
          50: '#effdf7', 100: '#d8f8e9', 200: '#b5efd6',
          300: '#9aebce', 400: '#7DE4BF', 500: '#60d3ab',
          600: '#2b9975', 700: '#247a60', 800: '#215f4c',
          900: '#1c4d3e', 950: '#0c2b23',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#9aebce',
          400: '#7DE4BF',
          500: '#60d3ab',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
      }
    },
  },
  plugins: [],
}
