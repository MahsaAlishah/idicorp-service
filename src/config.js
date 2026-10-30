export const API_UPSTREAM_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? window.location.origin
    : API_UPSTREAM_BASE_URL;
