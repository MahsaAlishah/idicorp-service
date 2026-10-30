const ACCESS_TOKEN_KEY = 'access_token';
const SESSION_CHANGED = 'idicorp-session-changed';

export function saveAccessToken(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new TypeError('Access token must be a non-empty string.');
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function removeAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

// Events contain no credentials. Also reconcile changes made while the tab was inactive.
export function subscribeToSession(callback) {
  const events = [SESSION_CHANGED, 'storage', 'focus', 'pageshow'];
  events.forEach((event) => window.addEventListener(event, callback));
  return () => events.forEach((event) => window.removeEventListener(event, callback));
}
