/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf7fa',
          100: '#f6eff4',
          200: '#eddfe8',
          300: '#dfc4d5',
          400: '#c79dbd',
          500: '#ad78a1',
          600: '#86597a',
          700: '#714b67',
          800: '#5e3f56',
          900: '#50384a',
          950: '#321f2d',
        },
      },
    },
  },
  plugins: [],
};
