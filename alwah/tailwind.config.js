import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        ink:   { DEFAULT: '#1b2320', 2: '#48534f', 3: '#7d8884' },
        paper: { DEFAULT: '#f6f3ec', 2: '#ebe5d8', card: '#fffdf8' },
        brand: { DEFAULT: '#1f5f4a', 50: '#e8f2ee', 100: '#cfe5dc', 600: '#1f5f4a', 700: '#174a3a', 800: '#0f3629' },
        gold:  { DEFAULT: '#b8893a', 50: '#fbf3e3' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        quran: ['"Amiri Quran"', '"Amiri"', 'serif'],
      },
      boxShadow: { card: '0 1px 0 rgba(27,35,32,.04), 0 1px 3px rgba(27,35,32,.06)' },
    },
  },
  plugins: [],
};
