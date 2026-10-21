// Couche de navigation « Liquid Glass » : barre du haut, boutons ronds en verre, favoris, badge supersub.
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../lib/favorites.ts';
import { Icon } from './Icon.tsx';

export function useScrolled(threshold = 36) {
  const [s, setS] = useState(() => window.scrollY > threshold);
  useEffect(() => {
    const on = () => setS(window.scrollY > threshold);
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return s;
}

/**
 * Barre du haut en verre : retour à gauche, actions à droite, petit titre qui apparaît quand le grand titre
 * de la page sort de l'écran (comme les apps iOS). La recherche est dans le dock, à côté des onglets.
 */
export function NavBar({ title, back, fallback = '/', right }: { title: string; back?: string; fallback?: string; right?: ReactNode }) {
  const scrolled = useScrolled();
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback));
  return (
    <div className={`navbar-glass${scrolled ? ' scrolled' : ''}`}>
      <div className="nb-side">
        {back && (
          <button className="glass-btn" onClick={goBack} aria-label={`Retour : ${back}`}>
            <Icon name="left" size={22} />
          </button>
        )}
      </div>
      <span className="nb-title" aria-hidden={!scrolled}>{title}</span>
      <div className="nb-side end">
        {right}
      </div>
    </div>
  );
}

export function LargeTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="large-title">
      <h1>{children}</h1>
      {sub && <div className="small muted">{sub}</div>}
    </header>
  );
}

export function FavButton({ kind, id, label }: { kind: 'player'; id: number; label: string } | { kind: 'club'; id: string; label: string }) {
  const f = useFavorites();
  const on = kind === 'player' ? f.isPlayer(id) : f.isClub(id);
  const toggle = () => (kind === 'player' ? f.togglePlayer(id) : f.toggleClub(id));
  return (
    <button className={`glass-btn fav${on ? ' on' : ''}`} onClick={toggle} aria-pressed={on}
      aria-label={on ? `Retirer ${label} des favoris` : `Ajouter ${label} aux favoris`}>
      <Star filled={on} />
    </button>
  );
}

export function Star({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"
        fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

/** Petit logo « bon supersub » : un éclair, avec son libellé pour les lecteurs d'écran. */
export function SuperSubBadge({ subAvg, small = false }: { subAvg?: number | null; small?: boolean }) {
  const t = `Bon supersub${subAvg != null ? ` : ${subAvg.toFixed(1).replace('.', ',')} pts par entrée en jeu` : ''} (× 3 au jeu s'il entre)`;
  return (
    <span className={`ss-badge${small ? ' small' : ''}`} title={t} role="img" aria-label={t}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.5 5.5 13.4h5.3l-1.3 8.1 7.9-11.2h-5.4z" fill="currentColor" /></svg>
    </span>
  );
}
