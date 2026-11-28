/** Serves a production build under a base path (E2E_DIST, E2E_BASE), as on GitHub Pages. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

export async function serve() {
  const dist = process.env.E2E_DIST ? new URL(`../../${process.env.E2E_DIST.replace(/\/?$/, '/')}`, import.meta.url).pathname : new URL('../../dist/', import.meta.url).pathname;
  const base = (process.env.E2E_BASE || '/').replace(/^\/?/, '/').replace(/\/?$/, '/');
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!pathname.startsWith(base)) {
      res.writeHead(404);
      return res.end();
    }
    const path = normalize(pathname.slice(base.length)).replace(/^\/+/, '');
    const file = path === '' || path === '.' ? 'index.html' : path;
    try {
      const body = await readFile(join(dist, file));
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}${base}`, origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
