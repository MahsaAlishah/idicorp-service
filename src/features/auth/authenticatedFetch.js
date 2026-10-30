import { getAccessToken } from './authSession.js';
import { API_BASE_URL } from '../../config.js';

export class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.status = 401;
  }
}

function resolveApiInput(input) {
  let apiBaseUrl;

  try {
    apiBaseUrl = new URL(API_BASE_URL);
  } catch {
    throw new Error('The configured API base URL is invalid.');
  }

  if (!['http:', 'https:'].includes(apiBaseUrl.protocol)) {
    throw new Error('The configured API base URL is invalid.');
  }

  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  let targetUrl;

  try {
    targetUrl = isRequest
      ? new URL(input.url)
      : new URL(input, apiBaseUrl);
  } catch {
    throw new Error('The request URL is invalid.');
  }

  if (targetUrl.origin !== apiBaseUrl.origin) {
    throw new Error('Authenticated requests must target the configured API origin.');
  }

  return {
    input: isRequest ? input : targetUrl.href,
    headers: isRequest ? input.headers : undefined,
  };
}

export async function authenticatedFetch(input, options = {}) {
  const resolved = resolveApiInput(input);
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new AuthenticationError('Authentication is required for this request.');
  }

  const headers = new Headers(resolved.headers);
  new Headers(options.headers).forEach((value, name) => {
    headers.set(name, value);
  });
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(resolved.input, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new AuthenticationError('Your session is missing or no longer valid.');
  }

  return response;
}
