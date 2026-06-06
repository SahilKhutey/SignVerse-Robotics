import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@react-three') || id.includes('three')) return 'vendor-three';
          if (id.includes('recharts') || id.includes('uplot')) return 'vendor-charts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
