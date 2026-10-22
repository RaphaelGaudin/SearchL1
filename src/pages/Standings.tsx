import { Link } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { LargeTitle, NavBar } from '../components/Glass.tsx';
import { Card, Form } from '../components/ui.tsx';
import { useData } from '../lib/data.tsx';
import { usePref } from '../lib/prefs.ts';
import { buildTable } from '../lib/standings.ts';

const VIEWS = [['general', 'Général'], ['h', 'Domicile'], ['a', 'Extérieur']] as const;
type View = (typeof VIEWS)[number][0];
// Places européennes 2026-27 (indice UEFA de la France) et relégation : 1-3 LdC, 4 barrage LdC, 5 LE, 6 LC, 16 barrage, 17-18 relégués.
const zone = (rank: number) => rank <= 3 ? 'ldc' : rank === 4 ? 'ldcq' : rank === 5 ? 'le' : rank === 6 ? 'lc' : rank === 16 ? 'po' : rank >= 17 ? 'rel' : '';

export function Standings() {
  const d = useData();
  const [view, setView] = usePref<View>('classement-vue', 'general');
  // Simple : place, équipe, matchs, différence, points. Détaillé : tout, avec la forme.
  const [detail, setDetail] = usePref<'simple' | 'detaille'>('classement-detail', 'simple');
  const played = d.matches.filter(m => m.status === 'finished');
  const rows = view === 'general' ? d.table : buildTable(played, view);
  const prev = new Map((d.prevTable ?? []).map(r => [r.club, r.rank]));
  const full = detail === 'detaille';
  return (
    <div className="page">
      <NavBar title="Classement" />
      <LargeTitle sub={`après J${d.lastRound}`}>Classement</LargeTitle>
      <div className="seg glass-seg" role="tablist" aria-label="Matchs pris en compte">
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div className="detail-row">
        <span className="small muted">Affichage</span>
        <div className="seg glass-seg detail-seg" role="tablist" aria-label="Niveau de détail">
          <button role="tab" aria-selected={!full} onClick={() => setDetail('simple')}>Simple</button>
          <button role="tab" aria-selected={full} onClick={() => setDetail('detaille')}>Détaillé</button>
        </div>
      </div>
      <Card className="flush">
        <div className="table-scroll">
          <table className={`table standings${full ? '' : ' simple'}`}>
            <thead>
              <tr>
                <th className="sticky l">Équipe</th>
                <th>J</th>
                {full && <><th>V</th><th>N</th><th>D</th><th>BP</th><th>BC</th></>}
                <th>Diff.</th>
                <th>Pts</th>
                {full && <th className="l">Forme</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const mv = view === 'general' && prev.has(r.club) ? prev.get(r.club)! - r.rank : 0;
                return (
                  <tr key={r.club} className={view === 'general' ? `z-${zone(r.rank)}` : ''}>
                    <td className="sticky l">
                      <Link to={`/club/${encodeURIComponent(r.club)}`} className="club-cell">
                        <span className="rank num-sm">{r.rank}</span><Crest club={r.club} size={20} /><span className="strong">{r.club}</span>
                        {full && mv !== 0 && <span className={`mv ${mv > 0 ? 'up' : 'down'}`}>{mv > 0 ? '▲' : '▼'}{Math.abs(mv)}</span>}
                      </Link>
                    </td>
                    <td>{r.mp}</td>
                    {full && <><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td></>}
                    <td>{r.gd > 0 ? '+' : ''}{r.gd}</td>
                    <td className="num-sm strong pts-cell">{r.pts}</td>
                    {full && <td className="l"><Form results={r.form} /></td>}
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
