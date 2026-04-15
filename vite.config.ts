import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const AI_PROXY_PORT = process.env.AI_PROXY_PORT ?? '3579';

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'wss',
      host: 'timesheet-dev.clearcomputing.be',
      clientPort: 443,
    },
    proxy: {
      '/ai-assist': `http://127.0.0.1:${AI_PROXY_PORT}`,
      '/deploy': `http://127.0.0.1:${AI_PROXY_PORT}`,
      '/client-docs': `http://127.0.0.1:${AI_PROXY_PORT}`,
    },
  },
})