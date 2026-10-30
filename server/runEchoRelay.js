import { createServer } from 'node:http';
import { createEchoRelay } from './echoRelay.js';

// Deploy behind the frontend's TLS reverse proxy; this process serves no assets.
try {
  const port = Number(process.env.ECHO_RELAY_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !process.env.ECHO_RELAY_ORIGIN) {
    throw new Error('Invalid relay configuration.');
  }
  const relay = createEchoRelay({
    apiBaseUrl: process.env.VITE_API_BASE_URL,
    allowedOrigin: process.env.ECHO_RELAY_ORIGIN,
  });
  const server = createServer((request, response) => {
    if (!relay.handleRequest(request, response)) {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end();
    }
  });
  server.on('upgrade', (request, socket, head) => {
    if (!relay.handleUpgrade(request, socket, head)) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.on('error', () => {
    console.error('Echo relay could not start. Check its port and configuration.');
    relay.close();
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.info(`Echo relay listening on loopback port ${port}.`));
  const shutdown = () => { relay.close(); server.close(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error('Set VITE_API_BASE_URL, ECHO_RELAY_ORIGIN, and a valid optional ECHO_RELAY_PORT.');
  process.exitCode = 1;
}
