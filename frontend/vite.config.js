import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  // Dev server proxy to backend API (ensure backend runs on :8000)
  server: {
    proxy: {
      '/solve': 'http://localhost:8000',
    }
  }
}))
