/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F7F5F0',
        surface: '#FFFFFF',
        primary: {
          DEFAULT: '#1F6F5C',
          soft: '#DCEAE6',
        },
        accent: {
          DEFAULT: '#E8A33D',
          soft: '#FBEACB',
        },
        danger: {
          DEFAULT: '#C1443C',
          soft: '#F6DEDC',
        },
        'warning-form': '#B45309',
        success: {
          DEFAULT: '#2F8F5B',
          soft: '#E6F4EA',
        },
        ink: {
          DEFAULT: '#1C1B19',
          muted: '#6B6A65',
        },
        border: '#E4E1D8',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
