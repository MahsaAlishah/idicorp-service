const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const CONNECTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function relayOrigin() {
  const base = new URL(window.location.origin);
  if (base.protocol === 'http:' && !LOOPBACK_HOSTS.has(base.hostname)) {
    throw new Error('Text echo WebSocket requires HTTPS outside localhost.');
  }
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Text echo requires an HTTP(S) frontend.');
  return base;
}

export function getEchoSocketUrl(connectionId) {
  if (!CONNECTION_ID.test(connectionId)) throw new Error('Invalid Echo connection identifier.');
  const base = relayOrigin();
  // This public routing ID cannot authorize a connection without its HttpOnly cookie.
  const url = new URL(`/__echo/ws/${connectionId}`, base);
  url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function openEchoSocket({ token, onState, onReceived, onError, Socket = WebSocket, request = fetch }) {
  if (typeof token !== 'string' || !token.length) throw new Error('Sign in before using text echo.');
  const preparationUrl = new URL('/__echo/session', relayOrigin()).toString();
  const controller = new AbortController();
  let socket;
  let state = 'preparing';
  let disposed = false;
  let failed = false;
  const changeState = (next) => { state = next; if (!disposed) onState(next); };
  changeState('preparing');

  function fail(message) {
    if (disposed) return;
    failed = true;
    changeState('disconnected');
    onError(message);
    disposed = true;
    controller.abort();
    socket?.close();
  }

  async function prepare() {
    let response;
    try {
      response = await request(preparationUrl, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      });
    } catch {
      fail('Could not reach the text echo relay. Check your network and try again.');
      return;
    }
    if (disposed) return;
    if (!response.ok) {
      fail(response.status === 401 || response.status === 403
        ? 'The text echo relay rejected authorization. Check your session and relay configuration.'
        : 'The text echo relay is unavailable. Check its deployment and try again.');
      return;
    }
    try {
      const { connectionId } = await response.json();
      if (disposed) return;
      socket = new Socket(getEchoSocketUrl(connectionId));
    } catch {
      fail('Could not prepare the text echo connection. Check the relay and try again.');
      return;
    }
    changeState('connecting');
    socket.onopen = () => { if (!disposed) changeState('waiting for ready'); };
    socket.onmessage = (event) => {
      if (disposed || typeof event.data !== 'string') return;
      let message;
      try { message = JSON.parse(event.data); } catch { /* Echo text need not be JSON. */ }
      if (event.data.includes(token) || message?.token === token) {
        fail('Text echo returned authentication data. The connection was closed safely.');
      } else if (state === 'waiting for ready') {
        if (message?.type === 'ready') changeState('ready');
        else fail('Text echo did not confirm readiness. Reconnect to try again.');
      } else if (state === 'ready') onReceived(event.data);
    };
    socket.onerror = () => fail('Text echo connection failed. Check your network, session, and relay.');
    socket.onclose = () => {
      if (!disposed) {
        changeState('disconnected');
        if (!failed) onError('Text echo connection closed. Reconnect to continue.');
      }
    };
  }
  void prepare();

  return {
    sendText(text) {
      if (disposed || state !== 'ready' || socket?.readyState !== Socket.OPEN) {
        throw new Error('Wait for text echo to be ready.');
      }
      if (text.includes(token)) throw new Error('Do not send authentication data as echo text.');
      socket.send(text);
    },
    close() { disposed = true; controller.abort(); socket?.close(); },
  };
}
