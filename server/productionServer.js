import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createEchoRelay } from './echoRelay.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');
const API_ORIGIN = parseApiOrigin(process.env.VITE_API_BASE_URL);
const upstream = API_ORIGIN.protocol === 'https:' ? https : http;
const relay = createEchoRelay({ apiBaseUrl: API_ORIGIN.origin, allowedOrigin: publicOrigin });
const serverSockets = new Set();

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function parseApiOrigin(value) {
  let origin;
  try { origin = new URL(value); } catch {
    throw new Error('Set VITE_API_BASE_URL to an absolute HTTP(S) API origin.');
  }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash ||
      (origin.protocol === 'http:' && !isLoopbackHost(origin.host))) {
    throw new Error('VITE_API_BASE_URL must be a public HTTPS origin (HTTP is allowed only on loopback).');
  }
  return origin;
}

function parseRequestHost(request) {
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || request.headers.host;
  if (typeof host !== 'string' || !host || /[\r\n/@]/.test(host)) return null;
  try {
    const parsed = new URL(`http://${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isLoopbackHost(host) {
  try {
    const parsed = new URL(host.includes('://') ? host : `http://${host}`);
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function publicOrigin(request) {
  const host = parseRequestHost(request);
  if (!host) return null;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(host.hostname.toLowerCase());
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const secure = request.socket.encrypted || forwardedProto === 'https' || !loopback;
  return `${secure ? 'https' : 'http'}://${host.host}`;
}

function requestIsSameOrigin(request) {
  const expected = publicOrigin(request);
  return expected && request.headers.origin === expected;
}

function responseHeaders(source, request) {
  const connectionHeaders = new Set(
    String(source.connection || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  const headers = {};
  for (const [name, value] of Object.entries(source)) {
    if (name === 'host' || HOP_BY_HOP_HEADERS.has(name) || connectionHeaders.has(name)) continue;
    headers[name] = value;
  }
  return headers;
}

function secureCookieFor(request) {
  return Boolean(publicOrigin(request)?.startsWith('https://'));
}

function adaptSessionCookie(cookie, secure) {
  const [nameValue, ...attributes] = cookie.split(';');
  const name = nameValue.slice(0, nameValue.indexOf('=')).trim().toLowerCase();
  if (!['session', 'task_session'].includes(name)) return cookie;

  const kept = attributes
    .map((attribute) => attribute.trim())
    .filter((attribute) => !/^(domain|path|secure|httponly)=?/i.test(attribute));
  if (!kept.some((attribute) => /^samesite=/i.test(attribute))) kept.push('SameSite=Lax');
  kept.push('Path=/api', 'HttpOnly');
  if (secure) kept.push('Secure');
  return [nameValue, ...kept].join('; ');
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(payload);
}

function parseFrontendUrl(request) {
  try {
    const parsed = new URL(request.url, 'http://frontend.invalid');
    if (parsed.origin !== 'http://frontend.invalid') return null;
    return parsed;
  } catch {
    return null;
  }
}

function proxyApiRequest(request, response, parsedUrl) {
  const target = new URL(`${parsedUrl.pathname}${parsedUrl.search}`, API_ORIGIN);
  const headers = responseHeaders(request.headers, request);
  delete headers['x-forwarded-for'];
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];
  delete headers['x-real-ip'];
  const frontendOrigin = publicOrigin(request);
  if (frontendOrigin) {
    const frontendUrl = new URL(frontendOrigin);
    headers['x-forwarded-host'] = frontendUrl.host;
    headers['x-forwarded-proto'] = frontendUrl.protocol.slice(0, -1);
  }
  headers.host = API_ORIGIN.host;

  const proxyRequest = upstream.request(target, { method: request.method, headers });
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    if (!response.headersSent) sendJson(response, 502, { error: 'The IDICorp API is unavailable.' });
    else response.destroy();
  };

  proxyRequest.on('response', (proxyResponse) => {
    const headers = responseHeaders(proxyResponse.headers, request);
    const cookies = proxyResponse.headers['set-cookie'];
    if (cookies) headers['set-cookie'] = cookies.map((cookie) => adaptSessionCookie(cookie, secureCookieFor(request)));
    headers['cache-control'] = 'no-store';
    headers['x-accel-buffering'] = 'no';
    response.writeHead(proxyResponse.statusCode || 502, headers);
    proxyResponse.pipe(response);
  });
  proxyRequest.once('error', fail);
  request.once('aborted', () => proxyRequest.destroy());
  response.once('close', () => {
    if (!response.writableFinished) proxyRequest.destroy();
  });
  request.pipe(proxyRequest);
}

function rejectWebSocket(socket, status) {
  if (socket.destroyed || !socket.writable) return;
  const reason = http.STATUS_CODES[status] || 'Bad Gateway';
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n`);
}

function hasWebSocketUpgrade(headers) {
  return headers.upgrade?.toLowerCase() === 'websocket' &&
    headers.connection?.toLowerCase().split(',').some((part) => part.trim() === 'upgrade');
}

function proxyCalculatorUpgrade(request, socket, head) {
  if (request.method !== 'GET' || !hasWebSocketUpgrade(request.headers) ||
      request.headers['sec-websocket-version'] !== '13' ||
      !/^[A-Za-z0-9+/]{22}==$/.test(request.headers['sec-websocket-key'] || '') ||
      !requestIsSameOrigin(request)) {
    rejectWebSocket(socket, requestIsSameOrigin(request) ? 400 : 403);
    return;
  }

  const target = new URL('/ws/calculator', API_ORIGIN);
  const headers = responseHeaders(request.headers, request);
  headers.host = API_ORIGIN.host;
  headers.connection = 'Upgrade';
  headers.upgrade = 'websocket';
  socket.pause();

  const proxyRequest = upstream.request(target, { method: 'GET', headers });
  let upstreamSocket;
  let settled = false;
  const timer = setTimeout(() => fail(504), 10000);
  timer.unref();

  function fail(status = 502) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    proxyRequest.destroy();
    rejectWebSocket(socket, status);
  }

  socket.once('error', () => proxyRequest.destroy());
  socket.once('close', () => {
    clearTimeout(timer);
    proxyRequest.destroy();
    upstreamSocket?.destroy();
  });
  proxyRequest.once('response', (response) => {
    const status = [401, 403].includes(response.statusCode) ? response.statusCode : 502;
    response.destroy();
    fail(status);
  });
  proxyRequest.once('error', () => fail());
  proxyRequest.once('upgrade', (response, acceptedSocket, acceptedHead) => {
    const key = request.headers['sec-websocket-key'];
    const expectedAccept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    const valid = response.statusCode === 101 && hasWebSocketUpgrade(response.headers) &&
      response.headers['sec-websocket-accept'] === expectedAccept;
    if (settled || socket.destroyed || !valid) {
      acceptedSocket.destroy();
      fail(502);
      return;
    }

    settled = true;
    clearTimeout(timer);
    upstreamSocket = acceptedSocket;
    const responseLines = [
      'HTTP/1.1 101 Switching Protocols',
      'Connection: Upgrade',
      'Upgrade: websocket',
      `Sec-WebSocket-Accept: ${expectedAccept}`,
    ];
    for (const name of ['sec-websocket-protocol', 'sec-websocket-extensions']) {
      if (response.headers[name]) responseLines.push(`${name}: ${response.headers[name]}`);
    }
    socket.write(`${responseLines.join('\r\n')}\r\n\r\n`);
    if (acceptedHead.length) socket.write(acceptedHead);
    if (head.length) acceptedSocket.write(head);
    socket.pipe(acceptedSocket);
    acceptedSocket.pipe(socket);
    acceptedSocket.once('close', () => socket.destroy());
    socket.once('close', () => acceptedSocket.destroy());
    socket.resume();
  });
  proxyRequest.end();
}

function contentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

async function serveStatic(request, response, parsedUrl) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(parsedUrl.pathname); } catch {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }
  if (pathname.includes('\0')) {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }

  const candidate = path.resolve(DIST, `.${pathname}`);
  const relative = path.relative(DIST, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }

  let filePath = candidate;
  let details;
  try { details = await fs.promises.stat(filePath); } catch { details = null; }
  if (details?.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    try { details = await fs.promises.stat(filePath); } catch { details = null; }
  }
  if (!details?.isFile()) {
    const acceptsHtml = request.headers.accept?.includes('text/html');
    if (!path.extname(pathname) && acceptsHtml) {
      filePath = path.join(DIST, 'index.html');
      try { details = await fs.promises.stat(filePath); } catch { details = null; }
    }
  }
  if (!details?.isFile()) {
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  const isHashedAsset = pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(path.basename(pathname));
  response.writeHead(200, {
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Length': details.size,
    'Content-Type': contentType(filePath),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.once('error', () => {
    if (!response.headersSent) sendJson(response, 500, { error: 'Unable to read the application asset.' });
    else response.destroy();
  });
  response.once('close', () => stream.destroy());
  stream.pipe(response);
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  throw new Error('Production assets are missing. Run npm run build before starting the server.');
}

const server = http.createServer((request, response) => {
  const parsedUrl = parseFrontendUrl(request);
  if (!parsedUrl) {
    sendJson(response, 400, { error: 'Invalid request URL.' });
    return;
  }

  if (parsedUrl.pathname === '/healthz') {
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('ok');
    return;
  }
  if (parsedUrl.pathname === '/api' || parsedUrl.pathname.startsWith('/api/')) {
    proxyApiRequest(request, response, parsedUrl);
    return;
  }
  if (relay.handleRequest(request, response)) return;
  void serveStatic(request, response, parsedUrl);
});

server.headersTimeout = 60000;
server.on('connection', (socket) => {
  serverSockets.add(socket);
  socket.once('close', () => serverSockets.delete(socket));
});
server.on('upgrade', (request, socket, head) => {
  if (relay.handleUpgrade(request, socket, head)) return;
  const parsedUrl = parseFrontendUrl(request);
  if (parsedUrl?.pathname === '/ws/calculator') {
    proxyCalculatorUpgrade(request, socket, head);
    return;
  }
  rejectWebSocket(socket, 404);
});

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

server.once('error', () => {
  console.error('Production server failed to start. Check PORT and the deployment logs.');
  relay.close();
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => console.info(`IDICorp Service Console listening on 0.0.0.0:${port}.`));

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  relay.close();
  const timer = setTimeout(() => {
    for (const socket of serverSockets) socket.destroy();
    server.closeAllConnections?.();
  }, 10000);
  timer.unref();
  server.close(() => clearTimeout(timer));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
