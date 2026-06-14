/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nebula: {
          bg: '#12091f',
          card: '#1a0f2e',
          border: '#2d1f4a',
          primary: '#c084fc',
          'primary-hover': '#a855f7',
          accent: '#fb7185',
          positive: '#34d399',
          negative: '#fb7185',
          gold: '#fbbf24',
          text: '#faf5ff',
          muted: '#a78bca',
          subtle: '#6b4f8a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'nebula-sm': '0 0 12px rgba(192, 132, 252, 0.15)',
        'nebula-md': '0 0 24px rgba(192, 132, 252, 0.2)',
        'nebula-lg': '0 0 40px rgba(192, 132, 252, 0.25)',
        'accent-sm': '0 0 12px rgba(251, 113, 133, 0.2)',
      },
      backgroundImage: {
        'nebula-gradient': 'linear-gradient(135deg, #c084fc, #fb7185)',
        'card-gradient': 'linear-gradient(135deg, #1a0f2e, #12091f)',
      }
    }
  },
  plugins: [require('@tailwindcss/forms')],
};
