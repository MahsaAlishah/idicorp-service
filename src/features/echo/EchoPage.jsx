import { useEffect, useRef, useState } from 'react';
import { openEchoSocket } from './echoSocket.js';
import ConsoleIcon from '../../components/ConsoleIcon.jsx';

export default function EchoPage({ accessToken, connect = openEchoSocket }) {
  const [state, setState] = useState('disconnected');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const connection = useRef(null);
  const nextId = useRef(0);

  useEffect(() => {
    setState('disconnected'); setMessages([]); setDraft(''); setError('');
    return () => { connection.current?.close(); connection.current = null; };
  }, [accessToken]);

  function start() {
    connection.current?.close();
    connection.current = null;
    setMessages([]);
    setError('');
    try {
      connection.current = connect({
        token: accessToken,
        onState: setState,
        onReceived: (text) => setMessages((items) => [...items, { id: nextId.current++, kind: 'Received', text }]),
        onError: setError,
      });
    } catch {
      setState('disconnected');
      setError('Unable to open text echo. Try again.');
    }
  }

  function disconnect() {
    connection.current?.close(); connection.current = null;
    setState('disconnected'); setError('');
  }

  function send(event) {
    event.preventDefault();
    if (draft.length === 0) {
      setError('Enter a message to echo.');
      return;
    }
    try {
      connection.current.sendText(draft);
      setMessages((items) => [...items, { id: nextId.current++, kind: 'Sent', text: draft }]);
      setDraft('');
      setError('');
    } catch {
      setError('Could not send the message. Reconnect and try again.');
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="text-[#172337] focus:outline-none">
      <div className="mx-auto max-w-[1120px]">
        <header className="border-b border-slate-200 pb-6 sm:pb-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6374ca]">Workspace / Live tools</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-[38px]">Text echo</h1></div>
        </header>
        <section aria-label="Echo connection" className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_32px_-25px_rgba(28,43,76,0.35)] sm:flex-row sm:items-center sm:px-5">
          <div className="flex items-center gap-3"><span className={`relative grid size-10 place-items-center rounded-xl ${state === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f0f3ff] text-[#5d72d2]'}`}><ConsoleIcon name="echo" className="size-4.5" /><span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-white ${state === 'ready' ? 'bg-emerald-500' : state === 'disconnected' ? 'bg-slate-300' : 'animate-pulse bg-amber-400'}`} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Connection</p><p role="status" className="mt-0.5 text-sm font-semibold capitalize text-[#283850]">Connection: {state}</p></div></div>
          <button type="button" className={`${state === 'disconnected' ? 'bg-[#3c59db] text-white shadow-[0_10px_24px_-14px_rgba(60,89,219,0.85)] hover:bg-[#304bc5]' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]`} onClick={state === 'disconnected' ? start : disconnect}><ConsoleIcon name={state === 'disconnected' ? 'refresh' : 'close'} className="size-3.5" />{state === 'disconnected' ? 'Connect' : 'Disconnect'}</button>
        </section>
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)]">
          <section aria-label="Send a message" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)] sm:p-5">
            <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Compose</p><h2 className="mt-1 text-lg font-bold tracking-tight">Send a message</h2><p className="mt-1 text-xs leading-5 text-slate-500">Connect first, then send any text to receive it back.</p></div>
            <form onSubmit={send} className="space-y-4">
              <div><label htmlFor="echo-message" className="block text-[11px] font-bold text-slate-700">Message</label>
              <textarea id="echo-message" value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} placeholder="Write a message..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-[#fbfcfe] px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10" /></div>
              <button type="submit" disabled={state !== 'ready'} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3c59db] px-4 py-3 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(60,89,219,0.85)] transition hover:bg-[#304bc5] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8]"><ConsoleIcon name="arrow" className="size-4" /> Send</button>
              <p className="text-center text-[10px] leading-5 text-slate-400">The composer becomes available when the server is ready.</p>
            </form>
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800">{error}</p>}
          </section>
          <section aria-label="Echo messages" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_36px_-28px_rgba(25,42,74,0.38)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6073d5]">Live transcript</p><h2 className="mt-1 text-sm font-bold text-[#223149]">Messages</h2></div><span className="rounded-full bg-[#f2f4fa] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{messages.length} messages</span></div>
            {messages.length === 0 && <div className="px-5 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4ff] text-[#5e72d2]"><ConsoleIcon name="echo" className="size-5" /></span><p className="mt-4 text-sm font-semibold text-[#25344b]">No messages in this connection.</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">Your sent messages and server replies will appear here during this connection.</p></div>}
            <ol className="max-h-[560px] space-y-3 overflow-y-auto p-4 sm:p-5" aria-live="polite">
              {messages.map((item) => <li key={item.id} className={`flex min-w-0 ${item.kind === 'Sent' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] min-w-0 rounded-2xl px-3.5 py-3 sm:max-w-[82%] ${item.kind === 'Sent' ? 'rounded-br-md bg-[#edf1ff] text-[#26365d]' : 'rounded-bl-md border border-slate-200 bg-[#fafbfe] text-[#29384d]'}`}><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">{item.kind}:</span>{' '}<span className="whitespace-pre-wrap break-words text-sm leading-6">{item.text}</span></div></li>)}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
