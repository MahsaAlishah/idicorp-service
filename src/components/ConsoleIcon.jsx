const iconPaths = {
  tasks: <><rect x="4" y="4" width="16" height="17" rx="3" /><path d="M9 4.5v-1h6v1M8 10h8M8 14h8M8 18h4" /></>,
  calculator: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" strokeWidth="2.5" /></>,
  echo: <><path d="M20.5 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.1A7.5 7.5 0 1 1 20.5 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="3" /></>,
  streaming: <><path d="M4 9v6M8 6v12M12 3v18M16 6v12M20 9v6" strokeLinecap="round" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  search: <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" strokeLinecap="round" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.8 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.2-3" strokeLinecap="round" strokeLinejoin="round" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" /></>,
  check: <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" strokeLinecap="round" strokeLinejoin="round" /></>,
  arrow: <><path d="M7 17 17 7M8 7h9v9" strokeLinecap="round" strokeLinejoin="round" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" strokeLinejoin="round" /><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>,
};

export default function ConsoleIcon({ name, className = 'size-5' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {iconPaths[name] || iconPaths.grid}
    </svg>
  );
}
