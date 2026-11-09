// This page runs in the browser
'use client';
// useState = values that change; useEffect = run code after render; useCallback = keep a function stable between renders
import { useCallback, useEffect, useState } from 'react';
// useParams reads the [id] from the URL; useRouter changes pages
import { useParams, useRouter } from 'next/navigation';
// API helper and login guard
import { api, useAuthGuard } from '@/lib/api';

// A blank task form, used when creating a new task
const empty = { title: '', description: '', assignee: '', dueDate: '', priority: 'Medium', labels: '' };

// The page for one board (route /boards/<id>)
export default function BoardPage() {
  // Redirect to login if not logged in
  useAuthGuard();
  // id = the board id in the URL; router = used to navigate
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // The board (name, members), its columns, and its tasks
  const [board, setBoard] = useState<any>(null);
  const [cols, setCols] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  // Current filter values (sent to the backend)
  const [flt, setFlt] = useState({ assignee: '', priority: '', label: '', overdue: false, q: '' });
  // Loading flag and error message
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // The task form popup: null = closed; otherwise which column, and which task when editing
  const [modal, setModal] = useState<{ colId: string; task?: any } | null>(null);
  // Id of the task currently being dragged
  const [drag, setDrag] = useState<string | null>(null);

  // Fetch tasks from the backend using the current filters
  const loadTasks = useCallback(async () => {
    // Builds "?key=value&key=value" text
    const p = new URLSearchParams();
    // Add each filter only if it has a value
    if (flt.assignee) p.set('assignee', flt.assignee);
    if (flt.priority) p.set('priority', flt.priority);
    if (flt.label) p.set('label', flt.label);
    if (flt.overdue) p.set('overdue', 'true');
    if (flt.q) p.set('q', flt.q);
    // Request and store the tasks; filtering runs on the backend
    setTasks(await api(`/boards/${id}/tasks?${p}`));
  }, [id, flt]); // re-create this function only when the board id or filters change

  // Fetch the board details and its columns
  const loadBoard = useCallback(async () => {
    // Ask the backend
    const d = await api(`/boards/${id}`);
    // Store the board and columns
    setBoard(d.board);
    setCols(d.columns);
  }, [id]);

  // Load the board when the page opens (and if the id changes)
  useEffect(() => {
    if (localStorage.getItem('token')) loadBoard().catch((e) => setErr(e.message));
  }, [loadBoard]);

  // Load tasks when the page opens and again whenever a filter changes
  useEffect(() => {
    if (localStorage.getItem('token'))
      loadTasks()
        .catch((e) => setErr(e.message)) // show errors
        .finally(() => setLoading(false)); // stop the loading message
  }, [loadTasks]);

  // Run an action and show any error in the red box instead of crashing
  const run = async (fn: () => Promise<any>) => {
    // Clear the old error
    setErr('');
    try {
      // Run the action
      await fn();
    } catch (e: any) {
      // Show its error
      setErr(e.message);
    }
  };

  // Optimistic drag & drop: update UI first, roll back (reload) if API fails.
  // colId = column dropped on; beforeId = task we dropped next to (null = end of column)
  async function drop(colId: string, beforeId: string | null) {
    // Nothing is being dragged: stop
    if (!drag) return;
    // Find the task being dragged
    const moving = tasks.find((t) => t._id === drag);
    // Dragging is finished
    setDrag(null);
    // Stop if the task wasn't found, or it was dropped on itself
    if (!moving || drag === beforeId) return;
    // Remember the old list so we can undo if the server fails
    const prev = tasks;
    // The target column's other tasks, in order
    const target = tasks
      .filter((t) => t.column === colId && t._id !== moving._id)
      .sort((a, b) => a.position - b.position);
    // Where to insert: before beforeId, or at the end (-1 means not found)
    const i = beforeId ? target.findIndex((t) => t._id === beforeId) : -1;
    // Insert the moved task there, with its new column
    target.splice(i === -1 ? target.length : i, 0, { ...moving, column: colId });
    // Map each task id to its new position number (0, 1, 2...)
    const pos = new Map(target.map((t, k) => [t._id, k]));
    // Update the screen immediately: tasks in the target column get the new column and position
    setTasks(tasks.map((t) => (pos.has(t._id) ? { ...t, column: colId, position: pos.get(t._id) } : t)));
    try {
      // Tell the server about the move
      await api(`/boards/${id}/tasks/${moving._id}/move`, { method: 'PATCH', body: { columnId: colId, beforeId } });
    } catch (e: any) {
      // Server refused: put the old list back and explain
      setTasks(prev);
      setErr('Move failed, rolled back: ' + e.message);
    }
  }

  // Save the task form (create or edit); form = the values from the popup
  async function save(e: React.FormEvent<HTMLFormElement>, form: any) {
    // Don't reload the page
    e.preventDefault();
    // Title is required
    if (!form.title.trim()) return setErr('Title is required');
    // Build the request body
    const body = {
      title: form.title,
      description: form.description,
      assignee: form.assignee || null, // empty choice becomes null (unassigned)
      dueDate: form.dueDate || null, // empty date becomes null
      priority: form.priority,
      // "a, b, c" -> ['a','b','c'], trimmed, empty ones removed
      labels: form.labels.split(',').map((s: string) => s.trim()).filter(Boolean),
      // Only a new task needs the column (editing can't change it)
      ...(modal!.task ? {} : { column: modal!.colId }),
    };
    // Run with error handling
    await run(async () => {
      // PATCH /tasks/<id> when editing, POST /tasks when creating
      await api(`/boards/${id}/tasks${modal!.task ? '/' + modal!.task._id : ''}`, {
        method: modal!.task ? 'PATCH' : 'POST',
        body,
      });
      // Close the popup
      setModal(null);
      // Reload the tasks to show the change
      await loadTasks();
    });
  }

  // While the first load is running, show a loading (or error) message
  if (loading && !board) return <main><p className="muted">{err || 'Loading…'}</p></main>;

  return (
    <>
      <header>
        {/* Board name (the ? avoids a crash while board is still null) */}
        <h1>{board?.name}</h1>
        <div className="row">
          {/* Back to the boards list */}
          <button className="ghost" onClick={() => router.push('/')}>All boards</button>
          {/* Rename the board: ask for a new name with a browser prompt */}
          <button
            className="ghost"
            onClick={() => {
              const n = prompt('Rename board', board.name);
              // Only continue if a non-empty name was typed
              if (n?.trim())
                run(async () => {
                  await api(`/boards/${id}`, { method: 'PATCH', body: { name: n } });
                  loadBoard(); // refresh to show the new name
                });
            }}
          >
            Rename
          </button>
          {/* Invite a user to the board by email */}
          <button
            className="ghost"
            onClick={() => {
              const email = prompt('Invite user by email');
              if (email)
                run(async () => {
                  await api(`/boards/${id}/invite`, { method: 'POST', body: { email } });
                  loadBoard(); // refresh the members list
                });
            }}
          >
            Invite
          </button>
          {/* Delete the whole board after a confirmation */}
          <button
            className="danger"
            onClick={() => {
              if (confirm('Delete this board?'))
                run(async () => {
                  await api(`/boards/${id}`, { method: 'DELETE' });
                  router.push('/'); // go back to the list
                });
            }}
          >
            Delete
          </button>
        </div>
      </header>
      <main>
        {/* Filter bar: each control updates "flt", which triggers a new fetch */}
        <div className="row">
          {/* Search text in task titles */}
          <input placeholder="Search title" value={flt.q} onChange={(e) => setFlt({ ...flt, q: e.target.value })} />
          {/* Filter by assignee; options come from the board's members */}
          <select value={flt.assignee} onChange={(e) => setFlt({ ...flt, assignee: e.target.value })}>
            <option value="">Any assignee</option>
            {board?.members.map((m: any) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
          {/* Filter by priority */}
          <select value={flt.priority} onChange={(e) => setFlt({ ...flt, priority: e.target.value })}>
            <option value="">Any priority</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          {/* Filter by label text */}
          <input
            placeholder="Label"
            value={flt.label}
            onChange={(e) => setFlt({ ...flt, label: e.target.value })}
            style={{ width: 100 }}
          />
          {/* Show only overdue tasks */}
          <label>
            <input type="checkbox" checked={flt.overdue} onChange={(e) => setFlt({ ...flt, overdue: e.target.checked })} /> Overdue
          </label>
        </div>
        {/* Error box */}
        {err && <div className="err">{err}</div>}
        {/* The board: one box per column */}
        <div className="cols">
          {cols.map((c) => {
            // This column's tasks, sorted by position
            const list = tasks.filter((t) => t.column === c._id).sort((a, b) => a.position - b.position);
            return (
              <div
                key={c._id}
                className="col"
                // Allow dropping onto this column (without this the browser refuses drops)
                onDragOver={(e) => e.preventDefault()}
                // Dropped on empty space in the column: move to the end
                onDrop={() => drop(c._id, null)}
              >
                {/* Column header: name + count on the left, rename/delete on the right */}
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>
                    {c.name} <span className="muted">({list.length})</span>
                  </b>
                  <span>
                    {/* Rename column */}
                    <button
                      className="ghost"
                      onClick={() => {
                        const n = prompt('Rename column', c.name);
                        if (n?.trim())
                          run(async () => {
                            await api(`/boards/${id}/columns/${c._id}`, { method: 'PATCH', body: { name: n } });
                            loadBoard();
                          });
                      }}
                    >
                      ✎
                    </button>{' '}
                    {/* Delete column (its tasks are deleted too) */}
                    <button
                      className="ghost"
                      onClick={() => {
                        if (confirm('Delete column and its tasks?'))
                          run(async () => {
                            await api(`/boards/${id}/columns/${c._id}`, { method: 'DELETE' });
                            await loadBoard(); // refresh columns
                            await loadTasks(); // refresh tasks
                          });
                      }}
                    >
                      🗑
                    </button>
                  </span>
                </div>
                {/* Message for an empty column */}
                {list.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No tasks</p>}
                {/* One card per task */}
                {list.map((t) => (
                  <div
                    key={t._id}
                    className="task"
                    draggable // the browser lets the user drag this element
                    onDragStart={() => setDrag(t._id)} // remember which task is dragged
                    onDrop={(e) => {
                      e.stopPropagation(); // don't also trigger the column's drop
                      drop(c._id, t._id); // insert before this task
                    }}
                  >
                    {/* Task title */}
                    <b>{t.title}</b>
                    {/* Priority badge, then a badge for each label */}
                    <div>
                      <span className={`badge ${t.priority}`}>{t.priority}</span>
                      {t.labels.map((l: string) => (
                        <span key={l} className="badge">{l}</span>
                      ))}
                    </div>
                    {/* Assignee name, and due date (red if already past) */}
                    <div className="muted">
                      {t.assignee?.name || 'Unassigned'}
                      {t.dueDate && (
                        <span style={{ color: new Date(t.dueDate) < new Date() ? '#d64545' : undefined }}>
                          {' '}
                          · due {t.dueDate.slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <div className="row">
                      {/* Open the popup to edit this task */}
                      <button className="ghost" onClick={() => setModal({ colId: c._id, task: t })}>Edit</button>
                      {/* Delete this task after a confirmation */}
                      <button
                        className="ghost"
                        onClick={() => {
                          if (confirm('Delete task?'))
                            run(async () => {
                              await api(`/boards/${id}/tasks/${t._id}`, { method: 'DELETE' });
                              loadTasks();
                            });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {/* Open the popup to add a task to this column */}
                <button className="ghost" style={{ width: '100%' }} onClick={() => setModal({ colId: c._id })}>+ Add task</button>
              </div>
            );
          })}
          {/* An extra box at the end for adding a column */}
          <div className="col">
            <button
              className="ghost"
              style={{ width: '100%' }}
              onClick={() => {
                const n = prompt('Column name');
                if (n?.trim())
                  run(async () => {
                    await api(`/boards/${id}/columns`, { method: 'POST', body: { name: n } });
                    loadBoard();
                  });
              }}
            >
              + Add column
            </button>
          </div>
        </div>
      </main>
      {/* Show the task popup when "modal" is set */}
      {modal && <TaskForm members={board.members} task={modal.task} onSave={save} onClose={() => setModal(null)} />}
    </>
  );
}

// The popup form for creating or editing a task
// members = users for the assignee list; task = task being edited (or undefined); onSave/onClose = functions from the page
function TaskForm({ members, task, onSave, onClose }: any) {
  // Form values: copy from the task when editing, otherwise start blank
  const [f, setF] = useState(
    task
      ? {
          title: task.title,
          description: task.description,
          assignee: task.assignee?._id || '', // id of the assignee, or empty
          dueDate: task.dueDate?.slice(0, 10) || '', // keep only YYYY-MM-DD
          priority: task.priority,
          labels: task.labels.join(', '), // list -> "a, b"
        }
      : empty
  );
  // set('title') returns a function that updates just that one field
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    // Dark overlay: clicking it closes the popup
    <div className="modal" onClick={onClose}>
      {/* stopPropagation: clicks inside the form should NOT close it; submitting calls onSave with the form values */}
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => onSave(e, f)}>
        {/* Heading depends on create vs edit */}
        <h2>{task ? 'Edit task' : 'New task'}</h2>
        {/* Title */}
        <input placeholder="Title *" value={f.title} onChange={set('title')} />
        {/* Description */}
        <textarea placeholder="Description" rows={3} value={f.description} onChange={set('description')} />
        {/* Assignee dropdown */}
        <select value={f.assignee} onChange={set('assignee')}>
          <option value="">Unassigned</option>
          {members.map((m: any) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>
        {/* Due date picker */}
        <input type="date" value={f.dueDate} onChange={set('dueDate')} />
        {/* Priority dropdown */}
        <select value={f.priority} onChange={set('priority')}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        {/* Labels typed as comma-separated text */}
        <input placeholder="Labels, comma separated" value={f.labels} onChange={set('labels')} />
        {/* When editing, show the last four history entries with their times */}
        {task?.activity && (
          <div className="muted" style={{ fontSize: 12 }}>
            {task.activity.slice(-4).map((a: any, i: number) => (
              <div key={i}>{a.text} · {new Date(a.at).toLocaleString()}</div>
            ))}
          </div>
        )}
        {/* Save submits the form; Cancel (type="button") only closes it */}
        <div className="row">
          <button>Save</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
