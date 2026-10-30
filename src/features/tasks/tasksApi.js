import { authenticatedFetch, AuthenticationError } from '../auth/authenticatedFetch.js';
import { getAccessToken } from '../auth/authSession.js';
import { validateTask } from './taskValidation.js';

export class TaskApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'TaskApiError';
    this.status = status;
  }
}

function isTask(task) {
  return task && ['string', 'number'].includes(typeof task.id) &&
    typeof task.title === 'string' &&
    (task.description == null || typeof task.description === 'string') &&
    typeof task.completed === 'boolean' && typeof task.created_at === 'string' &&
    typeof task.updated_at === 'string';
}

async function request(path, { method = 'GET', body, signal, list = false, taskSpecific = false } = {}) {
  const session = getAccessToken();
  const assertCurrent = () => {
    if (signal?.aborted || getAccessToken() !== session) {
      throw new DOMException('Request no longer belongs to the current view.', 'AbortError');
    }
  };
  let response;
  try {
    assertCurrent();
    response = await authenticatedFetch(path, {
      method, signal,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    });
    assertCurrent();
  } catch (error) {
    assertCurrent();
    if (error instanceof AuthenticationError || error?.name === 'AbortError') throw error;
    throw new TaskApiError('Network error. Unable to reach the task service. Please retry.');
  }
  if (!response.ok) {
    const messages = {
      404: taskSpecific
        ? 'This task is no longer available in this session. It may have expired. Refresh the list.'
        : 'The requested resource was not found. Please retry.',
      422: 'The task service rejected these values. Check the fields and try again.',
      503: 'The task service is temporarily unavailable. Please try again later.',
    };
    throw new TaskApiError(messages[response.status] || 'The task request failed. Please retry.', response.status);
  }
  if (method === 'DELETE') {
    if (response.status !== 204) throw new TaskApiError('The task service returned an unexpected response.');
    return;
  }
  if (method === 'POST' && response.status !== 201) {
    throw new TaskApiError('The task service returned an unexpected response. Refresh before retrying.');
  }
  let data;
  try { data = await response.json(); } catch {
    assertCurrent();
    throw new TaskApiError('Unable to read the task response. Refresh before retrying.');
  }
  assertCurrent();
  if (list ? !Array.isArray(data) || !data.every(isTask) : !isTask(data)) {
    throw new TaskApiError('The task service returned an invalid response.');
  }
  return data;
}

function payload(values, method) {
  const body = Object.fromEntries(['title', 'description', 'completed']
    .filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]));
  const errors = validateTask(body, method === 'PATCH');
  if (method === 'PUT' && (!Object.hasOwn(body, 'description') || !Object.hasOwn(body, 'completed'))) {
    throw new TaskApiError('A full edit requires title, description, and completion status.', 422);
  }
  if (method === 'PATCH' && !Object.keys(body).length) {
    throw new TaskApiError('Choose at least one field to update.', 422);
  }
  if (Object.keys(errors).length) throw new TaskApiError(Object.values(errors)[0], 422);
  return body;
}

const taskPath = (id) => `/api/tasks/${encodeURIComponent(id)}`;

export function listTasks({ q = '', completed = '' } = {}, options = {}) {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (completed === true || completed === false || completed === 'true' || completed === 'false') {
    query.set('completed', String(completed));
  }
  return request(`/api/tasks${query.size ? `?${query}` : ''}`, { ...options, list: true });
}
export const getTask = (id, options) => request(taskPath(id), { ...options, taskSpecific: true });
export const createTask = (values, options) => request('/api/tasks', { ...options, method: 'POST', body: payload(values, 'POST') });
export const replaceTask = (id, values, options) => request(taskPath(id), { ...options, method: 'PUT', taskSpecific: true, body: payload(values, 'PUT') });
export const patchTask = (id, values, options) => request(taskPath(id), { ...options, method: 'PATCH', taskSpecific: true, body: payload(values, 'PATCH') });
export const deleteTask = (id, options) => request(taskPath(id), { ...options, method: 'DELETE', taskSpecific: true });
