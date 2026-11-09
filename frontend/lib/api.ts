// This file runs in the browser (needed for localStorage and hooks)
'use client';
// useEffect runs code after the page appears
import { useEffect } from 'react';
// useRouter lets us change the page (redirect)
import { useRouter } from 'next/navigation';
// API address from the environment (.env.local), or localhost:5000 as a fallback
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// One helper used by every page to call the backend; opts can set the HTTP method and a body
export async function api(path: string, opts: { method?: string; body?: any } = {}) {
  // Read the saved login token from the browser
  const t = localStorage.getItem('token');
  // Send the HTTP request
  const r = await fetch(BASE + path, {
    // GET unless a method was given
    method: opts.method || 'GET',
    // Always send JSON; add the Authorization header only when we have a token
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    // Convert the body object to JSON text (or send nothing)
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  // 401 on a non-login call means the token is expired or invalid -> back to login
  if (r.status === 401 && !path.startsWith('/auth')) {
    // Remove the bad token
    localStorage.removeItem('token');
    // Go to the login page
    window.location.href = '/login';
    // Stop the calling code
    throw new Error('Session expired');
  }
  // 204 has no body, so use {}; otherwise read JSON (fall back to {} if it can't be parsed)
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  // Any non-success status becomes an Error carrying the server's message
  if (!r.ok) throw new Error(d.message || 'Request failed');
  // Return the data to the caller
  return d;
}

// Hook for pages that need a logged-in user
export function useAuthGuard() {
  // Get the router
  const router = useRouter();
  // After the page loads: if there is no token, replace this page with /login
  useEffect(() => {
    if (!localStorage.getItem('token')) router.replace('/login');
  }, [router]);
}
