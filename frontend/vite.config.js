import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The functions emulator serves the function at /<project>/<region>/<name>
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: (path) => `/vistaar-invoice/asia-south1/api${path}`,
      },
    },
  },
});