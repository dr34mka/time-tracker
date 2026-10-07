import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  define: { __DESIGN_PREVIEW__: true, 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist-design-preview',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/preview/main.tsx', import.meta.url)),
      name: 'TimeTrackerDesignPreview',
      formats: ['iife'],
      fileName: () => 'preview.js',
      cssFileName: 'preview',
    },
  },
});
