import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#e9edff',
          200: '#cfd6ff',
          300: '#a6b1ff',
          400: '#7c84ff',
          500: '#5b5cf6',
          600: '#4744e0',
          700: '#3a35b8',
          800: '#2f2c93',
          900: '#272776',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            a: { textDecoration: 'underline', textUnderlineOffset: '2px' },
          },
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.zinc.300'),
            '--tw-prose-headings': theme('colors.zinc.100'),
            '--tw-prose-links': theme('colors.brand.300'),
          },
        },
      }),
    },
  },
  plugins: [typography],
};
