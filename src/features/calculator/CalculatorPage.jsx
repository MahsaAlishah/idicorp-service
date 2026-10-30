import { useEffect, useRef, useState } from 'react';
import { openCalculatorSocket, validateCalculatorRequest } from './calculatorSocket.js';
import ConsoleIcon from '../../components/ConsoleIcon.jsx';

function parseNumbers(value) {
  const parts = value.trim().split(/[\s,]+/).filter(Boolean);
  return parts.map((part) => Number(part));
}

export default function CalculatorPage({ accessToken, onSignInRequired }) {
  const [state, setState] = useState('connecting');
  const [retry, setRetry] = useState(0);
  const [operation, setOperation] = useState('add');
  const [numbersText, setNumbersText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const session = useRef(null);
  const inputRevision = useRef(0);
  const submittedRevision = useRef(null);

  useEffect(() => {
    setResult(null);
    setPending(false);
    setError('');
    submittedRevision.current = null;
    try {
      session.current = openCalculatorSocket({
        token: accessToken,
        onState: setState,
        onResult: (value) => {
          if (submittedRevision.current === inputRevision.current) setResult(value);
          setPending(false);
          submittedRevision.current = null;
        },
        onError: (message) => { setError(message); setPending(false); submittedRevision.current = null; },
      });
    } catch (failure) {
      setState('disconnected');
      setError(failure.message);
    }
    return () => { session.current?.close(); session.current = null; };
  }, [accessToken, retry]);

  function submit(event) {
    event.preventDefault();
    setResult(null);
    try {
      if (!numbersText.trim()) throw new Error('Enter at least one number.');
      const request = validateCalculatorRequest({ operation, numbers: parseNumbers(numbersText) });
      session.current.sendRequest(request);
      submittedRevision.current = inputRevision.current;
      setPending(true);
      setError('');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="text-[#172337] focus:outline-none">
      <div className="mx-auto max-w-[1120px]">
        <header className="border-b border-slate-200 pb-6 sm:pb-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6374ca]">Workspace / Live tools</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-[38px]">Calculator</h1></div>
        </header>
        <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_32px_-25px_rgba(28,43,76,0.35)] sm:flex-row sm:items-center sm:px-5">
          <div className="flex items-center gap-3"><span className={`relative grid size-10 place-items-center rounded-xl ${state === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f0f3ff] text-[#5d72d2]'}`}><ConsoleIcon name="calculator" className="size-4.5" /><span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-white ${state === 'ready' ? 'bg-emerald-500' : state === 'disconnected' || state === 'unauthorized' ? 'bg-red-400' : 'animate-pulse bg-amber-400'}`} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Connection</p><p role="status" className="mt-0.5 text-sm font-semibold capitalize text-[#283850]">Connection: {state}</p></div></div>
          <div className="flex flex-wrap gap-2">
            {state === 'unauthorized' && <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3c59db] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#304bc5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]" onClick={onSignInRequired}>Sign in again</button>}
            {state === 'disconnected' && <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#3c59db] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#304bc5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]" onClick={() => { setError(''); setRetry((value) => value + 1); }}><ConsoleIcon name="refresh" className="size-3.5" /> Reconnect</button>}
          </div>
        </div>
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)] sm:p-6">
            <div className="mb-1"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Input</p><h2 className="mt-1 text-lg font-bold tracking-tight">Configure calculation</h2></div>
            <div>
              <label htmlFor="calculator-operation" className="block text-[11px] font-bold text-slate-700">Operation</label>
              <select id="calculator-operation" value={operation} onChange={(event) => { setOperation(event.target.value); inputRevision.current += 1; setResult(null); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-[#fbfcfe] px-3.5 text-sm outline-none transition hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10">
                <option value="add">Add</option><option value="subtract">Subtract</option>
                <option value="multiply">Multiply</option><option value="divide">Divide</option>
              </select>
            </div>
            <div>
              <label htmlFor="calculator-numbers" className="block text-[11px] font-bold text-slate-700">Numbers <span className="font-medium text-slate-400">(comma or space separated)</span></label>
              <textarea id="calculator-numbers" value={numbersText} onChange={(event) => { setNumbersText(event.target.value); inputRevision.current += 1; setResult(null); }} rows={4} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-[#fbfcfe] px-3.5 py-3 font-mono text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10" placeholder="10, 20" />
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Enter finite values separated by commas or spaces. Up to 100 numbers are supported.</p>
            </div>
            <button type="submit" disabled={state !== 'ready' || pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3c59db] px-4 py-3 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(60,89,219,0.85)] transition hover:bg-[#304bc5] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]"><ConsoleIcon name="calculator" className="size-4" /> Calculate</button>
          </form>
          <section aria-label="Calculation result" className="min-h-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Output</p><h2 className="mt-1 text-sm font-bold text-[#223149]">Result</h2></div><span className="grid size-9 place-items-center rounded-xl bg-[#f0f3ff] text-[#5a6fd1]"><ConsoleIcon name="grid" className="size-4" /></span></div>
            <div className="p-4 sm:p-5">
              {pending && <p role="status" className="flex items-center gap-2 rounded-xl bg-[#f4f6ff] px-3.5 py-3 text-xs font-semibold text-[#4e62c3]"><span className="size-2 animate-pulse rounded-full bg-[#5368cf]" /> Calculating...</p>}
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-6 text-red-800">{error}</p>}
              {result !== null && <div role="status" className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Calculation complete</p><p className="mt-2 break-all font-mono text-3xl font-semibold tracking-tight text-emerald-900">Result: {result}</p></div>}
              {!pending && !error && result === null && <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#fbfcfe] px-5 text-center"><span className="grid size-11 place-items-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><ConsoleIcon name="calculator" className="size-5" /></span><p className="mt-3 text-xs font-semibold text-slate-600">Your result will appear here</p><p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-400">The calculation starts when the secure connection is ready.</p></div>}
              <p className="mt-4 border-t border-slate-100 pt-4 text-[10px] leading-5 text-slate-400">Each result belongs to the current authenticated session.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
