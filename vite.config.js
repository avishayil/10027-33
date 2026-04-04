import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base =
  process.env.VITE_BASE != null && process.env.VITE_BASE !== ''
    ? process.env.VITE_BASE
    : '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
})
