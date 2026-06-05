/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // الهوية: Cairo للنصوص والعناوين، Amiri للنصوص الرسمية/الخطابات
        sans:    ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        arabic:  ['Amiri', 'serif'],
        cairo:   ['Cairo', 'sans-serif'],
        amiri:   ['Amiri', 'serif'],
      },
      colors: {
        // ── الكحلي المؤسسي لسماك #1a365d ── اللون الأساسي للهوية
        brand: {
          50:  '#f4f7fa',
          100: '#e6edf4',
          200: '#c7d6e6',
          300: '#9bb3d0',
          400: '#6888b2',
          500: '#436798',
          600: '#2f4f7d',
          700: '#264064',
          800: '#1a365d', // ★ كحلي سماك الأساسي
          900: '#15294a',
          950: '#0d1a30',
        },
        // ── الذهبي الفاخر لسماك #c5a059 ── لون التمييز
        gold: {
          50:  '#fbf8f0',
          100: '#f5edd7',
          200: '#ebdcae',
          300: '#ddc47c',
          400: '#d0ad5f',
          500: '#c5a059', // ★ ذهبي سماك الأساسي
          600: '#a8843f',
          700: '#876733',
          800: '#6e542d',
          900: '#5c4628',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 4px 16px -2px rgb(0 0 0 / 0.06)',
        card: '0 2px 8px -1px rgb(0 0 0 / 0.06), 0 6px 24px -8px rgb(0 0 0 / 0.08)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn:    'fadeIn 0.35s ease-out',
        slideDown: 'slideDown 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
