import { useState } from 'react';
import { Crest } from '../components/Crest.tsx';
import { Card, Form } from '../components/ui.tsx';
import { useData } from '../lib/data.tsx';
import { buildTable } from '../lib/standings.ts';
import { Link } from 'react-router-dom';
import { LargeTitle, NavBar } from '../components/Glass.tsx';

const VIEWS = [['general', 'Général'], ['h', 'Domicile'], ['a', 'Extérieur']] as const;
// Places européennes 2026-27 (indice UEFA de la France) et relégation : 1-3 LdC, 4 barrage LdC, 5 LE, 6 LC, 16 barrage, 17-18 relégués.
const zone = (rank: number) => rank <= 3 ? 'ldc' : rank === 4 ? 'ldcq' : rank === 5 ? 'le' : rank === 6 ? 'lc' : rank === 16 ? 'po' : rank >= 17 ? 'rel' : '';

export function Standings() {
  const d = useData();
  const [view, setView] = useState<(typeof VIEWS)[number][0]>('general');
  const played = d.matches.filter(m => m.status === 'finished');
  const rows = view === 'general' ? d.table : buildTable(played, view);
  const prev = new Map((d.prevTable ?? []).map(r => [r.club, r.rank]));
  return (
    <div className="page">
      <NavBar title="Classement" />
      <LargeTitle sub={`après J${d.lastRound}`}>Classement</LargeTitle>
      <div className="seg" role="tablist">
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <Card className="flush">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th className="sticky l">Club</th><th>Pts</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Diff.</th><th>BP</th><th>BC</th><th className="l">Forme</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const mv = view === 'general' && prev.has(r.club) ? prev.get(r.club)! - r.rank : 0;
                return (
                  <tr key={r.club} className={view === 'general' ? `z-${zone(r.rank)}` : ''}>
                    <td className="sticky l">
                      <Link to={`/club/${encodeURIComponent(r.club)}`} className="club-cell">
                        <span className="rank num-sm">{r.rank}</span><Crest club={r.club} size={20} /><span className="strong">{r.club}</span>
                        {mv !== 0 && <span className={`mv ${mv > 0 ? 'up' : 'down'}`}>{mv > 0 ? '▲' : '▼'}{Math.abs(mv)}</span>}
                      </Link>
                    </td>
                    <td className="num-sm strong">{r.pts}</td><td>{r.mp}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
                    <td>{r.gd > 0 ? '+' : ''}{r.gd}</td><td>{r.gf}</td><td>{r.ga}</td><td className="l"><Form results={r.form} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {view === 'general' && (
        <p className="legend small muted">
          <span className="lg z-ldc" />Ligue des champions <span className="lg z-ldcq" />barrage LdC <span className="lg z-le" />Ligue Europa <span className="lg z-lc" />Ligue Conférence <span className="lg z-po" />barrage <span className="lg z-rel" />relégation
        </p>
      )}
    </div>
  );
}
