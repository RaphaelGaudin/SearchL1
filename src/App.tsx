import { useEffect, useState } from 'react';
import { createHashRouter, NavLink, Outlet, RouterProvider, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, type IconName } from './components/Icon.tsx';
import { SearchSheet } from './components/SearchSheet.tsx';
import { DataProvider, useData, useFreshness } from './lib/data.tsx';
import { slot } from './lib/schedule.ts';
import { UiCtx } from './lib/ui-context.ts';
import { Bareme } from './pages/Bareme.tsx';
import { ClubPage } from './pages/ClubPage.tsx';
import { Home } from './pages/Home.tsx';
import { Injuries } from './pages/Injuries.tsx';
import { MatchPage } from './pages/MatchPage.tsx';
import { Matches } from './pages/Matches.tsx';
import { PlayerPage } from './pages/PlayerPage.tsx';
import { Players } from './pages/Players.tsx';
import { Soon } from './pages/Soon.tsx';
import { Standings } from './pages/Standings.tsx';
import { Teams } from './pages/Teams.tsx';

const TABS: { to: string; label: string; icon: IconName; match: RegExp }[] = [
  { to: '/', label: 'Accueil', icon: 'home', match: /^\/$/ },
  { to: '/matchs', label: 'Matchs', icon: 'calendar', match: /^\/match/ },
  { to: '/classement', label: 'Classement', icon: 'table', match: /^\/classement/ },
  { to: '/joueurs', label: 'Joueurs', icon: 'player', match: /^\/joueur/ },
];
const MORE: { to: string; label: string; note: string; icon: IconName; soon?: boolean }[] = [
  { to: '/equipes', label: 'Équipes', note: '18 fiches club', icon: 'shield' },
  { to: '/infirmerie', label: 'Infirmerie', note: 'blessés, suspendus, incertains', icon: 'cross' },
  { to: '/historique', label: 'Historique', note: 'bientôt', icon: 'history', soon: true },
  { to: '/bareme', label: 'Calcul des points', note: 'barème du jeu', icon: 'info' },
];
const MORE_PATHS = /^\/(equipes|club|infirmerie|historique|bareme)/;

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
    const down = (e: TouchEvent) => { const t = e.touches[0]; start = t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null; };
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

function Layout() {
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEdgeSwipeBack();
  const compact = useCompactDock() && !more;
  // Fermer les feuilles quand on change de page.
  const [path, setPath] = useState(loc.pathname + loc.search);
  if (path !== loc.pathname + loc.search) { setPath(loc.pathname + loc.search); setMore(false); setSearch(false); }

  const active = MORE_PATHS.test(loc.pathname) || more ? 4 : Math.max(0, TABS.findIndex(t => t.match.test(loc.pathname)));

  return (
    <UiCtx.Provider value={{ openSearch: () => setSearch(true) }}>
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
        <nav className="tabbar glass" aria-label="Navigation" style={{ '--active': active } as React.CSSProperties}>
          <span className="tab-lens" aria-hidden="true" />
          {TABS.map((t, i) => (
            <NavLink key={t.to} to={t.to} className={`tb${active === i ? ' active' : ''}`} aria-current={active === i ? 'page' : undefined}>
              <Icon name={t.icon} /><span>{t.label}</span>
            </NavLink>
          ))}
          <button className={`tb${active === 4 ? ' active' : ''}`} onClick={() => setMore(v => !v)} aria-expanded={more}>
            <Icon name="more" /><span>Plus</span>
          </button>
        </nav>
        <button className="search-orb glass" onClick={() => setSearch(true)} aria-label="Rechercher"><Icon name="search" size={22} /></button>
      </div>

      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet glass" role="dialog" aria-label="Plus de rubriques" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div className="group">
              {MORE.map(m => (
                <NavLink key={m.to} to={m.to} className="row link">
                  <Icon name={m.icon} /><span className="grow">{m.label}<small className="muted block">{m.note}</small></span>
                </NavLink>
              ))}
            </div>
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
      { path: '/historique', element: <Soon title="Historique" what="Les classements finaux depuis 2014-15 et la courbe de chaque club" /> },
      { path: '*', element: <Soon title="Page introuvable" what="Cette page n'existe pas" /> },
    ],
  },
]);

export default function App() {
  return <DataProvider><RouterProvider router={router} /></DataProvider>;
}
