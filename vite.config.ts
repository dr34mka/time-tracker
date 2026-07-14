import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // относительные пути к ассетам — нужно для загрузки через file:// в Electron
  base: './',
  server: { port: 5173 },
});
