import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

/** Local preview/validation only. The delivered site never uses a server component. */
export function createStaticServer(directory, prefix = '/') {
  const root = resolve(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return; }
      let path = resolve(root, `.${decodeURIComponent(url.pathname.slice(prefix.length - 1))}`);
      if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
      if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
      const content = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(content);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}
