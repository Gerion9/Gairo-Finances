import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // Local UI never simulates a real identity or consumes remote data/Claude.
  const attachAccounts = server => {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Esta es la vista local. Abre Sifran conectado para iniciar sesión y sincronizar.' } }));
    });
  };
  return {
  plugins: [react(), ...(command === 'build' ? [sites()] : []), { name: 'sifran-local-boundary', configureServer: attachAccounts, configurePreviewServer: attachAccounts }],
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist/client',
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('canvas-confetti')) {
              return 'vendor-confetti';
            }
            return 'vendor-core';
          }
        }
      }
    }
  }
  }
})
