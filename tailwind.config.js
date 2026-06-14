/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF8F5',
        parchment: '#F0EBE1',
        forest: {
          50: '#F0F7F0',
          100: '#D6EAD7',
          700: '#2C5F2E',
          900: '#1A3A1B',
        },
        burgundy: {
          100: '#F5E0E0',
          700: '#6B1E1E',
        },
        ink: '#1A1A1A',
        muted: '#7A7068',
        border: '#DDD5C8',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
