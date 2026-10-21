// Icônes au trait, reprises du prototype et de la maquette Figma.
const PATHS = {
  home: <path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="15" r="1.6" fill="currentColor" /></>,
  table: <path d="M4 20.5V12h5v8.5M9.5 20.5V5h5v15.5M15 20.5v-6h5v6M3 20.5h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />,
  player: <><circle cx="12" cy="8" r="3.8" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  more: <><circle cx="5.5" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="18.5" cy="12" r="2" fill="currentColor" /></>,
  search: <><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>,
  left: <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  right: <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  down: <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
  shield: <path d="M12 3.5 19 6v6c0 4.3-3 7.4-7 8.5-4-1.1-7-4.2-7-8.5V6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  cross: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 8v4.5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  info: <><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 11v5.5M12 7.6v.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;
}

/** Marque SearchL1 : loupe dont le verre est un ballon. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="logo-mark">
      <rect width="120" height="120" rx="27" fill="var(--logo-bg)" />
      <path d="M76 76 L97 97" stroke="var(--logo-ring)" strokeWidth="13" strokeLinecap="round" />
      <circle cx="52" cy="52" r="31" fill="none" stroke="var(--logo-ring)" strokeWidth="7" />
      <circle cx="52" cy="52" r="23" fill="var(--logo-ball)" />
      <path d="M52 43 L60.56 49.22 L57.29 59.28 L46.71 59.28 L43.44 49.22 Z" fill="var(--logo-ink)" />
      <path d="M52 43 V29 M60.56 49.22 L73.9 44.9 M57.29 59.28 L65.5 70.6 M46.71 59.28 L38.5 70.6 M43.44 49.22 L30.1 44.9" stroke="var(--logo-ink)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
