import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createEchoRelay } from './server/echoRelay.js';

function isLoopbackRequest(request) {
  const loopbackPeers = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (!loopbackPeers.includes(request.socket?.remoteAddress)) return false;

  try {
    const hostname = new URL(`http://${request.headers.host}`).hostname;
    return ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

function adaptSessionCookie(cookie, isHttps) {
  const [nameValue, ...attributes] = cookie.split(';');
  const name = nameValue.slice(0, nameValue.indexOf('=')).trim();
  if (!['session', 'task_session'].includes(name)) return cookie;

  const localAttributes = attributes
    .map((attribute) => attribute.trim())
    .filter((attribute) => {
      if (/^(domain|path)=/i.test(attribute)) return false;
      return isHttps || !/^secure$/i.test(attribute);
    });

  return [nameValue, ...localAttributes, 'Path=/api'].join('; ');
}

export function createEchoRelayPlugin(apiBaseUrl) {
  let relay;
  return {
    name: 'idicorp-echo-relay',
    configureServer(server) {
      relay = createEchoRelay({
        apiBaseUrl,
        allowedOrigin: (request) => isLoopbackRequest(request)
          ? `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}` : null,
      });
      server.middlewares.use((request, response, next) => {
        if (!relay.handleRequest(request, response)) next();
      });
      const upgrade = (request, socket, head) => relay.handleUpgrade(request, socket, head);
      server.httpServer.on('upgrade', upgrade);
      server.httpServer.once('close', () => {
        server.httpServer.off('upgrade', upgrade);
        relay.close();
      });
    },
    closeBundle() { relay?.close(); },
  };
}

export function createApiProxy(target) {
  let apiOrigin;
  try {
    apiOrigin = new URL(target);
  } catch {
    throw new Error('Set VITE_API_BASE_URL to an absolute HTTP(S) API origin.');
  }

  if (
    !['http:', 'https:'].includes(apiOrigin.protocol) ||
    apiOrigin.username ||
    apiOrigin.password ||
    apiOrigin.pathname !== '/' ||
    apiOrigin.search ||
    apiOrigin.hash
  ) {
    throw new Error('VITE_API_BASE_URL must contain only the public HTTP(S) API origin.');
  }

  return {
    '^/api(?:/|\\?|$)': {
      target: apiOrigin.origin,
      changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyRes', (response, request) => {
          const cookies = response.headers['set-cookie'];
          if (!cookies || !isLoopbackRequest(request)) return;

          // Only the two API session cookies are adapted for local browser storage.
          response.headers['set-cookie'] = cookies.map((cookie) =>
            adaptSessionCookie(cookie, Boolean(request.socket?.encrypted)),
          );
        });
      },
    },
  };
}

export default defineConfig(({ command, mode, isPreview }) => {
  const config = {
    plugins: [react(), tailwindcss()],
  };

  if (command === 'serve' && !isPreview && mode !== 'test') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    config.plugins.push(createEchoRelayPlugin(env.VITE_API_BASE_URL));
    config.server = {
      host: '127.0.0.1',
      proxy: createApiProxy(env.VITE_API_BASE_URL),
    };
  }

  return config;
});
