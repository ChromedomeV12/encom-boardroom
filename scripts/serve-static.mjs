import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const port = Number(process.env.PORT || process.argv[2] || 4322);
const root = path.resolve(process.argv[3] || process.cwd());

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// Publication paths served from dist/ (canonical article pages, feeds, etc.)
const distPaths = ['posts/', 'tags/', 'categories/', 'archive/', 'featured/', 'rss.xml', 'sitemap.xml', 'manifest.json'];

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.slice(1);
    // Publication paths resolve from dist/ first, then root.
    const isDistPath = distPaths.some(function (p) { return relativePath === p || relativePath.startsWith(p); });
    let filePath;
    if (isDistPath) {
      filePath = path.resolve(root, 'dist', relativePath);
      // dist/ paths may need /index.html for clean URLs.
      try {
        const f = await stat(filePath);
        if (f.isDirectory()) filePath = path.join(filePath, 'index.html');
      } catch {
        // File doesn't exist in dist; fall through to 404 below.
      }
    } else {
      filePath = path.resolve(root, relativePath);
    }

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const file = await stat(filePath);
    if (!file.isFile()) throw new Error('Not a file');

    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
