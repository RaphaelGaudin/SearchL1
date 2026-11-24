// Comparaison globale par poste : tous les joueurs d'un poste dans un tableau, sur la période choisie,
// trié par la colonne touchée (première colonne collante pour garder le nom en défilant à droite).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.tsx';
import { num, POSITIONS } from '../lib/format.ts';
import { PERIODS, windowStats, type Period, type PlayerStats, type WindowStats } from '../lib/model.ts';
import type { Position } from '../lib/types.ts';
import { Crest } from './Crest.tsx';
import { Empty, Price } from './ui.tsx';

interface Col { k: string; label: string; title: string; v: (w: WindowStats, p: PlayerStats) => number | null; d?: number; low?: boolean; price?: boolean }
const COLS: Record<string, Col> = {
  avg: { k: 'avg', label: 'Pts/m', title: 'Points par match', v: w => w.ptsAvg, d: 1 },
  prix: { k: 'prix', label: 'Prix', title: 'Prix au jeu (étoiles)', v: (_, p) => p.prix, d: 1, low: true, price: true },
  value: { k: 'value', label: 'Pts/★', title: 'Points par étoile', v: (w, p) => (w.ptsAvg != null && p.prix ? w.ptsAvg / p.prix : null), d: 2 },
  note: { k: 'note', label: 'Note', title: "Note L'Équipe moyenne", v: w => w.noteAvg, d: 1 },
  apps: { k: 'apps', label: 'Matchs', title: 'Matchs joués', v: w => w.apps, d: 0 },
  min: { k: 'min', label: 'Min', title: 'Minutes jouées', v: w => w.min, d: 0 },
  g: { k: 'g', label: 'Buts', title: 'Buts', v: w => w.g, d: 0 },
  a: { k: 'a', label: 'Passes', title: 'Passes décisives', v: w => w.a, d: 0 },
  xg: { k: 'xg', label: 'xG', title: 'Buts attendus', v: w => w.xg, d: 1 },
  xa: { k: 'xa', label: 'xA', title: 'Passes décisives attendues', v: w => w.xa, d: 1 },
  kp: { k: 'kp', label: 'P. clés', title: 'Passes clés', v: w => w.kp, d: 0 },
  tk: { k: 'tk', label: 'Tacles', title: 'Tacles réussis', v: w => w.tk, d: 0 },
  int: { k: 'int', label: 'Interc.', title: 'Interceptions', v: w => w.int, d: 0 },
  cs: { k: 'cs', label: 'CS', title: 'Clean sheets', v: w => w.cs, d: 0 },
  sav: { k: 'sav', label: 'Arrêts', title: 'Arrêts', v: w => w.sav, d: 0 },
  savePct: { k: 'savePct', label: '% arr.', title: "Pourcentage d'arrêts", v: w => (w.savePct != null ? w.savePct * 100 : null), d: 0 },
  conc: { k: 'conc', label: 'Enc.', title: 'Buts encaissés', v: w => w.conc, d: 0, low: true },
  gp: { k: 'gp', label: 'Évités', title: 'Buts évités', v: w => w.gp, d: 1 },
  cards: { k: 'cards', label: 'Cartons', title: 'Cartons (rouge = 2)', v: w => w.y + 2 * w.rc, d: 0, low: true },
};
const BASE = ['avg', 'prix', 'value', 'note', 'apps'];
const BY_POS: Record<Position, string[]> = {
  G: [...BASE, 'sav', 'savePct', 'cs', 'conc', 'gp'],
  D: [...BASE, 'tk', 'int', 'cs', 'g', 'a', 'cards'],
  M: [...BASE, 'g', 'a', 'kp', 'xa', 'tk', 'min'],
  A: [...BASE, 'g', 'a', 'xg', 'xa', 'kp', 'min'],
};
const PRIX_MAX = [5, 7, 9, 11, 13, 15];

export function PositionTable({ initialPos = 'A' }: { initialPos?: Position }) {
  const d = useData();
  const [pos, setPos] = useState<Position>(initialPos);
  const [period, setPeriod] = useState<Period>('saison');
  const [sort, setSort] = useState<{ k: string; asc: boolean }>({ k: 'avg', asc: false });
  const [prixMax, setPrixMax] = useState('all');
  const [dispo, setDispo] = useState(false);
  const [limit, setLimit] = useState(40);
  const cols = BY_POS[pos].map(k => COLS[k]);

  // Temps de jeu minimum : 30 % des minutes possibles sur la période (sinon un remplaçant d'un match
  // passerait devant tout le monde à la moyenne).
  const span = period === 'saison' ? d.lastRound : Math.min(period, d.lastRound);
  const minMin = Math.round(span * 90 * 0.3);
  const rows = useMemo(() => {
    const col = COLS[sort.k];
    return d.players
      .filter(p => p.pos === pos && !p.left && (!dispo || !p.absence) && (prixMax === 'all' || (p.prix != null && p.prix <= Number(prixMax))))
      .map(p => ({ p, w: windowStats(p, period, d.lastRound) }))
      .filter(({ w }) => w.min >= minMin)
      .sort((a, b) => {
        const va = col.v(a.w, a.p), vb = col.v(b.w, b.p);
        if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1; // sans valeur : en bas
        return sort.asc ? va - vb : vb - va;
      });
  }, [d, pos, period, sort, prixMax, dispo, minMin]);

  const pick = (k: string) => setSort(s => (s.k === k ? { k, asc: !s.asc } : { k, asc: !!COLS[k].low }));
  const first = PERIODS.find(x => x.k === period)!;

  return (
    <div className="ptable">
      <div className="chips-row" role="tablist" aria-label="Poste">
        {(Object.entries(POSITIONS) as [Position, string][]).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={pos === k} className={`toggle${pos === k ? ' on' : ''}`} onClick={() => { setPos(k); setLimit(40); if (!BY_POS[k].includes(sort.k)) setSort({ k: 'avg', asc: false }); }}>{l}</button>
        ))}
      </div>
      <div className="chips-row" role="group" aria-label="Période">
        {PERIODS.map(x => <button key={String(x.k)} type="button" className={`toggle${period === x.k ? ' on' : ''}`} aria-pressed={period === x.k} onClick={() => setPeriod(x.k)}>{x.label}</button>)}
      </div>
      <div className="picker-selects">
        <label className="select"><select value={prixMax} onChange={e => setPrixMax(e.target.value)} aria-label="Prix maximum">
          <option value="all">Tous les prix</option>
          {PRIX_MAX.map(v => <option key={v} value={v}>{v} ★ max</option>)}
        </select></label>
        <button type="button" className={`toggle${dispo ? ' on' : ''}`} aria-pressed={dispo} onClick={() => setDispo(v => !v)}>Disponibles seulement</button>
      </div>
      <p className="small muted">
        {rows.length} {POSITIONS[pos].toLowerCase()} · {first.label.toLowerCase()} · au moins {minMin} min jouées. Totaux sur la période ; touchez un en-tête de colonne pour trier.
      </p>

      {rows.length ? (
        <div className="card flush">
          <div className="table-scroll">
            <table className="table ptable-t">
              <thead>
                <tr>
                  <th className="l sticky">Joueur</th>
                  {cols.map(c => (
                    <th key={c.k} aria-sort={sort.k === c.k ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className={`th-sort${sort.k === c.k ? ' on' : ''}`} onClick={() => pick(c.k)} title={c.title} aria-label={`Trier par ${c.title}`}>
                        {c.label}{sort.k === c.k ? (sort.asc ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map(({ p, w }, i) => (
                  <tr key={p.id}>
                    <td className="l sticky">
                      <Link to={`/joueur/${p.id}`} className="pt-player">
                        <span className="rank num-sm muted">{i + 1}</span><Crest club={p.club} size={16} />
                        <span className="ellipsis strong">{p.n}</span>{p.absence && <span className="pt-abs" title={p.absence.why}>abs.</span>}
                      </Link>
                    </td>
                    {cols.map(c => {
                      const v = c.v(w, p);
                      return <td key={c.k} className={sort.k === c.k ? 'num-sm strong' : 'num-sm'}>{v == null ? '—' : c.price ? <Price v={v} /> : num(v, c.d ?? 1)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <Empty>Aucun joueur avec ces filtres sur cette période.</Empty>}
      {rows.length > limit && <button type="button" className="glass-pill wide" onClick={() => setLimit(l => l + 40)}>Afficher plus de joueurs</button>}
      <p className="small muted">Pts/m : points par match. Pts/★ : points par match pour chaque étoile du prix. CS : clean sheets. Le joueur s'ouvre d'un toucher sur son nom.</p>
    </div>
  );
}
