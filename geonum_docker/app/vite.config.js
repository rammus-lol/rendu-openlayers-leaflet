import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        // Chaque clé ici définit une page à générer dans /dist
        main: resolve(__dirname, 'index.html'),
        index: resolve(__dirname, 'index_ol.html'),
        index_lf: resolve(__dirname, 'index_lf.html'),
      },
    },
  },
})