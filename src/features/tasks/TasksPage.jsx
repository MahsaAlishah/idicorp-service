import { useEffect, useRef, useState } from 'react';
import { createTask, deleteTask, getTask, listTasks, patchTask, replaceTask } from './tasksApi.js';
import TaskForm, { buttonClass, dangerButtonClass, primaryButtonClass } from './TaskForm.jsx';
import ConsoleIcon from '../../components/ConsoleIcon.jsx';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

export default function TasksPage({ onSignInRequired }) {
  const [filters, setFilters] = useState({ q: '', completed: '' });
  const [query, setQuery] = useState('');
  const [completion, setCompletion] = useState('');
  const [revision, setRevision] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authError, setAuthError] = useState('');
  const [panel, setPanel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const scope = useRef(null);
  const newButton = useRef(null);
  const panelOpener = useRef(null);
  const detailHeading = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    return () => controller.abort();
  }, []);

  function handleError(failure, operation, id, destination = setError) {
    if (failure?.name === 'AbortError') return;
    if (failure?.status === 401) {
      scope.current.abort();
      setTasks([]);
      setDetail(null);
      setPanel(null);
      setSuccess('');
      setAuthError('Your session is missing or no longer valid. Sign in again to load your current tasks.');
      return;
    }
    if (failure?.status === 404 && id !== undefined) {
      setTasks((items) => items.filter((task) => task.id !== id));
      setDetail(null);
      setPanel(null);
    }
    destination(`${operation}: ${failure.message || 'The request failed. Please retry.'}`);
  }

  useEffect(() => {
    if (authError) return;
    const controller = new AbortController();
    const pageScope = scope.current;
    const signal = AbortSignal.any([controller.signal, pageScope.signal]);
    setLoading(true);
    setTasks([]);
    setListError('');
    listTasks(filters, { signal }).then((items) => {
      if (!signal.aborted) setTasks(items);
    }).catch((failure) => {
      if (!signal.aborted) handleError(failure, 'Unable to load tasks', undefined, setListError);
    }).finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision, authError]);

  const selectedId = panel?.kind === 'detail' ? panel.id : undefined;
  useEffect(() => {
    setDetail(null);
    if (selectedId === undefined || authError) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, scope.current.signal]);
    setError('');
    setDetailLoading(true);
    getTask(selectedId, { signal }).then((task) => {
      if (!signal.aborted) setDetail(task);
    }).catch((failure) => {
      if (!signal.aborted) handleError(failure, 'Unable to load task', selectedId);
    }).finally(() => { if (!signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision, authError]);

  useEffect(() => {
    if (detail && !editing) detailHeading.current?.focus();
  }, [detail, editing]);

  function closePanel() {
    setPanel(null);
    setEditing(false);
    setConfirmDelete(false);
    (panelOpener.current?.isConnected ? panelOpener.current : newButton.current)?.focus();
    panelOpener.current = null;
  }

  function showPanel(next, opener) {
    panelOpener.current = opener;
    setError('');
    setSuccess('');
    setEditing(false);
    setConfirmDelete(false);
    setPanel(next);
  }

  async function mutate(operation, perform, id) {
    if (mutationLock.current || scope.current.signal.aborted) return;
    mutationLock.current = true;
    const signal = scope.current.signal;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await perform(signal);
      if (signal.aborted) return;
      setSuccess(`${operation} succeeded.`);
      closePanel();
      setRevision((value) => value + 1);
    } catch (failure) {
      if (!signal.aborted) handleError(failure, operation, id);
    } finally {
      mutationLock.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  function search(event) {
    event.preventDefault();
    closePanel();
    setError('');
    setSuccess('');
    setFilters({ q: query, completed: completion });
  }

  return (
    <main id="main-content" tabIndex={-1} className="text-[#172337] focus:outline-none">
      <div className="mx-auto max-w-[1280px]">
        <header className="border-b border-slate-200 pb-6 sm:pb-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6374ca]">Workspace / Task management</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#172337] sm:text-[38px]">Tasks</h1>
          </div>
        </header>
        {authError ? <section className="mt-4 space-y-4">
          <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{authError}</p>
          <button className={buttonClass} onClick={onSignInRequired}>Sign in again</button>
        </section> : <>
          <form onSubmit={search} aria-label="Search and filter tasks" className="mt-5 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_32px_-25px_rgba(28,43,76,0.35)] sm:grid-cols-2 sm:items-end sm:p-5 lg:grid-cols-[minmax(200px,1fr)_160px_auto_auto_auto]">
            <div className="min-w-0">
              <label htmlFor="task-search" className="block text-[11px] font-bold text-slate-700">Search titles and descriptions</label>
              <input id="task-search" value={query} onChange={(event) => setQuery(event.target.value)} disabled={busy}
                placeholder="Title or description" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-[#fbfcfe] px-3.5 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10" />
            </div>
            <div className="min-w-0">
              <label htmlFor="task-filter" className="block text-[11px] font-bold text-slate-700">Completion</label>
              <select id="task-filter" value={completion} onChange={(event) => setCompletion(event.target.value)} disabled={busy}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-[#fbfcfe] px-3.5 text-sm outline-none transition hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10">
                <option value="">All tasks</option><option value="false">Incomplete</option><option value="true">Completed</option>
              </select>
            </div>
            <button type="submit" disabled={busy} className={primaryButtonClass}><ConsoleIcon name="search" className="size-4" /> Apply filters</button>
            <button type="button" disabled={busy} className={buttonClass} onClick={() => { closePanel(); setError(''); setSuccess(''); setRevision((value) => value + 1); }}><ConsoleIcon name="refresh" className="size-4" /> Refresh tasks</button>
            <button ref={newButton} type="button" disabled={busy} className={primaryButtonClass} onClick={(event) => showPanel({ kind: 'create' }, event.currentTarget)}><ConsoleIcon name="plus" className="size-4" /> New task</button>
          </form>
          {success && <p role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}
          {error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {busy && <p role="status" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#5368cf]"><span className="size-2 animate-pulse rounded-full bg-[#5368cf]" /> Saving changes...</p>}
          <section aria-label="Task summary" className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            {[
              ['In current view', tasks.length, 'grid'],
              ['Completed', tasks.filter((task) => task.completed).length, 'check'],
              ['Open', tasks.filter((task) => !task.completed).length, 'clock'],
            ].map(([label, value, icon]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_8px_22px_-20px_rgba(20,35,64,0.4)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0f3ff] text-[#5a6fd1]"><ConsoleIcon name={icon} className="size-4" /></span>
              <span><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span><span className="mt-0.5 block text-lg font-semibold leading-none text-[#1b2940]">{value}</span></span>
            </div>)}
          </section>
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <section aria-label="Task list" aria-busy={loading} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)]">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div><h2 className="text-sm font-bold text-[#223149]">Your tasks</h2><p className="mt-1 text-[11px] text-slate-500">{loading ? 'Syncing your session...' : `${tasks.length} shown`}</p></div>
                <span className="rounded-full bg-[#f2f4fa] px-2.5 py-1 text-[10px] font-semibold text-slate-500">Current session</span>
              </div>
              {loading && <p role="status" className="px-5 py-6 text-sm text-slate-500">Loading tasks…</p>}
              {listError && <div className="p-5"><p role="alert" className="text-sm text-red-800">{listError}</p><button className={`${buttonClass} mt-3`} disabled={busy} onClick={() => setRevision((value) => value + 1)}>Retry loading tasks</button></div>}
              {!loading && !listError && tasks.length === 0 && <div className="px-5 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4ff] text-[#5e72d2]"><ConsoleIcon name="tasks" className="size-5" /></span>
                <p className="mt-4 text-sm font-semibold text-[#25344b]">{filters.q || filters.completed !== '' ? 'No tasks match these filters.' : 'No tasks in this session. Create a task to get started.'}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{filters.q || filters.completed !== '' ? 'Try another search or change the completion filter.' : 'Your list will be stored in this authenticated workspace.'}</p>
              </div>}
              <ul className="divide-y divide-slate-100">
                {tasks.map((task) => <li key={task.id} className="group px-4 py-4 transition-colors hover:bg-[#fafbfe] sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <button className="max-w-full break-words rounded-sm text-left text-sm font-bold text-[#304bc5] decoration-[#9aa9ee] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#335de8]" disabled={busy}
                        onClick={(event) => showPanel({ kind: 'detail', id: task.id }, event.currentTarget)}>{task.title}</button>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{task.description || 'No description'}</p>
                    </div>
                    <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${task.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      <span className={`size-1.5 rounded-full ${task.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} /> {task.completed ? 'Completed' : 'In progress'}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button className={`${buttonClass} min-h-9 px-3 py-2`} disabled={busy} aria-label={`${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}
                      onClick={() => mutate('Update completion', (signal) => patchTask(task.id, { completed: !task.completed }, { signal }), task.id)}><ConsoleIcon name={task.completed ? 'close' : 'check'} className="size-3.5" /> {task.completed ? 'Mark incomplete' : 'Mark complete'}</button>
                  </div>
                </li>)}
              </ul>
            </section>
            {panel && <section aria-label="Task workspace" className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)] sm:p-5">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Task workspace</p><p className="mt-1 text-xs text-slate-500">Review or update task details</p></div>
                <span className="grid size-9 place-items-center rounded-xl bg-[#f1f4ff] text-[#5e72d2]"><ConsoleIcon name="tasks" className="size-4" /></span>
              </div>
              {panel.kind === 'create' ? <>
                <h3 className="mb-4 text-lg font-bold tracking-tight">New task</h3>
                <TaskForm busy={busy} onCancel={closePanel} onSave={(values) => mutate('Create task', (signal) => createTask(values, { signal }))} />
              </> : <>
                {detailLoading && <p role="status">Loading task details…</p>}
                {!detailLoading && !detail && <button className={buttonClass} disabled={busy} onClick={() => setRevision((value) => value + 1)}>Retry task details</button>}
                {detail && (editing ? <>
                  <h3 className="mb-4 text-lg font-bold tracking-tight">Edit task</h3>
                  <TaskForm key={detail.id} task={detail} busy={busy} onCancel={() => setEditing(false)}
                    onSave={(values) => mutate('Save task', (signal) => replaceTask(detail.id, values, { signal }), detail.id)} />
                </> : <>
                  <h3 ref={detailHeading} tabIndex={-1} className="break-words text-lg font-bold tracking-tight focus:outline-2 focus:outline-offset-2 focus:outline-[#335de8]">{detail.title}</h3>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{detail.description || 'No description'}</p>
                  <dl className="my-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl bg-[#f8f9fc] p-3 text-xs">
                    <dt>ID</dt><dd className="break-all">{detail.id}</dd>
                    <dt>Status</dt><dd>{detail.completed ? 'Completed' : 'Incomplete'}</dd>
                    <dt>Created</dt><dd>{formatDate(detail.created_at)}</dd>
                    <dt>Updated</dt><dd>{formatDate(detail.updated_at)}</dd>
                  </dl>
                  {confirmDelete ? <div role="group" aria-label="Confirm deletion" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
                    <p>Delete this task? This cannot be undone.</p>
                    <div className="flex flex-wrap gap-2"><button autoFocus className={buttonClass} disabled={busy}
                      onClick={() => mutate('Delete task', (signal) => deleteTask(detail.id, { signal }), detail.id)}>Confirm delete</button>
                      <button className={buttonClass} disabled={busy} onClick={() => setConfirmDelete(false)}>Keep task</button></div>
                  </div> : <div className="flex flex-wrap gap-2">
                    <button className={primaryButtonClass} disabled={busy} onClick={() => setEditing(true)}>Edit task</button>
                    <button className={dangerButtonClass} disabled={busy} onClick={() => setConfirmDelete(true)}>Delete task</button>
                  </div>}
                </>)}
                <button className={`${buttonClass} mt-4`} disabled={busy} onClick={closePanel}>Close details</button>
              </>}
            </section>}
          </div>
        </>}
      </div>
    </main>
  );
}
