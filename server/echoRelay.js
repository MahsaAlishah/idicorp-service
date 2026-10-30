import http from 'node:http';
import https from 'node:https';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const SESSION_PATH = '/__echo/session';
const SOCKET_PREFIX = '/__echo/ws/';
const COOKIE_NAME = 'idicorp_echo_ticket';
const SOCKET_PATH = /^\/__echo\/ws\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function parseOrigin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname)))) {
    throw new Error('Echo relay requires an HTTPS origin, or HTTP on loopback.');
  }
  return url;
}

function cookie(id, ticket, secure, maxAge) {
  return `${COOKIE_NAME}=${ticket}; Path=${SOCKET_PREFIX}${id}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function respond(response, status, payload = { error: 'Echo relay request rejected.' }) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function rejectUpgrade(socket, status) {
  if (socket.destroyed || !socket.writable) return;
  socket.once('error', () => socket.destroy());
  const reason = http.STATUS_CODES[status] ?? 'Bad Gateway';
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n`, () => socket.destroy());
}

function hasUpgrade(headers) {
  return headers.upgrade?.toLowerCase() === 'websocket' &&
    headers.connection?.toLowerCase().split(',').some((part) => part.trim() === 'upgrade');
}

// This relay belongs to the frontend deployment, not the service API. Only its
// fixed Echo upstream receives the Bearer header; it never becomes a WS message.
export function createEchoRelay({
  apiBaseUrl,
  allowedOrigin,
  ticketTtlMs = 30000,
  maxPending = 128,
  maxConnections = 128,
  connectTimeoutMs = 10000,
}) {
  const upstream = new URL('/ws/echo', parseOrigin(apiBaseUrl));
  if (typeof allowedOrigin !== 'function') parseOrigin(allowedOrigin);
  if (!Number.isFinite(ticketTtlMs) || ticketTtlMs < 1 || !Number.isInteger(maxPending) || maxPending < 1 ||
      !Number.isInteger(maxConnections) || maxConnections < 1 ||
      !Number.isFinite(connectTimeoutMs) || connectTimeoutMs < 1) {
    throw new Error('Echo relay limits must be positive.');
  }
  const pending = new Map();
  const requests = new Set();
  const sockets = new Set();
  let closed = false;
  let activeConnections = 0;

  function originFor(request) {
    try {
      const origin = parseOrigin(typeof allowedOrigin === 'function' ? allowedOrigin(request) : allowedOrigin);
      if (request.headers.origin !== origin.origin || request.headers.host?.toLowerCase() !== origin.host.toLowerCase()) return null;
      return origin;
    } catch {
      return null;
    }
  }

  function removePending(id) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    entry.token = null;
  }

  function handleRequest(request, response) {
    if (!request.url?.startsWith('/__echo/')) return false;
    if (closed) { respond(response, 503); return true; }
    if (request.url !== SESSION_PATH) { respond(response, 404); return true; }
    const origin = originFor(request);
    if (!origin) { respond(response, 403); return true; }
    if (request.method !== 'POST') { respond(response, 405); return true; }
    if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
      request.resume();
      respond(response, 400);
      return true;
    }
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' && authorization.length <= 8192 &&
      /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(authorization);
    const authCount = request.rawHeaders.filter((header, index) => index % 2 === 0 && header.toLowerCase() === 'authorization').length;
    if (!match || authCount !== 1) { respond(response, 401); return true; }
    if (pending.size >= maxPending) { respond(response, 429); return true; }
    const connectionId = randomUUID(); // Public routing ID; the separate cookie authenticates it.
    const ticket = randomBytes(32).toString('hex');
    const timer = setTimeout(() => removePending(connectionId), ticketTtlMs);
    timer.unref();
    pending.set(connectionId, {
      token: match[1],
      ticketHash: createHash('sha256').update(ticket).digest(),
      expires: Date.now() + ticketTtlMs,
      timer,
    });
    response.setHeader('Set-Cookie', cookie(connectionId, ticket, origin.protocol === 'https:', Math.max(1, Math.ceil(ticketTtlMs / 1000))));
    respond(response, 200, { connectionId });
    return true;
  }

  function handleUpgrade(request, socket, head) {
    if (!request.url?.startsWith('/__echo/')) return false;
    if (closed) { rejectUpgrade(socket, 503); return true; }
    const match = SOCKET_PATH.exec(request.url);
    if (!match) { rejectUpgrade(socket, 404); return true; }
    const origin = originFor(request);
    if (!origin) { rejectUpgrade(socket, 403); return true; }
    const key = request.headers['sec-websocket-key'];
    if (request.method !== 'GET' || !hasUpgrade(request.headers) || request.headers['sec-websocket-version'] !== '13' ||
        typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || Buffer.from(key, 'base64').length !== 16) {
      rejectUpgrade(socket, 400);
      return true;
    }
    const id = match[1];
    const entry = pending.get(id);
    const ticketCookies = (request.headers.cookie ?? '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE_NAME}=`));
    const ticket = ticketCookies.length === 1 ? ticketCookies[0].slice(COOKIE_NAME.length + 1) : '';
    if (!entry || entry.expires <= Date.now() || !/^[0-9a-f]{64}$/.test(ticket) ||
        !timingSafeEqual(entry.ticketHash, createHash('sha256').update(ticket).digest())) {
      if (entry?.expires <= Date.now()) removePending(id);
      rejectUpgrade(socket, 403);
      return true;
    }
    if (activeConnections >= maxConnections) { rejectUpgrade(socket, 429); return true; }

    // Consume atomically before dialing upstream. A replay can never open a second tunnel.
    activeConnections += 1;
    const token = entry.token;
    removePending(id);
    socket.pause();
    sockets.add(socket);
    let upstreamSocket;
    let upstreamRequest;
    let settled = false;
    let stopping = false;
    let released = false;
    let shutdownTimer;
    const transport = upstream.protocol === 'https:' ? https : http;
    const timer = setTimeout(() => fail(504), connectTimeoutMs);
    timer.unref();

    function fail(status = 502) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      requests.delete(upstreamRequest);
      upstreamRequest?.destroy();
      rejectUpgrade(socket, status);
    }

    function releaseIfClosed() {
      if (!released && socket.destroyed && (!upstreamSocket || upstreamSocket.destroyed)) {
        released = true;
        activeConnections -= 1;
        clearTimeout(shutdownTimer);
      }
    }

    function stopTunnel(gracefully) {
      if (stopping) return;
      stopping = true;
      settled = true;
      clearTimeout(timer);
      requests.delete(upstreamRequest);
      upstreamRequest?.destroy();
      upstreamRequest = null;
      const peers = [socket, upstreamSocket].filter(Boolean);
      if (gracefully) {
        // A TCP end has no WebSocket half-close semantics. Flush bytes already
        // queued in both directions, then finish both halves instead of lingering.
        shutdownTimer = setTimeout(() => peers.forEach((peer) => peer.destroy()), 1000);
        shutdownTimer.unref();
        for (const peer of peers) {
          if (!peer.destroyed && peer.writable) peer.end(() => peer.destroy());
          else peer.destroy();
        }
      } else {
        peers.forEach((peer) => peer.destroy());
      }
    }

    socket.on('error', () => stopTunnel(false));
    socket.once('end', () => stopTunnel(true));
    socket.once('close', () => {
      clearTimeout(timer);
      sockets.delete(socket);
      if (!stopping) stopTunnel(false);
      releaseIfClosed();
    });

    upstreamRequest = transport.request(upstream, {
      method: 'GET',
      agent: false,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
        Origin: origin.origin,
        Authorization: `Bearer ${token}`,
      },
    });
    requests.add(upstreamRequest);
    upstreamRequest.once('response', (response) => {
      const status = [401, 403].includes(response.statusCode) ? response.statusCode : 502;
      response.destroy();
      fail(status);
    });
    upstreamRequest.once('error', () => fail());
    upstreamRequest.once('upgrade', (response, acceptedSocket, acceptedHead) => {
      if (settled || socket.destroyed) { acceptedSocket.destroy(); return; }
      const accept = createHash('sha1').update(key + WEBSOCKET_GUID).digest('base64');
      if (response.statusCode !== 101 || !hasUpgrade(response.headers) || response.headers['sec-websocket-accept'] !== accept ||
          response.headers['sec-websocket-extensions'] || response.headers['sec-websocket-protocol']) {
        acceptedSocket.destroy();
        fail();
        return;
      }
      settled = true;
      clearTimeout(timer);
      requests.delete(upstreamRequest);
      upstreamRequest = null;
      upstreamSocket = acceptedSocket;
      acceptedSocket.pause();
      sockets.add(acceptedSocket);
      acceptedSocket.on('error', () => stopTunnel(false));
      acceptedSocket.once('end', () => stopTunnel(true));
      acceptedSocket.once('close', () => {
        sockets.delete(acceptedSocket);
        if (!stopping) stopTunnel(false);
        releaseIfClosed();
      });
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: ${accept}\r\nSet-Cookie: ${cookie(id, '', origin.protocol === 'https:', 0)}\r\n\r\n`);
      if (acceptedHead?.length) socket.write(acceptedHead);
      if (head?.length) acceptedSocket.write(head);
      socket.pipe(acceptedSocket, { end: false });
      acceptedSocket.pipe(socket, { end: false });
      socket.resume();
      acceptedSocket.resume();
    });
    upstreamRequest.end();
    return true;
  }

  return {
    handleRequest,
    handleUpgrade,
    close() {
      closed = true;
      for (const id of pending.keys()) removePending(id);
      for (const request of requests) request.destroy();
      for (const socket of sockets) socket.destroy();
      requests.clear();
      sockets.clear();
    },
  };
}
