import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { getSiteMode } from './site-constants.js';
import { loadProductionSiteUrl } from './site-url.js';

const host = '127.0.0.1';
const port = 4173;

function parseMode(args) {
  if (args.length === 2 && args[0] === '--mode') return getSiteMode(args[1]);
  throw new Error('Usage: serve.js --mode preview|production');
}

const config = parseMode(process.argv.slice(2));
const siteUrl =
  config.mode === 'production'
    ? await loadProductionSiteUrl(process.cwd(), config.productionConfigPath)
    : { basePath: config.basePath };
const root = path.resolve(config.outputRoot);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8']
]);

function requestRelativePath(pathname) {
  const basePath = siteUrl.basePath || '';
  if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return undefined;
  let relative = pathname.slice(basePath.length).replace(/^\//, '');
  if (relative === '' || pathname.endsWith('/')) relative += 'index.html';
  return relative;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    const relative = requestRelativePath(decodeURIComponent(url.pathname));
    if (!relative) throw new Error('outside base path');
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('unsafe path');
    const fileStat = await stat(file);
    if (!fileStat.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(file)) ?? 'application/octet-stream'
    });
    createReadStream(file).pipe(response);
  } catch {
    if (config.mode === 'production') {
      const notFound = path.join(root, '404.html');
      try {
        await stat(notFound);
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        createReadStream(notFound).pipe(response);
        return;
      } catch {
        // Fall through to the plain response while artifacts are not generated.
      }
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
  }
});

server.listen(port, host, () => {
  const start = siteUrl.basePath ? `${siteUrl.basePath}/` : '/';
  console.log(
    `${config.mode === 'preview' ? 'Preview' : 'Production'} site: http://${host}:${port}${start}`
  );
});
