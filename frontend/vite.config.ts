import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    // Production serves the React app and API from one Cloud Run origin.
    // Mirror that locally so VITE_API_BASE_URL=/api works without a deploy.
    proxy: {
      '/api': {
        target: process.env.SWIFTCARE_API_PROXY || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
