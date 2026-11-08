import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createHashRouter, NavLink, Outlet, RouterProvider, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, type IconName } from './components/Icon.tsx';
import { SearchSheet } from './components/SearchSheet.tsx';
import { DataProvider, useData, useFreshness } from './lib/data.tsx';
import { slot } from './lib/schedule.ts';
import { useTheme, type Theme } from './lib/theme.ts';
import { UiCtx } from './lib/ui-context.ts';
import { Bareme } from './pages/Bareme.tsx';
import { ClubPage } from './pages/ClubPage.tsx';
import { Home } from './pages/Home.tsx';
import { Injuries } from './pages/Injuries.tsx';
import { MatchPage } from './pages/MatchPage.tsx';
import { Matches } from './pages/Matches.tsx';
import { PlayerPage } from './pages/PlayerPage.tsx';
import { Players } from './pages/Players.tsx';
import { History } from './pages/History.tsx';
import { Compare } from './pages/Compare.tsx';
import { Soon } from './pages/Soon.tsx';
import { Standings } from './pages/Standings.tsx';
import { Teams } from './pages/Teams.tsx';

const TABS: { to: string; label: string; icon: IconName; match: RegExp }[] = [
  { to: '/', label: 'Accueil', icon: 'home', match: /^\/$/ },
  { to: '/matchs', label: 'Matchs', icon: 'calendar', match: /^\/match/ },
  { to: '/classement', label: 'Classement', icon: 'table', match: /^\/classement/ },
  { to: '/joueurs', label: 'Joueurs', icon: 'player', match: /^\/joueur/ },
  { to: '/infirmerie', label: 'Infirmerie', icon: 'cross', match: /^\/infirmerie/ },
];
const MORE: { to: string; label: string; note: string; icon: IconName; soon?: boolean }[] = [
  { to: '/equipes', label: 'Équipes', note: '18 fiches club', icon: 'shield' },
  { to: '/comparer', label: 'Comparer deux joueurs', note: 'stats côte à côte, points par journée', icon: 'player' },
  { to: '/historique', label: 'Historique', note: 'classements depuis 2014-15', icon: 'history' },
  { to: '/bareme', label: 'Calcul des points', note: 'barème du jeu', icon: 'info' },
];

/**
 * Barre d'onglets réduite (icônes seules) quand on fait défiler vers le bas, pleine dès qu'on remonte :
 * le comportement des barres d'onglets iOS 26, qui laisse la place au contenu.
 */
function useCompactDock() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY, dy = y - last;
      if (Math.abs(dy) < 6) return;
      setCompact(dy > 0 && y > 160);
      last = y;
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return compact;
}

/** Glissement depuis le bord gauche = retour (en mode app plein écran, iOS ne le fait pas tout seul). */
function useEdgeSwipeBack() {
  const navigate = useNavigate();
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    // Pas depuis la barre d'onglets : y glisser sert à changer d'onglet.
    const down = (e: TouchEvent) => { const t = e.touches[0]; start = t.clientX < 24 && !(e.target as Element).closest?.('.tabbar') ? { x: t.clientX, y: t.clientY } : null; };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      if (t.clientX - start.x > 80 && Math.abs(t.clientY - start.y) < 60 && window.history.state?.idx > 0) navigate(-1);
      start = null;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchend', up); };
  }, [navigate]);
}

function Freshness() {
  const d = useData();
  const { refreshing, refresh } = useFreshness();
  const at = new Date(d.meta.updatedAt);
  const next = new Date(slot(Date.now(), true));
  const f = (x: Date) => x.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  return (
    <button className="row link" onClick={refresh} disabled={refreshing}>
      <Icon name="history" />
      <span className="grow">{refreshing ? 'Actualisation…' : 'Actualiser les données'}
        <small className="muted block">Données du {f(at)}{d.meta.warnings.length ? ' (scores seulement)' : ''} · prochaine mise à jour {f(next)}</small></span>
    </button>
  );
}

const THEMES: [Theme, string][] = [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']];

/** Choix du thème : automatique (suit l'iPhone), clair ou sombre. */
function ThemePicker() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="row theme-row">
      <span className="grow">Affichage<small className="muted block">{theme === 'auto' ? "suit le réglage de l'iPhone" : theme === 'dark' ? 'toujours sombre' : 'toujours clair'}</small></span>
      <div className="seg" role="radiogroup" aria-label="Thème">
        {THEMES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={theme === k} aria-selected={theme === k} onClick={() => setTheme(k)}>{l}</button>)}
      </div>
    </div>
  );
}

function Layout() {
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEdgeSwipeBack();
  const compact = useCompactDock() && !more;
  useTheme(); // couleur de la barre d'état dès l'ouverture, pour un thème forcé
  useEffect(() => {
    if (!more) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [more]);
  // Fermer les feuilles quand on change de page.
  const [path, setPath] = useState(loc.pathname + loc.search);
  if (path !== loc.pathname + loc.search) { setPath(loc.pathname + loc.search); setMore(false); setSearch(false); }

  // Onglet de la page (aucun sur les pages du menu : équipes, fiches club, historique, barème).
  const active = TABS.findIndex(t => t.match.test(loc.pathname));
  const navigate = useNavigate();
  const bar = useRef<HTMLElement>(null);
  // Glisser le doigt sur la barre : la pastille suit le doigt, on ouvre l'onglet où on le lève.
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const shown = hover ?? active;
  const tabAt = (x: number) => {
    const els = [...(bar.current?.querySelectorAll<HTMLElement>('.tb') ?? [])];
    const dist = els.map(el => { const r = el.getBoundingClientRect(); return x < r.left ? r.left - x : x > r.right ? x - r.right : 0; });
    return dist.indexOf(Math.min(...dist));
  };
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, moved: false }; };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    if (!g.moved && Math.abs(e.clientX - g.x) > 8) { g.moved = true; bar.current?.setPointerCapture(e.pointerId); }
    if (g.moved) setHover(tabAt(e.clientX));
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g?.moved) return;
    // Le « clic » qui suit la fin du glissement ne doit pas ouvrir l'onglet de départ.
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    if (hover != null && hover !== active) navigate(TABS[hover].to);
    setHover(null);
  };
  // Onglets de largeurs différentes (« Classement » est plus long qu'« Accueil ») : la pastille suit l'onglet.
  useLayoutEffect(() => {
    const place = () => {
      const el = shown >= 0 ? bar.current?.querySelectorAll<HTMLElement>('.tb')[shown] : undefined;
      bar.current?.style.setProperty('--lo', el ? '1' : '0');
      if (el) { bar.current!.style.setProperty('--lx', `${el.offsetLeft}px`); bar.current!.style.setProperty('--lw', `${el.offsetWidth}px`); }
    };
    place();
    // La barre se réduit en défilant (transition de 0,3 s) : on replace la pastille à la fin.
    const t = setTimeout(place, 320);
    window.addEventListener('resize', place);
    return () => { clearTimeout(t); window.removeEventListener('resize', place); };
  }, [shown, compact]);

  return (
    <UiCtx.Provider value={{ openSearch: () => setSearch(true), openMore: () => setMore(true) }}>
      <header className="topbar">
        <div className="wrap topbar-in">
          <NavLink to="/" className="brand" aria-label="SearchL1, accueil"><Logo size={30} /><span>Search<b>L1</b></span></NavLink>
          <nav className="toptabs" aria-label="Sections">
            {TABS.map(t => <NavLink key={t.to} to={t.to} end={t.to === '/'}>{t.label}</NavLink>)}
            {MORE.filter(m => !m.soon).map(m => <NavLink key={m.to} to={m.to}>{m.label}</NavLink>)}
          </nav>
          <button className="glass-btn" onClick={() => setSearch(true)} aria-label="Rechercher"><Icon name="search" size={20} /></button>
        </div>
      </header>
      <main className="wrap main"><Outlet /></main>

      <div className={`dock${compact ? ' compact' : ''}`}>
        <nav ref={bar} className={`tabbar glass${hover != null ? ' dragging' : ''}`} aria-label="Navigation"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setHover(null); }}
          onClickCapture={e => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }}>
          <span className="tab-lens" aria-hidden="true" />
          {TABS.map((t, i) => (
            <NavLink key={t.to} to={t.to} draggable={false} className={() => `tb${shown === i ? ' active' : ''}`} aria-current={active === i ? 'page' : undefined}>
              <Icon name={t.icon} /><span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {more && (
        // Menu déroulé sous le bouton « ··· » de la barre du haut.
        <div className="menu-backdrop" onClick={() => setMore(false)}>
          <div className="menu-pop glass" role="dialog" aria-label="Plus de rubriques" onClick={e => e.stopPropagation()}>
            <div className="group">
              {MORE.map(m => (
                <NavLink key={m.to} to={m.to} className="row link">
                  <Icon name={m.icon} /><span className="grow">{m.label}<small className="muted block">{m.note}</small></span>
                </NavLink>
              ))}
            </div>
            <div className="group"><ThemePicker /></div>
            <div className="group"><Freshness /></div>
          </div>
        </div>
      )}
      {search && <SearchSheet onClose={() => setSearch(false)} />}
      <ScrollRestoration />
    </UiCtx.Provider>
  );
}

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/matchs', element: <Matches /> },
      { path: '/match/:id', element: <MatchPage /> },
      { path: '/classement', element: <Standings /> },
      { path: '/joueurs', element: <Players /> },
      { path: '/joueur/:id', element: <PlayerPage /> },
      { path: '/equipes', element: <Teams /> },
      { path: '/club/:name', element: <ClubPage /> },
      { path: '/bareme', element: <Bareme /> },
      { path: '/infirmerie', element: <Injuries /> },
      { path: '/historique', element: <History /> },
      { path: '/comparer', element: <Compare /> },
      { path: '*', element: <Soon title="Page introuvable" what="Cette page n'existe pas" /> },
    ],
  },
]);

export default function App() {
  return <DataProvider><RouterProvider router={router} /></DataProvider>;
}
