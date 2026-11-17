import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: (chunkInfo) => {
            const safeName = (chunkInfo.name || 'chunk')
              .replace(/exceptions?/gi, 'anomalies')
              .replace(/errors?/gi, 'issues');
            return `assets/${safeName}-[hash].js`;
          },
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('three') || id.includes('@react-three')) return 'vendor-3d';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
            return 'vendor-misc';
          },
        },
      },
    },
  };
});
