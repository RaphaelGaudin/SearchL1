// Comparaison d'un joueur avec les autres joueurs de son poste sur la saison :
// rangs centiles (liste lisible = vue tableau) et nuage interactif de tous les joueurs pour la stat choisie.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.tsx';
import { num, POSITION } from '../lib/format.ts';
import { windowStats, type PlayerStats, type WindowStats } from '../lib/model.ts';
import type { Position } from '../lib/types.ts';

interface Metric { k: string; label: string; unit: string; d: number; v: (s: WindowStats) => number | null; lowerIsBetter?: boolean }

const per90 = (x: number, s: WindowStats) => (s.min ? (x / s.min) * 90 : null);
const M: Record<string, Metric> = {
  pts: { k: 'pts', label: 'Points par match', unit: 'pts/match', d: 1, v: s => s.ptsAvg },
  note: { k: 'note', label: 'Note L\'Équipe moy.', unit: 'note', d: 1, v: s => s.noteAvg },
  g: { k: 'g', label: 'Buts', unit: 'par 90 min', d: 2, v: s => per90(s.g, s) },
  a: { k: 'a', label: 'Passes décisives', unit: 'par 90 min', d: 2, v: s => per90(s.a, s) },
  ga: { k: 'ga', label: 'Buts + passes', unit: 'par 90 min', d: 2, v: s => per90(s.g + s.a, s) },
  xg: { k: 'xg', label: 'xG', unit: 'par 90 min', d: 2, v: s => per90(s.xg, s) },
  xa: { k: 'xa', label: 'xA', unit: 'par 90 min', d: 2, v: s => per90(s.xa, s) },
  kp: { k: 'kp', label: 'Passes clés', unit: 'par 90 min', d: 2, v: s => per90(s.kp, s) },
  tk: { k: 'tk', label: 'Tacles réussis', unit: 'par 90 min', d: 2, v: s => per90(s.tk, s) },
  int: { k: 'int', label: 'Interceptions', unit: 'par 90 min', d: 2, v: s => per90(s.int, s) },
  sav: { k: 'sav', label: 'Arrêts', unit: 'par 90 min', d: 2, v: s => per90(s.sav, s) },
  savePct: { k: 'savePct', label: '% d\'arrêts', unit: '%', d: 0, v: s => (s.savePct != null ? s.savePct * 100 : null) },
  gp: { k: 'gp', label: 'Buts évités', unit: 'par 90 min', d: 2, v: s => per90(s.gp, s) },
  cs: { k: 'cs', label: 'Clean sheets', unit: '% des matchs', d: 0, v: s => (s.apps ? (s.cs / s.apps) * 100 : null) },
  cards: { k: 'cards', label: 'Cartons', unit: 'par 90 min', d: 2, v: s => per90(s.y + 2 * s.rc, s), lowerIsBetter: true },
};
const BY_POS: Record<Position, string[]> = {
  G: ['pts', 'note', 'savePct', 'sav', 'gp', 'cs'],
  D: ['pts', 'note', 'tk', 'int', 'cs', 'ga', 'cards'],
  M: ['pts', 'note', 'g', 'a', 'kp', 'xa', 'tk'],
  A: ['pts', 'note', 'g', 'xg', 'a', 'kp', 'xa'],
};
const PLURAL: Record<Position, string> = { G: 'gardiens', D: 'défenseurs', M: 'milieux', A: 'attaquants' };

interface Entry { p: PlayerStats; s: WindowStats }

export function PositionCompare({ player }: { player: PlayerStats }) {
  const d = useData();
  const metrics = BY_POS[player.pos].map(k => M[k]);
  const [sel, setSel] = useState(metrics[0].k);
  const [tip, setTip] = useState<number | null>(null);

  // Groupe de comparaison : même poste, au moins 30 % du temps de jeu possible sur la saison.
  const { pool, me, minMin } = useMemo(() => {
    const minMin = Math.round(d.lastRound * 90 * 0.3);
    const all: Entry[] = d.players.filter(p => p.pos === player.pos).map(p => ({ p, s: windowStats(p, 'saison', d.lastRound) }));
    const pool = all.filter(e => e.s.min >= minMin || e.p.id === player.id);
    return { pool, me: pool.find(e => e.p.id === player.id)!, minMin };
  }, [d, player]);

  const rows = metrics.map(m => {
    const vals = pool.map(e => ({ e, v: m.v(e.s) })).filter((x): x is { e: Entry; v: number } => x.v != null);
    const mine = m.v(me.s);
    if (mine == null || vals.length < 2) return { m, mine, pct: null, rank: null, n: vals.length };
    const better = vals.filter(x => (m.lowerIsBetter ? x.v < mine : x.v > mine)).length;
    const same = vals.filter(x => x.v === mine).length - 1;
    // Centile : part des joueurs du poste que le joueur dépasse (les égalités comptent pour moitié).
    const pct = ((vals.length - 1 - better - same) + same / 2) / (vals.length - 1);
    return { m, mine, pct, rank: better + 1, n: vals.length };
  });

  const metric = M[sel];
  const pts = pool.map(e => ({ e, v: metric.v(e.s) })).filter((x): x is { e: Entry; v: number } => x.v != null);
  const W = 340, padX = 14, r = 4.5;
  const lo = Math.min(...pts.map(x => x.v)), hi = Math.max(...pts.map(x => x.v));
  const span = hi - lo || 1;
  const xOf = (v: number) => {
    const t = (v - lo) / span;
    return padX + (metric.lowerIsBetter ? 1 - t : t) * (W - 2 * padX);
  };
  // Nuage « essaim » : chaque point prend la place libre la plus proche de l'axe ; la hauteur suit la pile la plus haute.
  const raw: { x: number; y: number; id: number }[] = [];
  for (const x of [...pts].sort((a, b) => a.v - b.v)) {
    const px = xOf(x.v);
    let dy = 0;
    for (let k = 0; k < 60; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 2 + 1);
      if (!raw.some(q => Math.abs(q.x - px) < r * 2 + 1 && Math.abs(q.y - off) < r * 2 + 1)) { dy = off; break; }
    }
    raw.push({ x: px, y: dy, id: x.e.p.id });
  }
  const extent = Math.max(r * 4, ...raw.map(q => Math.abs(q.y))) + r + 18;
  const mid = extent, H = mid + extent + 12;
  const placed = raw.map(q => ({ ...q, y: mid + q.y }));
  const pos = new Map(placed.map(q => [q.id, q]));
  // Toucher : on prend le point le plus proche du doigt (les points sont trop serrés pour viser juste).
  const nearest = (e: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) => {
    const svg = e.currentTarget, m = svg.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    let best: number | null = null, bd = 18 * 18;
    for (const q of placed) {
      if (q.id === player.id) continue;
      const dd = (q.x - pt.x) ** 2 + (q.y - pt.y) ** 2;
      if (dd < bd) { bd = dd; best = q.id; }
    }
    return best;
  };
  const meV = metric.v(me.s);
  const tipE = tip != null ? pts.find(x => x.e.p.id === tip) : undefined;
  const median = [...pts.map(x => x.v)].sort((a, b) => a - b)[Math.floor(pts.length / 2)];
  const selRow = rows.find(x => x.m.k === sel)!;

  return (
    <div className="cmp-pos">
      <p className="small muted">
        Saison, parmi les {pool.length} {PLURAL[player.pos]} ayant joué au moins {minMin} minutes. Touchez une stat pour voir où se situe {player.n}.
        {me.s.min < minMin && ' Attention : peu de temps de jeu, comparaison fragile.'}
      </p>

      <div className="pct-list" role="list">
        {rows.map(({ m, mine, pct, rank, n }) => (
          <button key={m.k} role="listitem" className={`pct-row${sel === m.k ? ' on' : ''}`} onClick={() => { setSel(m.k); setTip(null); }} aria-pressed={sel === m.k}>
            <span className="pct-label">
              <span className="strong">{m.label}</span>
              <small className="muted">{mine == null ? 'non applicable' : `${num(mine, m.d)} ${m.unit}`}{rank ? ` · ${rank}e / ${n}` : ''}</small>
            </span>
            <span className="pct-track" aria-hidden="true"><span className="pct-fill" style={{ width: `${Math.round((pct ?? 0) * 100)}%` }} /></span>
            <span className="pct-num num-sm">{pct == null ? '—' : Math.round(pct * 100)}</span>
          </button>
        ))}
      </div>
      <p className="tiny muted">Centile de 0 à 100 : 80 = meilleur que 80 % des {PLURAL[player.pos]}.{metrics.some(m => m.lowerIsBetter) ? ' Pour les cartons, moins = mieux.' : ''}</p>

      <div className="swarm-card">
        <div className="swarm-head">
          <span className="strong">{metric.label}</span>
          <span className="small muted">{metric.unit}{selRow.rank ? ` · ${player.n} ${selRow.rank}e / ${selRow.n}` : ''}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${metric.label} : répartition des ${PLURAL[player.pos]}, ${player.n} mis en évidence`}
          className="swarm" onClick={e => setTip(nearest(e))}
          onPointerMove={e => { if (e.pointerType === "mouse") setTip(nearest(e)); }}>
          <line x1={padX} x2={W - padX} y1={H - 22} y2={H - 22} stroke="var(--line)" />
          {median != null && <line x1={xOf(median)} x2={xOf(median)} y1={8} y2={H - 22} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" />}
          {median != null && <text x={xOf(median)} y={H - 8} textAnchor="middle" className="pc-axis">médiane {num(median, metric.d)}</text>}
          <text x={padX} y={H - 8} className="pc-axis">{metric.lowerIsBetter ? 'plus' : 'moins'}</text>
          <text x={W - padX} y={H - 8} textAnchor="end" className="pc-axis">{metric.lowerIsBetter ? 'moins' : 'plus'} →</text>
          {pts.filter(x => x.e.p.id !== player.id).map(x => {
            const q = pos.get(x.e.p.id)!;
            return (
              <g key={x.e.p.id} className={`sw-dot${tip === x.e.p.id ? ' on' : ''}`} style={{ transform: `translate(${q.x}px, ${q.y}px)` }} data-id={x.e.p.id}>
                <circle r={r} />
              </g>
            );
          })}
          {meV != null && pos.get(player.id) && (
            <g className="sw-me" style={{ transform: `translate(${pos.get(player.id)!.x}px, ${pos.get(player.id)!.y}px)` }}>
              <circle r={r + 3} />
              <text y={-r - 8} textAnchor={pos.get(player.id)!.x > W - 50 ? 'end' : pos.get(player.id)!.x < 50 ? 'start' : 'middle'} className="sw-me-label">{player.n.split(' ').slice(-1)[0]}</text>
            </g>
          )}
        </svg>
        {tipE ? (
          <Link to={`/joueur/${tipE.e.p.id}`} className="sw-tip">
            <span className="grow ellipsis"><span className="strong">{tipE.e.p.n}</span> <span className="muted">· {tipE.e.p.club}</span></span>
            <span className="num-sm">{num(tipE.v, metric.d)}</span>
            <span className="textlink small">Fiche ›</span>
          </Link>
        ) : (
          <p className="tiny muted">Touchez un point pour voir le joueur. En vert : {player.n} ({meV == null ? '—' : num(meV, metric.d)}), {POSITION[player.pos].toLowerCase()}.</p>
        )}
      </div>
    </div>
  );
}
