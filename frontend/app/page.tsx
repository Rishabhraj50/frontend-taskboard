// This page runs in the browser
'use client';
// useState stores values that change; useEffect runs code after the page loads
import { useEffect, useState } from 'react';
// Link is a navigation link that doesn't reload the whole page
import Link from 'next/link';
// api calls the backend; useAuthGuard redirects to /login when not logged in
import { api, useAuthGuard } from '@/lib/api';

// The home page (route "/"): list and create boards
export default function Boards() {
  // Redirect to login if there is no token
  useAuthGuard();
  // List of boards, and the text in the "new board" input
  const [boards, setBoards] = useState<any[]>([]);
  const [name, setName] = useState('');
  // Whether we are still loading, and any error message to show
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Run once when the page opens
  useEffect(() => {
    // Only fetch if a token exists
    if (localStorage.getItem('token'))
      api('/boards') // GET the user's boards
        .then(setBoards) // store them
        .catch((e) => setErr(e.message)) // show an error if it failed
        .finally(() => setLoading(false)); // stop the loading message either way
  }, []);

  // Runs when the create-board form is submitted
  async function create(e: React.FormEvent) {
    // Stop the browser from reloading the page
    e.preventDefault();
    // Empty name: show an error and stop
    if (!name.trim()) return setErr('Board name is required');
    // Clear any old error
    setErr('');
    try {
      // POST the new board
      const b = await api('/boards', { method: 'POST', body: { name } });
      // Put it at the top of the list
      setBoards([b, ...boards]);
      // Clear the input
      setName('');
    } catch (e: any) {
      // Show the server's error
      setErr(e.message);
    }
  }

  return (
    // <> ... </> groups elements without adding an extra HTML tag
    <>
      <header>
        {/* Page title */}
        <h1>My boards</h1>
        {/* Log out: delete the token and go to the login page */}
        <button
          className="ghost"
          onClick={() => {
            localStorage.removeItem('token');
            location.href = '/login';
          }}
        >
          Log out
        </button>
      </header>
      <main>
        {/* Form for creating a board */}
        <form className="row" onSubmit={create}>
          {/* Controlled input: shows "name" and updates it on every keystroke */}
          <input placeholder="New board name" value={name} onChange={(e) => setName(e.target.value)} />
          <button>Create board</button>
        </form>
        {/* Show the error box only when there is an error */}
        {err && <div className="err">{err}</div>}
        {/* Three cases: loading / no boards / list of boards */}
        {loading ? (
          <p className="muted">Loading…</p>
        ) : boards.length === 0 ? (
          <p className="muted">No boards yet. Create your first one above.</p>
        ) : (
          <div className="grid">
            {/* One clickable card per board; key helps React track each item */}
            {boards.map((b) => (
              <Link key={b._id} href={`/boards/${b._id}`} className="card">
                <b>{b.name}</b>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
