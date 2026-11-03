import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Recharts alone is about 550 kB minified; raise the warning threshold accordingly.
  build: { chunkSizeWarningLimit: 700 },
})
