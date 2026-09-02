import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:7116',
        changeOrigin: true,
        secure: false,
      },
      '/hubs': {
        target: 'https://localhost:7116',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
