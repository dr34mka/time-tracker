import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // относительные пути к ассетам — нужно для загрузки через file:// в Electron
  base: './',
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // popover меню-бара macOS
        popover: fileURLToPath(new URL('./popover.html', import.meta.url)),
      },
    },
  },
});
