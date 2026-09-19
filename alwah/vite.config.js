import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'path';
import { fileURLToPath } from 'url';

// ألواح تُبنى وحدها بمساراتٍ نسبية، فتعمل على semak.sa/alwah
const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwind({ config: path.join(here, 'tailwind.config.js') }), autoprefixer()] } },
  build: { outDir: path.resolve(here, '../dist/alwah'), emptyOutDir: true },
  server: { port: 5191 },
});
