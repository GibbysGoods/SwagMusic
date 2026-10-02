
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('dist')
const port = Number(process.env.PORT ?? 80)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

http.createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, 'http://localhost').pathname
  )

  const requestedPath = path.resolve(root, `.${pathname}`)
  const safePath = requestedPath.startsWith(`${root}${path.sep}`)
    ? requestedPath
    : path.join(root, 'index.html')

  const filePath = fs.existsSync(safePath) && fs.statSync(safePath).isFile()
    ? safePath
    : path.join(root, 'index.html')

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500)
      res.end('Internal server error')
      return
    }

    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    })

    res.end(content)
  })
}).listen(port, '0.0.0.0', () => {
  console.log(`Web server listening on port ${port}`)
})
