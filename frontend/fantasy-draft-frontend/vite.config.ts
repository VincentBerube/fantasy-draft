import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Remove the explicit config path
export default defineConfig({
  plugins: [react()],
})