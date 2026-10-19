import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { getPublicRates } from './server/references/publicRates.js'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // Local UI never simulates an identity or accesses remote financial accounts.
  // Only the fixed, public official-reference adapter can use the network.
  const attachAccounts = server => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      if (req.url.split('?')[0] === '/api/reference-rates') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method !== 'GET') {
          res.statusCode = 405; res.setHeader('Allow', 'GET');
          return res.end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Consulta las referencias con GET.' } }));
        }
        try {
          const result = await getPublicRates({ forceRefresh: req.headers['x-sifran-refresh'] === '1' });
          return res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 503;
          return res.end(JSON.stringify({ error: { code: 'REFERENCES_UNAVAILABLE', message: 'No se pudieron consultar las referencias oficiales.' } }));
        }
      }
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
  test: {
    include: ['src/**/*.test.{js,jsx,ts,tsx}', 'tests/**/*.test.{js,jsx,ts,tsx}'],
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
