import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
export function SubNav({ items }: { items: [string, string][] }) {
  return (
    <nav className="subnav" aria-label="Sommaire">
      {items.map(([k, l]) => (
        <a key={k} href={`#${k}`} onClick={e => { e.preventDefault(); document.getElementById(k)?.scrollIntoView({ behavior: 'smooth' }); }}>{l}</a>
      ))}
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty muted">{children}</div>;
}

export function Estimate() {
  return <span className="estimate" title="Points calculés avec une note L'Équipe estimée à partir de la note Sofascore">est.</span>;
}
