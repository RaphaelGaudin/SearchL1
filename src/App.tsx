import { createContext, useContext, useEffect, useState } from 'react';
import { createHashRouter, NavLink, Outlet, RouterProvider, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, type IconName } from './components/Icon.tsx';
import { SearchSheet } from './components/SearchSheet.tsx';
import { DataProvider } from './lib/data.tsx';
import { Bareme } from './pages/Bareme.tsx';
import { Home } from './pages/Home.tsx';
import { MatchPage } from './pages/MatchPage.tsx';
import { Matches } from './pages/Matches.tsx';
import { Soon } from './pages/Soon.tsx';
import { Standings } from './pages/Standings.tsx';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/matchs', label: 'Matchs', icon: 'calendar' },
  { to: '/classement', label: 'Classement', icon: 'table' },
  { to: '/joueurs', label: 'Joueurs', icon: 'player' },
];
const MORE: { to: string; label: string; note: string; icon: IconName; soon?: boolean }[] = [
  { to: '/equipes', label: 'Équipes', note: '18 fiches club', icon: 'shield', soon: true },
  { to: '/infirmerie', label: 'Infirmerie', note: 'blessés et suspendus', icon: 'cross', soon: true },
  { to: '/historique', label: 'Historique', note: 'depuis 2014', icon: 'history', soon: true },
  { to: '/bareme', label: 'Calcul des points', note: 'barème du jeu', icon: 'info' },
];

const UiCtx = createContext<{ openSearch: () => void }>({ openSearch: () => {} });
export const useUi = () => useContext(UiCtx);

/** Glissement depuis le bord gauche = retour (en mode app plein écran, iOS ne le fait pas tout seul). */
function useEdgeSwipeBack() {
  const navigate = useNavigate();
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => { const t = e.touches[0]; start = t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null; };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      if (t.clientX - start.x > 80 && Math.abs(t.clientY - start.y) < 60 && window.history.length > 1) navigate(-1);
      start = null;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchend', up); };
  }, [navigate]);
}

function Layout() {
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEdgeSwipeBack();
  useEffect(() => { setMore(false); setSearch(false); }, [loc.pathname, loc.search]);
  const moreActive = MORE.some(m => loc.pathname.startsWith(m.to));

  return (
    <UiCtx.Provider value={{ openSearch: () => setSearch(true) }}>
      <header className="topbar">
        <div className="wrap topbar-in">
          <NavLink to="/" className="brand" aria-label="SearchL1, accueil"><Logo size={30} /><span>Search<b>L1</b></span></NavLink>
          <nav className="toptabs" aria-label="Sections">
            {TABS.map(t => <NavLink key={t.to} to={t.to} end={t.to === '/'}>{t.label}</NavLink>)}
            {MORE.filter(m => !m.soon).map(m => <NavLink key={m.to} to={m.to}>{m.label}</NavLink>)}
          </nav>
          <button className="iconbtn" onClick={() => setSearch(true)} aria-label="Rechercher"><Icon name="search" size={20} /></button>
        </div>
      </header>
      <main className="wrap main"><Outlet /></main>
      <nav className="tabbar" aria-label="Navigation">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tb">
            <Icon name={t.icon} /><span>{t.label}</span>
          </NavLink>
        ))}
        <button className={`tb${moreActive || more ? ' active' : ''}`} onClick={() => setMore(v => !v)} aria-expanded={more}>
          <Icon name="more" /><span>Plus</span>
        </button>
      </nav>
      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" role="dialog" aria-label="Plus de rubriques" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div className="group">
              <button className="row link" onClick={() => { setMore(false); setSearch(true); }}>
                <Icon name="search" /><span className="grow">Rechercher<small className="muted block">joueur, club, match</small></span>
              </button>
              {MORE.map(m => (
                <NavLink key={m.to} to={m.to} className="row link">
                  <Icon name={m.icon} /><span className="grow">{m.label}<small className="muted block">{m.soon ? 'bientôt' : m.note}</small></span>
                </NavLink>
              ))}
            </div>
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
      { path: '/bareme', element: <Bareme /> },
      { path: '/joueurs', element: <Soon title="Joueurs" what="La liste de tous les joueurs, avec filtres et vues (forme, gardiens, défense, attaque, supersubs)" /> },
      { path: '/equipes', element: <Soon title="Équipes" what="Les fiches club : calendrier, effectif, coupes, infirmerie et historique" /> },
      { path: '/infirmerie', element: <Soon title="Infirmerie" what="Blessés, suspendus et incertains de chaque club" /> },
      { path: '/historique', element: <Soon title="Historique" what="Les classements finaux depuis 2014-15" /> },
      { path: '*', element: <Soon title="Page introuvable" what="Cette page n'existe pas" /> },
    ],
  },
]);

export default function App() {
  return <DataProvider><RouterProvider router={router} /></DataProvider>;
}
