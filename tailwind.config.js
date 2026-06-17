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
          400: '#4F8A4E', // Bertha's floret highlight
          700: '#2C5F2E',
          900: '#1A3A1B',
        },
        burgundy: {
          100: '#F5E0E0',
          700: '#6B1E1E',
        },
        rose: {
          300: '#E0A39E', // Bertha's cheeks
        },
        ink: '#1A1A1A',
        muted: '#7A7068',
        border: '#DDD5C8',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'confetti-fall': {
          '0%': { transform: 'translateY(-10%) rotate(0deg)', opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(360deg)', opacity: '0' },
        },
        'bertha-dance': {
          '0%, 100%': { transform: 'rotate(-8deg) translateY(0)' },
          '25%': { transform: 'rotate(6deg) translateY(-6px)' },
          '50%': { transform: 'rotate(-4deg) translateY(0)' },
          '75%': { transform: 'rotate(8deg) translateY(-6px)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.03)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'confetti-fall': 'confetti-fall 2.6s linear forwards',
        'bertha-dance': 'bertha-dance 0.9s ease-in-out infinite',
        'pop-in': 'pop-in 0.4s ease-out',
      },
    },
  },
  plugins: [],
}
