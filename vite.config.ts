import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages project site: https://<user>.github.io/<repo>/
  // Set base to '/<repo>/' so assets resolve correctly
  base: '/vite_live_pg_orm/',
})
