import { useEffect, useRef, useState } from 'react';
import { postStreamEcho } from './streamEchoApi.js';
import ConsoleIcon from '../../components/ConsoleIcon.jsx';

export default function StreamingPage({ onSignInRequired }) {
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [receivedBytes, setReceivedBytes] = useState(0);
  const [returnedText, setReturnedText] = useState('');
  const [download, setDownload] = useState('');
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const controller = useRef(null);
  const activeRequest = useRef(0);
  const downloadUrl = useRef('');
  const busy = phase === 'sending' || phase === 'receiving';

  useEffect(() => () => {
    activeRequest.current += 1;
    controller.current?.abort();
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
  }, []);

  function clearOutput() {
    setPhase('idle');
    setReturnedText('');
    setReceivedBytes(0);
    setDownload('');
    setError('');
    setAuthError(false);
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    downloadUrl.current = '';
  }

  function cancelStream() {
    if (!controller.current) return;
    const pendingController = controller.current;
    activeRequest.current += 1;
    controller.current = null;
    pendingController.abort();
    clearOutput();
    setPhase('cancelled');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    clearOutput();
    if (mode === 'text' && text.length === 0) { setError('Enter text to echo.'); return; }
    if (mode === 'file' && !file) { setError('Choose a file to echo.'); return; }

    const requestId = ++activeRequest.current;
    const requestController = new AbortController();
    controller.current = requestController;
    setPhase('sending');
    try {
      const bytes = mode === 'text' ? new TextEncoder().encode(text) : new Uint8Array(await file.arrayBuffer());
      if (requestId !== activeRequest.current) return;
      const result = await postStreamEcho(bytes, {
        contentType: mode === 'text' ? 'text/plain;charset=UTF-8' : (file.type || undefined),
        signal: requestController.signal,
        onProgress: (count) => {
          if (requestId === activeRequest.current) { setPhase('receiving'); setReceivedBytes(count); }
        },
        onTextChunk: (chunk) => {
          if (requestId === activeRequest.current) setReturnedText((value) => value + chunk);
        },
      });
      if (requestId !== activeRequest.current) return;
      if (result.blob) {
        downloadUrl.current = URL.createObjectURL(result.blob);
        setDownload(downloadUrl.current);
      }
      setPhase('done');
    } catch (failure) {
      if (requestId !== activeRequest.current || requestController.signal.aborted) return;
      setReturnedText('');
      setDownload('');
      setPhase('error');
      if (failure?.status === 401) {
        setAuthError(true);
        setError('Your session is missing or no longer valid. Sign in again.');
      } else if (failure?.name === 'StreamEchoError') {
        setError(failure.message);
      } else {
        setError('Unable to send or read the streaming echo. Check your connection and try again.');
      }
    } finally {
      if (requestId === activeRequest.current) controller.current = null;
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="text-[#172337] focus:outline-none">
      <section className="mx-auto max-w-[1120px]">
        <header className="border-b border-slate-200 pb-6 sm:pb-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6374ca]">Workspace / Data tools</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-[38px]">Streaming echo</h1></div>
        </header>
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)] sm:p-6">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Request</p><h2 className="mt-1 text-lg font-bold tracking-tight">Choose what to stream</h2><p className="mt-1 text-xs leading-5 text-slate-500">Text returns progressively; files are preserved as bytes.</p></div>
            <fieldset disabled={busy || authError}>
              <legend className="text-[11px] font-bold text-slate-700">Content type</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 text-xs font-semibold transition focus-within:ring-4 focus-within:ring-[#4b67e9]/15 ${mode === 'text' ? 'border-[#8b9bea] bg-[#f3f5ff] text-[#354cac]' : 'border-slate-200 bg-[#fbfcfe] text-slate-600 hover:bg-slate-50'}`}><input type="radio" name="stream-mode" value="text" checked={mode === 'text'} onChange={() => { setMode('text'); clearOutput(); }} className="size-4 accent-[#3c59db]" /><ConsoleIcon name="echo" className="size-4" /> Text</label>
                <label className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 text-xs font-semibold transition focus-within:ring-4 focus-within:ring-[#4b67e9]/15 ${mode === 'file' ? 'border-[#8b9bea] bg-[#f3f5ff] text-[#354cac]' : 'border-slate-200 bg-[#fbfcfe] text-slate-600 hover:bg-slate-50'}`}><input type="radio" name="stream-mode" value="file" checked={mode === 'file'} onChange={() => { setMode('file'); clearOutput(); }} className="size-4 accent-[#3c59db]" /><ConsoleIcon name="streaming" className="size-4" /> File</label>
              </div>
            </fieldset>
            {mode === 'text'
              ? <div><label htmlFor="stream-text" className="block text-[11px] font-bold text-slate-700">Text</label><textarea id="stream-text" value={text} disabled={busy || authError} onChange={(event) => { setText(event.target.value); clearOutput(); }} rows={5} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-[#fbfcfe] px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10" placeholder="Write the text to stream..." /></div>
              : <div>
                <p className="mb-2 text-[11px] font-bold text-slate-700">File</p>
                <input id="stream-file" aria-label="Choose File" type="file" disabled={busy || authError} onChange={(event) => { setFile(event.target.files?.[0] || null); clearOutput(); }} className="peer sr-only" />
                <label htmlFor="stream-file" className="group flex min-h-[88px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-[#fbfcfe] px-4 py-4 transition hover:border-[#8294e7] hover:bg-[#f4f6ff] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#335de8] peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#5a6fd1] shadow-sm ring-1 ring-slate-200 group-hover:ring-[#cbd4fa]"><ConsoleIcon name="streaming" className="size-5" /></span>
                  <span><span className="block text-xs font-bold text-[#3149b2]">Choose File</span><span className="mt-1 block text-[10px] text-slate-500">Browse from your device</span></span>
                  <ConsoleIcon name="arrow" className="ml-auto size-4 rotate-90 text-slate-400" />
                </label>
                <p aria-live="polite" className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-500"><span className="size-1.5 shrink-0 rounded-full bg-[#7a8ae0]" /><span className="break-all">{file?.name || 'No file selected'}</span></p>
              </div>}
            <div className="flex flex-wrap gap-2.5 border-t border-slate-100 pt-4">
              <button type="submit" disabled={busy || authError} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#3c59db] px-4 py-3 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(60,89,219,0.85)] transition hover:bg-[#304bc5] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]"><ConsoleIcon name="streaming" className="size-4" /> Send stream</button>
              {busy && <button type="button" onClick={cancelStream} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#335de8]"><ConsoleIcon name="close" className="size-4" /> Cancel stream</button>}
            </div>
          </form>
          <section aria-label="Stream status and output" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Stream monitor</p><h2 className="mt-1 text-sm font-bold text-[#223149]">Transfer status</h2></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${phase === 'done' ? 'bg-emerald-50 text-emerald-700' : phase === 'error' ? 'bg-red-50 text-red-700' : busy ? 'bg-[#f1f4ff] text-[#5368cf]' : 'bg-slate-100 text-slate-500'}`}>{phase}</span></div>
            <div className="p-4 sm:p-5">
              <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8f9fc] px-3.5 py-3 text-xs text-slate-600"><span>Status: {phase}; received {receivedBytes} bytes</span></p>
              {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800">{error}</p>}
              {authError && <button type="button" onClick={onSignInRequired} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#3c59db] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#304bc5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]">Sign in again</button>}
              {phase === 'done' && <section aria-label="Returned content" className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-[#fbfcfe] p-4">
                <h3 className="text-xs font-bold text-[#25344b]">Returned content</h3>
                {download ? <a href={download} download={file?.name || 'stream-echo.bin'} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#edf1ff] px-3 text-xs font-bold text-[#344bb6] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#335de8]"><ConsoleIcon name="streaming" className="size-4" /> Download returned file</a>
                  : <pre className="mt-3 max-h-[420px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs leading-5 text-slate-700 ring-1 ring-slate-200">{returnedText}</pre>}
              </section>}
              {phase === 'receiving' && returnedText && <div className="mt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Receiving preview</p><pre aria-label="Text received so far" className="max-h-[420px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#f8f9fc] p-3 font-mono text-xs leading-5 text-slate-700">{returnedText}</pre></div>}
              {!busy && phase !== 'done' && !error && <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#fbfcfe] px-5 text-center"><span className="grid size-11 place-items-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><ConsoleIcon name="streaming" className="size-5" /></span><p className="mt-3 text-xs font-semibold text-slate-600">Your stream output will appear here</p><p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-400">Start a text or file stream to watch the response arrive.</p></div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
