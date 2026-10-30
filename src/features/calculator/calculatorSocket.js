import { API_UPSTREAM_BASE_URL } from '../../config.js';

const OPERATIONS = new Set(['add', 'subtract', 'multiply', 'divide']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function getCalculatorSocketUrl() {
  let base;
  try {
    base = new URL(API_UPSTREAM_BASE_URL);
  } catch {
    throw new Error('Configure the public API base URL before using the calculator.');
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash) {
    throw new Error('The public API base URL must be an HTTP(S) origin.');
  }
  if (base.protocol === 'http:' && !LOOPBACK_HOSTS.has(base.hostname)) {
    throw new Error('Calculator WebSocket authentication requires HTTPS outside localhost.');
  }
  const url = new URL('/ws/calculator', base);
  url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function validateCalculatorRequest({ operation, numbers }) {
  if (operation !== undefined && !OPERATIONS.has(operation)) {
    throw new Error('Choose a supported calculator operation.');
  }
  if (!Array.isArray(numbers) || numbers.length < 1 || numbers.length > 100 ||
      numbers.some((value) => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12)) {
    throw new Error('Enter 1 to 100 finite numbers, each with an absolute value of at most 1,000,000,000,000.');
  }
  if (operation === 'divide' && numbers.slice(1).some((value) => value === 0)) {
    throw new Error('Division by zero is not allowed.');
  }
  return operation === undefined ? { numbers } : { operation, numbers };
}

export function openCalculatorSocket({ token, onState, onResult, onError, Socket = WebSocket }) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Sign in before using the calculator.');
  }
  const socket = new Socket(getCalculatorSocketUrl());
  let state = 'connecting';
  let disposed = false;
  let networkFailed = false;
  const changeState = (next) => { state = next; if (!disposed) onState(next); };
  changeState('connecting');

  socket.onopen = () => {
    if (disposed) return;
    // The authentication JSON is the first message, sent synchronously on open.
    try {
      socket.send(JSON.stringify({ token }));
      changeState('authenticating');
    } catch {
      networkFailed = true;
      onError('Could not authenticate the calculator connection.');
      socket.close();
    }
  };
  socket.onmessage = (event) => {
    if (disposed) return;
    let message;
    try { message = JSON.parse(event.data); } catch {
      onError('The calculator sent an unreadable response.');
      return;
    }
    if (state === 'authenticating' && message?.type === 'ready') {
      changeState('ready');
    } else if (message?.error === 'Unauthorized') {
      changeState('unauthorized');
      onError('Calculator authentication failed. Sign in again.');
      socket.close();
    } else if (state === 'ready' && message?.error === 'Invalid calculator request') {
      onError('Invalid calculator request. Check the operation and numbers.');
    } else if (state === 'ready' && typeof message?.result === 'number' && Number.isFinite(message.result)) {
      onResult(message.result);
    } else {
      onError('The calculator sent an unexpected response.');
    }
  };
  socket.onerror = () => {
    if (!disposed) {
      networkFailed = true;
      onError('Calculator connection failed. Check your network and try again.');
    }
  };
  socket.onclose = () => {
    if (!disposed && state !== 'unauthorized') {
      changeState('disconnected');
      if (!networkFailed) onError('Calculator connection closed. Reconnect to continue.');
    }
  };

  return {
    sendRequest(request) {
      if (state !== 'ready' || socket.readyState !== Socket.OPEN) {
        throw new Error('Wait for the calculator connection to be ready.');
      }
      socket.send(JSON.stringify(validateCalculatorRequest(request)));
    },
    close() {
      disposed = true;
      socket.close();
    },
  };
}
