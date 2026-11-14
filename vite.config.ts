import { defineConfig } from 'vite'

export default defineConfig({
  build: { rollupOptions: { input: {
    portfolio: 'index.html',
    playground: 'playground/index.html',
    study: 'horse-study/index.html',
  } } },
})
