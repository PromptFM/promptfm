/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'equalizer-bounce': {
          '0%':   { height: '4px' },
          '25%':  { height: '10px' },
          '50%':  { height: '6px' },
          '75%':  { height: '14px' },
          '100%': { height: '8px' },
        },
      },
      animation: {
        equalizer: 'equalizer-bounce 0.8s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
