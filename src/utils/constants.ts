export const FRONTEND_URL = process?.env?.FRONTEND_URL ?? 'http://localhost:5173';
export const BACKEND_URL =
  typeof process !== 'undefined' && process.env && process.env.BACKEND_URL
    ? process.env.BACKEND_URL
    : typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL
      ? import.meta.env.VITE_BACKEND_URL
      : 'http://localhost:8080/api';
export const AUTH0_USERNAME = process?.env?.AUTH0_USERNAME ?? '';
export const AUTH0_PASSWORD = process?.env?.AUTH0_PASSWORD ?? '';
