import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { LargeTitle, NavBar } from '../components/Glass.tsx';
import { Card, Section } from '../components/ui.tsx';
import { CLUBS } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { useFavorites } from '../lib/favorites.ts';
import { usePref } from '../lib/prefs.ts';
import type { TableRow } from '../lib/standings.ts';

// Couleurs des courbes, dans l'ordre (palette validée, mêmes variables que le graphique des points).
const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
const MAX = SERIES.length;
const DEFAULT = ['PSG', 'Marseille', 'Lyon', 'Lille'];
// Saison 2019-20 arrêtée en mars (Covid) : la LFP a classé les clubs aux points par match.
const STOPPED = '2019-20';

const ord = (n: number) => `${n}${n === 1 ? 'er' : 'e'}`;

/** Classement final d'une saison (2019-20 : au quotient points par match, comme la LFP). */
function finalTable(s: string, table: TableRow[]): TableRow[] {
  if (s !== STOPPED) return table;
  return [...table].sort((a, b) => b.pts / b.mp - a.pts / a.mp || b.gd - a.gd || b.gf - a.gf).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function History() {
  const d = useData();
  const favs = useFavorites();
  const finals = useMemo(() => d.finals.map(f => ({ s: f.s, table: finalTable(f.s, f.table) })), [d.finals]);

  // Clubs suivis sur la courbe : d'abord les favoris, sinon quatre clubs habitués du haut de tableau.
  const [picked, setPicked] = useState<string[]>(() => {
    const fav = favs.clubs.filter(c => CLUBS.some(x => x.name === c)).slice(0, MAX);
    return fav.length ? fav : DEFAULT;
  });
  const toggle = (c: string) =>
    setPicked(p => (p.includes(c) ? p.filter(x => x !== c) : p.length >= MAX ? [...p.slice(1), c] : [...p, c]));

  const [season, setSeason] = usePref<string>('historique-saison', finals.at(-1)?.s ?? '');
  const cur = finals.find(f => f.s === season) ?? finals.at(-1);

  return (
    <div className="page">
      <NavBar title="Historique" back="Retour" fallback="/" />
      <LargeTitle sub={`Ligue 1 depuis ${finals[0]?.s ?? '2014-15'}`}>Historique</LargeTitle>

      <Section title="Position finale par club" meta={`${picked.length}/${MAX} clubs`}>
        <div className="rail club-rail" role="group" aria-label="Clubs affichés sur la courbe">
          {CLUBS.map(c => {
            const i = picked.indexOf(c.name);
            return (
              <button key={c.name} className={`rail-item${i >= 0 ? ' on' : ''}`} aria-pressed={i >= 0} onClick={() => toggle(c.name)}
                style={i >= 0 ? { boxShadow: `inset 0 0 0 2px ${SERIES[i]}` } : undefined}>
                <Crest club={c.name} size={30} /><span className="tiny">{c.name}</span>
              </button>
            );
          })}
        </div>
        <Card><BumpChart finals={finals} clubs={picked} /></Card>
        <p className="small muted hist-note">Touchez un club pour l'ajouter ou le retirer (4 au plus). Touchez un point ou un club de la légende pour suivre sa courbe. Un trou : saison hors de la Ligue 1.</p>
      </Section>

      <Section title="Classement final" meta={cur ? `${cur.table.length} clubs` : undefined}>
        <div className="chips-row" role="tablist" aria-label="Saison">
          {[...finals].reverse().map(f => (
            <button key={f.s} role="tab" aria-selected={f.s === cur?.s} className={`toggle${f.s === cur?.s ? ' on' : ''}`} onClick={() => setSeason(f.s)}>
              {f.s}
            </button>
          ))}
        </div>
        {cur && <SeasonTable s={cur.s} table={cur.table} />}
      </Section>
    </div>
  );
}

function SeasonTable({ s, table }: { s: string; table: TableRow[] }) {
  const goals = table.reduce((n, r) => n + r.gf, 0);
  const games = table.reduce((n, r) => n + r.mp, 0) / 2;
  const relegated = table.length >= 20 ? 3 : 2;
  return (
    <>
      <p className="small hist-summary">
        <span><span className="muted">Champion </span><strong>{table[0].club}</strong></span>
        <span><span className="muted">Buts par match </span><strong>{(goals / games).toFixed(2).replace('.', ',')}</strong></span>
      </p>
      {s === STOPPED && <p className="small muted hist-note">Saison arrêtée après 28 journées (Covid) : classement aux points par match, comme l'a décidé la LFP.</p>}
      <Card className="flush">
        <div className="table-scroll">
          <table className="table standings simple">
            <thead>
              <tr><th className="sticky l">Équipe</th><th>J</th><th>V-N-D</th><th>Diff.</th><th>Pts</th></tr>
            </thead>
            <tbody>
              {table.map(r => {
                const current = CLUBS.some(c => c.name === r.club);
                return (
                  <tr key={r.club} className={r.rank === 1 ? 'z-ldc' : r.rank > table.length - relegated ? 'z-rel' : ''}>
                    <td className="sticky l">
                      {current ? (
                        <Link to={`/club/${encodeURIComponent(r.club)}`} className="club-cell">
                          <span className="rank num-sm">{r.rank}</span><Crest club={r.club} size={20} /><span className="strong">{r.club}</span>
                        </Link>
                      ) : (
                        <span className="club-cell">
                          <span className="rank num-sm">{r.rank}</span><Crest club={r.club} size={20} /><span>{r.club}</span>
                        </span>
                      )}
                    </td>
                    <td>{r.mp}</td>
                    <td className="small">{r.w}-{r.d}-{r.l}</td>
                    <td>{r.gd > 0 ? '+' : ''}{r.gd}</td>
                    <td className="num-sm strong pts-cell">{r.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="legend small muted">
        <span className="lg z-ldc" />champion <span className="lg z-rel" />relégués · points recalculés à partir des résultats (sans les retraits de points administratifs)
      </p>
    </>
  );
}

/** Position finale saison par saison (1 en haut), une courbe par club ; un trou quand le club n'était pas en L1. */
function BumpChart({ finals, clubs }: { finals: { s: string; table: TableRow[] }[]; clubs: string[] }) {
  const [tip, setTip] = useState<{ club: string; i: number } | null>(null);
  const W = 340, H = 220, l = 22, r = 44, t = 10, b = 22;
  const n = finals.length;
  const x = (i: number) => l + (i * (W - l - r)) / Math.max(1, n - 1);
  const y = (rank: number) => t + ((rank - 1) * (H - t - b)) / 19;
  const rankOf = (club: string, i: number) => finals[i].table.find(row => row.club === club);

  const series = clubs.map((club, k) => {
    const pts = finals.map((_, i) => rankOf(club, i));
    const segs: string[] = [];
    let cur = '';
    pts.forEach((p, i) => {
      if (p) cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.rank).toFixed(1)} `;
      else if (cur) { segs.push(cur); cur = ''; }
    });
    if (cur) segs.push(cur);
    const lastIdx = pts.map((p, i) => (p ? i : -1)).filter(i => i >= 0).at(-1);
    return { club, color: SERIES[k], pts, segs, lastIdx };
  });

  // Étiquettes au bout des courbes, écartées d'au moins 11 px pour ne pas se chevaucher.
  const labels = series.filter(s => s.lastIdx != null).map(s => ({ s, y: y(s.pts[s.lastIdx!]!.rank) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 11);

  const tipRow = tip ? rankOf(tip.club, tip.i) : undefined;
  // Club mis en avant (point ou légende touchés) : les autres courbes s'estompent pour qu'on suive la sienne.
  const focus = tip?.club;
  const dim = (club: string) => (focus && focus !== club ? 0.2 : 1);
  const last = (club: string) => { const s = series.find(x => x.club === club); return s?.lastIdx ?? n - 1; };
  return (
    <div className="bump">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Position finale par saison : ${clubs.join(', ') || 'aucun club choisi'}`}>
        {[1, 5, 10, 15, 20].map(k => (
          <g key={k}><line x1={l} x2={W - r} y1={y(k)} y2={y(k)} stroke="var(--line)" /><text x={l - 6} y={y(k) + 3} textAnchor="end" className="pc-axis">{k}</text></g>
        ))}
        {finals.map((f, i) => (i % 2 === 0 || i === n - 1) && <text key={f.s} x={x(i)} y={H - 6} textAnchor="middle" className="pc-axis">{f.s.slice(2, 4)}</text>)}
        {series.map(s => s.segs.map((seg, j) => <path key={s.club + j} d={seg} fill="none" stroke={s.color} strokeWidth={focus === s.club ? 3 : 2} opacity={dim(s.club)} strokeLinejoin="round" strokeLinecap="round" />))}
        {series.map(s => s.pts.map((p, i) => p && (
          <g key={s.club + i} onClick={() => setTip({ club: s.club, i })} className="bump-dot" opacity={dim(s.club)}>
            <circle cx={x(i)} cy={y(p.rank)} r="12" fill="transparent" />
            <circle cx={x(i)} cy={y(p.rank)} r={tip?.club === s.club && tip.i === i ? 5.5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )))}
        {labels.map(({ s, y: ly }) => (
          <text key={s.club} x={x(s.lastIdx!) + 8} y={ly + 3} className="bump-label" opacity={dim(s.club)}>{s.club.length > 8 ? s.club.slice(0, 7) + '.' : s.club}</text>
        ))}
      </svg>
      <div className="bump-legend">
        {series.map(s => (
          <button key={s.club} type="button" className="small" aria-pressed={focus === s.club} style={{ opacity: dim(s.club) }}
            onClick={() => setTip(focus === s.club ? null : { club: s.club, i: last(s.club) })}>
            <i style={{ background: s.color }} />{s.club}
          </button>
        ))}
      </div>
      <p className="small bump-tip" aria-live="polite">
        {tip && tipRow ? <><strong>{tip.club}</strong> · {finals[tip.i].s} : {ord(tipRow.rank)} sur {finals[tip.i].table.length}, {tipRow.pts} pts ({tipRow.w}-{tipRow.d}-{tipRow.l})</>
          : <span className="muted">Touchez un point ou un club de la légende pour le suivre.</span>}
      </p>
    </div>
  );
}
