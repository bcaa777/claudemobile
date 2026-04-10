import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'debug-viewer': resolve(__dirname, 'debug-viewer.html'),
        entities: resolve(__dirname, 'entities.html'),
      },
    },
  },
})
