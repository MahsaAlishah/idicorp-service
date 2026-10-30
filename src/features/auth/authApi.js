import { API_BASE_URL } from '../../config.js';

const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;

async function requestJson(url, options, responseErrorMessage) {
  let response;

  try {
    response = options ? await fetch(url, options) : await fetch(url);
  } catch {
    throw new Error('Unable to reach the authentication service.');
  }

  if (!response.ok) {
    throw new Error(responseErrorMessage);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(responseErrorMessage);
  }
}

export function getCaptcha() {
  return requestJson(LOGIN_URL, undefined, 'Unable to load CAPTCHA.');
}

export function login({ username, password, salt, captcha_answer }) {
  return requestJson(
    LOGIN_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password, salt, captcha_answer }),
    },
    'Sign-in failed.',
  );
}
