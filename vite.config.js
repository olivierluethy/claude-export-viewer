import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base so `dist/` can be served from any path (subfolder, local static
// server, USB stick). Everything is bundled — no runtime network access at all.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
