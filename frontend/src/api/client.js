export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, signal } = options;

  const finalHeaders = { ...headers };
  const token = localStorage.getItem('token');
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let finalBody;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      finalBody = body;
    } else if (typeof body === 'object') {
      finalHeaders['Content-Type'] = 'application/json';
      finalBody = JSON.stringify(body);
    } else {
      finalBody = body;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: finalBody,
    signal,
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { data = await res.json(); } catch {}
  }

  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Request failed';
    throw new ApiError(message, res.status);
  }

  return data;
}
