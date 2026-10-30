import { useState } from 'react';
import { validateTask } from './taskValidation.js';

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10';
export const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#335de8] disabled:cursor-not-allowed disabled:opacity-50';
export const primaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#3c59db] px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(60,89,219,0.85)] hover:bg-[#304bc5] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8] disabled:cursor-not-allowed disabled:opacity-50';
export const dangerButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-red-700 hover:border-red-300 hover:bg-red-50 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50';

export default function TaskForm({ task, busy, onSave, onCancel }) {
  const [values, setValues] = useState({ title: task?.title ?? '', description: task?.description ?? '', completed: task?.completed ?? false });
  const [errors, setErrors] = useState({});
  const update = (key, value) => setValues((previous) => ({ ...previous, [key]: value }));

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateTask(values);
    setErrors(nextErrors);
    if (!busy && Object.keys(nextErrors).length === 0) onSave(values);
  }

  return (
    <form onSubmit={submit} noValidate aria-label={task ? 'Edit task' : 'Create task'} aria-busy={busy} className="space-y-5">
      <div>
        <label htmlFor="task-title" className="block text-xs font-semibold text-slate-700">Title</label>
        <input id="task-title" autoFocus required value={values.title} disabled={busy}
          onChange={(event) => update('title', event.target.value)} className={fieldClass}
          aria-invalid={Boolean(errors.title)} aria-describedby="title-help title-error" />
        <p id="title-help" className="mt-1.5 text-[11px] text-slate-500">{Array.from(values.title).length}/120 characters</p>
        <p id="title-error" role={errors.title ? 'alert' : undefined} className="mt-1 text-xs text-red-800">{errors.title}</p>
      </div>
      <div>
        <label htmlFor="task-description" className="block text-xs font-semibold text-slate-700">Description</label>
        <textarea id="task-description" rows={4} value={values.description} disabled={busy}
          onChange={(event) => update('description', event.target.value)} className={fieldClass}
          aria-invalid={Boolean(errors.description)} aria-describedby="description-help description-error" />
        <p id="description-help" className="mt-1.5 text-[11px] text-slate-500">{Array.from(values.description).length}/2,000 characters</p>
        <p id="description-error" role={errors.description ? 'alert' : undefined} className="mt-1 text-xs text-red-800">{errors.description}</p>
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-700">
        <input type="checkbox" checked={values.completed} disabled={busy}
          onChange={(event) => update('completed', event.target.checked)} className="size-4 accent-[#3c59db]" />
        Completed
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? 'Saving task…' : task ? 'Save full edit' : 'Create task'}</button>
        <button type="button" onClick={onCancel} disabled={busy} className={buttonClass}>Cancel</button>
      </div>
    </form>
  );
}
