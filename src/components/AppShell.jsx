import ConsoleIcon from './ConsoleIcon.jsx';

const sections = [
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'calculator', label: 'Calculator', icon: 'calculator' },
  { id: 'echo', label: 'Text echo', icon: 'echo' },
  { id: 'streaming', label: 'Streaming echo', icon: 'streaming' },
];

export default function AppShell({ view, onNavigate, onLogout, children }) {
  return (
    <div className="min-h-screen bg-[#f3f5f9] text-[#172337] lg:flex">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="relative z-20 bg-[#101b2c] text-white shadow-[0_18px_50px_-32px_rgba(4,12,25,0.75)] lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[264px] lg:flex-col lg:shadow-none">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 lg:block lg:px-5 lg:pb-0 lg:pt-7">
          <a className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9bdccf]" href="#main-content">
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#7ce0c2] via-[#51b9c8] to-[#5874f4] text-sm font-black tracking-[-0.08em] text-[#0d1b2d] shadow-[0_8px_24px_-10px_rgba(84,200,195,0.9)]">
              ID<span aria-hidden="true" className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-[#101b2c] bg-white/70" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold tracking-[0.02em]">IDICorp</span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-400">Service console</span>
            </span>
          </a>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-300 sm:inline-flex lg:hidden">Workspace</span>
        </div>

        <div className="hidden px-5 pt-9 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 lg:block">Workspace</div>
        <nav aria-label="Service sections" className="flex gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
          {sections.map((section) => {
            const selected = section.id === view;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => onNavigate(section.id)}
                className={`group relative inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-semibold transition duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9bdccf] lg:w-full lg:px-3.5 ${selected ? 'bg-white/[0.11] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-slate-400 hover:bg-white/[0.055] hover:text-slate-100'}`}
              >
                {selected && <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#7ce0c2]" />}
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${selected ? 'bg-[#7ce0c2]/15 text-[#8be3cc]' : 'bg-white/[0.045] text-slate-500 group-hover:text-slate-200'}`}>
                  <ConsoleIcon name={section.icon} className="size-[17px]" />
                </span>
                <span>{section.label}</span>
                {selected && <span className="ml-auto hidden size-1.5 rounded-full bg-[#7ce0c2] lg:block" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-col gap-3 border-t border-white/10 p-3 sm:px-5 lg:mt-auto lg:border-0 lg:p-4">
          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.075] to-white/[0.025] p-4 lg:block">
            <div className="flex items-center justify-between">
              <span className="grid size-8 place-items-center rounded-lg bg-[#7ce0c2]/10 text-[#8be3cc]"><ConsoleIcon name="grid" className="size-4" /></span>
              <span className="text-[10px] font-semibold tracking-[0.1em] text-slate-500">01 — 04</span>
            </div>
            <p className="mt-4 text-sm font-semibold text-white">One focused workspace</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Move between your service tools without losing context.</p>
          </div>
          <p className="hidden px-1 pb-1 pt-2 text-[10px] font-medium tracking-[0.12em] text-slate-600 lg:block">IDICORP · SERVICE OPERATIONS</p>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3.5 text-[13px] font-semibold text-slate-200 transition hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9bdccf] lg:justify-start"
          >
            <ConsoleIcon name="logout" className="size-4 text-slate-400" />
            Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-[264px]">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-8">
          {children}
        </div>
        <footer className="mx-auto w-full max-w-[1600px] px-4 pb-6 text-[11px] font-medium text-slate-400 sm:px-7 lg:px-10">
          IDICorp Service Console <span className="px-1.5 text-slate-300">·</span> A focused workspace for service operations
        </footer>
      </div>
    </div>
  );
}
