import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  },
})