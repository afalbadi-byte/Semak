import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        ink:   { DEFAULT: '#18211f', 2: '#46524f', 3: '#7b8784' },
        paper: { DEFAULT: '#f5f3ee', 2: '#ebe7de', card: '#fffdf9' },
        brand: { DEFAULT: '#0f6b61', 50: '#e7f3f1', 100: '#cfe6e2', 600: '#0f6b61', 700: '#0b544c', 800: '#083f39' },
        amber: { DEFAULT: '#c77a12' },
      },
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 0 rgba(24,33,31,.04), 0 1px 3px rgba(24,33,31,.06)' },
    },
  },
  plugins: [],
};
