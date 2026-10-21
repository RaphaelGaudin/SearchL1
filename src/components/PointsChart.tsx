import { useState } from 'react';
import { num } from '../lib/format.ts';
import type { ScoredLog } from '../lib/model.ts';
import type { Match } from '../lib/types.ts';

const SRC = [
  ['team', 'Équipe'], ['note', 'Note'], ['actions', 'Actions'], ['defense', 'Défense'], ['cards', 'Cartons'],
] as const;

/**
 * Points par journée, empilés par source (au-dessus de zéro les gains, en dessous les pertes).
 * Toucher une barre affiche son détail ; la liste match par match de la fiche sert de vue tableau.
 */
export function PointsChart({ logs, rounds, byId, club }: { logs: ScoredLog[]; rounds: number; byId: Map<number, Match>; club: string }) {
  const played = new Map(logs.filter(L => L.lu && L.min > 0).map(L => [L.j, L]));
  const last = [...played.keys()].sort((a, b) => b - a)[0] ?? null;
  const [sel, setSel] = useState<number | null>(last);
  if (!rounds) return null;

  const W = 340, H = 170, top = 10, bottom = 22, gap = 2;
  let maxP = 10, minN = 0;
  played.forEach(L => {
    const pos = SRC.reduce((s, [k]) => s + Math.max(0, L.P[k]), 0);
    const neg = SRC.reduce((s, [k]) => s + Math.min(0, L.P[k]), 0);
    maxP = Math.max(maxP, pos); minN = Math.min(minN, neg);
  });
  const scale = (H - top - bottom) / (maxP - minN);
  const y0 = top + maxP * scale;
  const slot = W / rounds;
  const bw = Math.max(4, Math.min(18, slot - 4));

  const L = sel != null ? played.get(sel) : undefined;
  const m = L ? byId.get(L.match) : undefined;
  const opp = m ? (m.h === club ? m.a : m.h) : '';

  return (
    <div className="pchart">
      <div className="legend-row small" aria-hidden="true">
        {SRC.map(([k, l], i) => <span key={k}><i style={{ background: `var(--s${i + 1})` }} />{l}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Points estimés par journée, par source">
        <line x1="0" x2={W} y1={y0} y2={y0} stroke="var(--line)" strokeWidth="1" />
        {Array.from({ length: rounds }, (_, i) => {
          const j = i + 1;
          const x = i * slot + (slot - bw) / 2;
          const P = played.get(j)?.P;
          let up = y0, down = y0;
          return (
            <g key={j} onClick={() => P && setSel(j)} className={`pc-bar${sel === j ? ' on' : ''}`}>
              {/* Zone de toucher plus large que la barre. */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {P ? SRC.map(([k], si) => {
                const v = P[k];
                if (Math.abs(v) < 0.05) return null;
                const h = Math.abs(v) * scale;
                const y = v > 0 ? (up -= h) : down;
                if (v < 0) down += h;
                return <rect key={k} x={x} y={y + (v > 0 ? gap / 2 : gap / 2)} width={bw} height={Math.max(1, h - gap)} rx={2} fill={`var(--s${si + 1})`} />;
              }) : <line x1={x} x2={x + bw} y1={y0} y2={y0} stroke="var(--muted)" strokeWidth="2" strokeDasharray="2 2" />}
              {(rounds <= 12 || j % 2 === 1 || j === rounds) && <text x={i * slot + slot / 2} y={H - 6} textAnchor="middle" className="pc-axis">{j}</text>}
            </g>
          );
        })}
      </svg>
      {L && m ? (
        <div className="pc-detail small">
          <span className="strong">J{L.j} · {L.home ? 'vs' : 'à'} {opp} · {m.hg}-{m.ag}</span>
          <span className="num-sm">{num(L.P.total, 0)} pts</span>
          <span className="muted block w100">
            {SRC.map(([k, l]) => `${l} ${num(L.P[k], 0)}`).join(' · ')}
          </span>
        </div>
      ) : <p className="small muted">Touchez une barre pour le détail.</p>}
    </div>
  );
}
