import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Result } from '../lib/standings.ts';
import { pct } from '../lib/format.ts';

export function Section({ title, meta, children, id }: { title: string; meta?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <h2>{title}</h2>
        {meta != null && <span className="muted small">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** Liste groupée façon iOS. */
export function Group({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`group ${className}`}>{children}</div>;
}

export function Row({ to, children, className = '', onClick }: { to?: string; children: ReactNode; className?: string; onClick?: () => void }) {
  if (to) return <Link to={to} className={`row link ${className}`}>{children}</Link>;
  if (onClick) return <button type="button" className={`row link ${className}`} onClick={onClick}>{children}</button>;
  return <div className={`row ${className}`}>{children}</div>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export type Tone = 'accent' | 'down' | 'warn' | 'neutral' | 'LDC' | 'LE' | 'LC' | 'CDF';
export function Chip({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`chip chip-${tone}`} title={title}>{children}</span>;
}

export function Form({ results, n = 5 }: { results: Result[]; n?: number }) {
  return (
    <span className="form" aria-label={`Forme : ${results.slice(-n).join(' ')}`}>
      {results.slice(-n).map((r, i) => <span key={i} className={`pill pill-${r}`}>{r}</span>)}
    </span>
  );
}

export function ProbBar({ H, D, A, big = false }: { H: number; D: number; A: number; big?: boolean }) {
  return (
    <div className={`probbar${big ? ' big' : ''}`} role="img" aria-label={`Victoire domicile ${pct(H)}, nul ${pct(D)}, victoire extérieur ${pct(A)}`}>
      <span className="pb-h" style={{ flexGrow: H }} />
      <span className="pb-d" style={{ flexGrow: D }} />
      <span className="pb-a" style={{ flexGrow: A }} />
    </div>
  );
}

/** Pourcentages arrondis qui somment à 100. */
export function pcts(p: { H: number; D: number; A: number }): [number, number, number] {
  const H = Math.round(p.H * 100), A = Math.round(p.A * 100);
  return [H, 100 - H - A, A];
}

/** Sommaire collant sous la barre du haut : un geste pour aller à une section. */
/**
 * Onglet affiché d'une fiche, gardé dans l'adresse (?t=…) : on le retrouve en revenant en arrière
 * ou en passant au club, au joueur ou au match suivant. Sans ?t, c'est le premier onglet.
 */
export function useTab(items: [string, string][]): [string, (k: string) => void] {
  const [params, setParams] = useSearchParams();
  const t = params.get('t');
  const cur = items.some(([k]) => k === t) ? t! : items[0][0];
  const set = (k: string) => setParams(p => {
    const n = new URLSearchParams(p);
    if (k === items[0][0]) n.delete('t'); else n.set('t', k);
    return n;
  }, { replace: true, preventScrollReset: true });
  return [cur, set];
}

/** Onglets collants d'une fiche : un seul contenu à la fois, plus besoin de faire défiler toute la page. */
export function SubNav({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (k: string) => void }) {
  const nav = useRef<HTMLElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // L'onglet choisi reste visible dans la barre.
  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && nav.current) nav.current.scrollLeft = el.offsetLeft - nav.current.clientWidth / 2 + el.clientWidth / 2;
  }, [value]);
  // Changer d'onglet après avoir fait défiler : on remonte au début du contenu, la barre d'onglets en haut.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const a = anchor.current, n = nav.current;
    if (!a || !n) return;
    const top = a.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(n).top || '0');
    if (window.scrollY > top) window.scrollTo({ top });
  }, [value]);
  return (
    <>
      <div ref={anchor} aria-hidden="true" />
      <nav className="subnav" ref={nav} role="tablist" aria-label="Rubriques">
        {items.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={k === value} className={k === value ? 'on' : undefined} onClick={() => onChange(k)}>{l}</button>
        ))}
      </nav>
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty muted">{children}</div>;
}

export function Estimate() {
  return <span className="estimate" title="Points calculés avec une note L'Équipe estimée à partir de la note Sofascore">estimés</span>;
}
