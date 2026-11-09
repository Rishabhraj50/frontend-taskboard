// This page runs in the browser
'use client';
// State hook
import { useState } from 'react';
// Router, used to go to the home page after login
import { useRouter } from 'next/navigation';
// API helper
import { api } from '@/lib/api';

// The /login page: one form that works for both log in and sign up
export default function Login() {
  // Router for redirecting
  const router = useRouter();
  // false = login mode, true = sign-up mode
  const [signup, setSignup] = useState(false);
  // The three form fields stored together in one object
  const [f, setF] = useState({ name: '', email: '', password: '' });
  // Error message, and "busy" which disables the button while waiting
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Runs when the form is submitted
  async function submit(e: React.FormEvent) {
    // Don't reload the page
    e.preventDefault();
    // Clear the old error
    setErr('');
    // Client-side checks (the server checks again)
    if (signup && !f.name.trim()) return setErr('Name is required');
    // Simple email pattern: something@something.something with no spaces
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a valid email');
    if (f.password.length < 6) return setErr('Password must be at least 6 characters');
    // Disable the button while the request is running
    setBusy(true);
    try {
      // Call signup or login depending on the mode
      const d = await api(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body: f });
      // Save the returned token so later requests are authenticated
      localStorage.setItem('token', d.token);
      // Go to the home page (replace = the login page isn't left in the back history)
      router.replace('/');
    } catch (e: any) {
      // Show the server's error
      setErr(e.message);
    } finally {
      // Always re-enable the button
      setBusy(false);
    }
  }

  return (
    // Narrow centered area; the form is drawn as a white card
    <main style={{ maxWidth: 380 }}>
      <form className="card" onSubmit={submit}>
        {/* Title changes with the mode */}
        <h1>{signup ? 'Create account' : 'Log in'}</h1>
        {/* Stack the fields vertically */}
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {/* Name field is shown only when signing up; { ...f, name: value } copies f and changes just name */}
          {signup && <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
          {/* Email field */}
          <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          {/* Password field; type="password" hides the characters */}
          <input
            type="password"
            placeholder="Password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
          {/* Error message, only when there is one */}
          {err && <div className="err">{err}</div>}
          {/* Submit button: disabled while busy, label depends on state */}
          <button disabled={busy}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
          {/* Switch between login and sign-up mode (type="button" so it does not submit the form) */}
          <button type="button" className="ghost" onClick={() => setSignup(!signup)}>
            {signup ? 'Have an account? Log in' : 'New here? Sign up'}
          </button>
        </div>
      </form>
    </main>
  );
}
