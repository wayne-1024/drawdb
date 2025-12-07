import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  },
  base: '/',
  build: {
    target: 'es2015',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
