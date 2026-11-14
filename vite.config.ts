import { defineConfig, type Connect } from 'vite'

const spriteDirectory: Connect.NextHandleFunction = (req, res, next) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname !== '/sprites') return next()
  res.writeHead(308, { Location: '/sprites/' + url.search })
  res.end()
}

export default defineConfig({
  plugins: [{
    name: 'sprite-directory',
    configureServer(server) { server.middlewares.use(spriteDirectory) },
    configurePreviewServer(server) { server.middlewares.use(spriteDirectory) },
  }],
  build: {
    rollupOptions: {
      input: { portfolio: 'index.html', sprites: 'sprites/index.html' },
    },
  },
})
