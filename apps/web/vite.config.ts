import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Все запросы на /api/* и /files/* проксируются на backend (Spring Boot, порт 8080).
    // Благодаря этому браузер не сталкивается с CORS.
    proxy: {
      '/api': 'http://localhost:8080',
      '/files': 'http://localhost:8080',
    },
  },
})
