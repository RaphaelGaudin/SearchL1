import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { LargeTitle, NavBar } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar } from '../components/PlayerRow.tsx';
import { Card, Empty, Estimate, Group, Section } from '../components/ui.tsx';
import { useData } from '../lib/data.tsx';
import { norm, num, POSITION } from '../lib/format.ts';
import { windowStats, type Period, type PlayerStats, type WindowStats } from '../lib/model.ts';

// Couleurs des deux joueurs (palette des graphiques, dans l'ordre).
const COLOR = ['var(--s1)', 'var(--s2)'];
const PERIODS: [Period, string][] = [['saison', 'Saison'], [5, '5 dernières J'], [3, '3 dernières J']];

type Stat = { k: string; label: string; v: (w: WindowStats, p: PlayerStats) => number | null; fmt?: (w: WindowStats) => string; d?: number; low?: boolean; keepers?: boolean };
const STATS: Stat[] = [
  { k: 'prix', label: 'Prix au jeu (étoiles)', v: (_, p) => p.prix, d: 1, low: true },
  { k: 'value', label: 'Points par étoile', v: (_, p) => p.value, d: 2 },
  { k: 'avg', label: 'Points par match', v: w => w.ptsAvg, d: 1 },
  { k: 'pts', label: 'Points au total', v: w => w.pts, d: 0 },
  { k: 'apps', label: 'Matchs joués', v: w => w.apps, fmt: w => `${w.apps} (${w.starts} tit.)` },
  { k: 'min', label: 'Minutes', v: w => w.min, d: 0 },
  { k: 'note', label: "Note L'Équipe moyenne", v: w => w.noteAvg, d: 1 },
  { k: 'g', label: 'Buts', v: w => w.g, d: 0 },
  { k: 'a', label: 'Passes décisives', v: w => w.a, d: 0 },
  { k: 'xg', label: 'Buts attendus (xG)', v: w => w.xg, d: 1 },
  { k: 'xa', label: 'Passes attendues (xA)', v: w => w.xa, d: 1 },
  { k: 'kp', label: 'Passes clés', v: w => w.kp, d: 0 },
  { k: 'tk', label: 'Tacles réussis', v: w => w.tk, d: 0 },
  { k: 'int', label: 'Interceptions', v: w => w.int, d: 0 },
  { k: 'cs', label: 'Clean sheets', v: w => w.cs, d: 0 },
  { k: 'sav', label: 'Arrêts', v: w => w.sav, d: 0, keepers: true },
  { k: 'conc', label: 'Buts encaissés', v: w => w.conc, d: 0, low: true, keepers: true },
  { k: 'cards', label: 'Cartons', v: w => w.y + 2 * w.rc, fmt: w => `${w.y} J · ${w.rc} R`, low: true },
];

/** Comparer deux joueurs : stats côte à côte sur une période, et leurs points journée par journée. */
export function Compare() {
  const d = useData();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>('saison');
  const ids = [params.get('a'), params.get('b')].map(x => (x ? d.playerById.get(Number(x)) : undefined));
  // Arrivé depuis une fiche joueur (?a= seul) : on propose tout de suite de choisir le second.
  const [picking, setPicking] = useState<0 | 1 | null>(() => (!ids[0] ? 0 : !ids[1] ? 1 : null));
  const choose = (slot: 0 | 1, p: PlayerStats) => {
    setParams(prev => { const n = new URLSearchParams(prev); n.set(slot ? 'b' : 'a', String(p.id)); return n; }, { replace: true });
    setPicking(null);
  };
  const [A, B] = ids;
  const w = [A, B].map(p => (p ? windowStats(p, period, d.lastRound) : null));
  const keepers = A?.pos === 'G' || B?.pos === 'G';

  return (
    <div className="page">
      <NavBar title="Comparer" back="Retour" fallback="/joueurs" />
      <LargeTitle sub={<>barème du jeu <Estimate /></>}>Comparer</LargeTitle>

      <div className="cmp-heads">
        {[0, 1].map(i => {
          const p = ids[i];
          return (
            <button key={i} type="button" className="cmp-head card" style={{ boxShadow: `inset 0 3px 0 ${COLOR[i]}` }} onClick={() => setPicking(i as 0 | 1)}
              aria-label={p ? `Changer ${p.n}` : `Choisir le joueur ${i + 1}`}>
              {p ? (
                <>
                  <Avatar name={p.n} club={p.club} id={p.id} size={52} />
                  <span className="strong ellipsis">{p.n}</span>
                  <span className="small muted ellipsis"><Crest club={p.club} size={14} /> {POSITION[p.pos]} · {p.club}</span>
                  <span className="tiny cmp-change">Changer</span>
                </>
              ) : (
                <><span className="cmp-plus"><Icon name="player" size={24} /></span><span className="strong">Choisir un joueur</span></>
              )}
            </button>
          );
        })}
      </div>

      {A && B ? (
        <>
          <div className="chips-row" role="group" aria-label="Période">
            {PERIODS.map(([k, l]) => <button key={String(k)} type="button" className={`toggle${period === k ? ' on' : ''}`} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
          </div>
          <Section title="Statistiques" meta={period === 'saison' ? `J1 à J${d.lastRound}` : `J${w[0]!.from} à J${w[0]!.to}`}>
            <Card className="flush">
              {STATS.filter(s => (!s.keepers || keepers) && (s.k !== 'prix' && s.k !== 'value' || A.prix != null || B.prix != null)).map(s => <StatRow key={s.k} s={s} a={w[0]!} b={w[1]!} pa={A} pb={B} />)}
            </Card>
            <p className="small muted">En gras, le meilleur des deux. La barre partage le total entre les deux joueurs.</p>
          </Section>
          <Section title="Points par journée" meta="saison">
            <Card><DuoChart a={A} b={B} rounds={d.lastRound} /></Card>
          </Section>
          <Group>
            {[A, B].map(p => <Link key={p.id} to={`/joueur/${p.id}`} className="row link"><Avatar name={p.n} club={p.club} id={p.id} /><span className="grow">Fiche de {p.n}</span><Icon name="right" size={18} /></Link>)}
          </Group>
        </>
      ) : <Empty>Choisissez deux joueurs pour les comparer.</Empty>}

      {picking != null && <Picker exclude={ids[picking ? 0 : 1]?.id} onPick={p => choose(picking, p)} onClose={() => setPicking(null)} />}
    </div>
  );
}

function StatRow({ s, a, b, pa, pb }: { s: Stat; a: WindowStats; b: WindowStats; pa: PlayerStats; pb: PlayerStats }) {
  const va = s.v(a, pa), vb = s.v(b, pb);
  const show = (w: WindowStats, v: number | null): ReactNode => (s.fmt ? s.fmt(w) : v == null ? '—' : num(v, s.d ?? 1));
  // Comparé à l'arrondi affiché : deux « 25,5 » ne désignent pas de meilleur.
  const r = (v: number) => Math.round(v * 10 ** (s.d ?? 1));
  const best = va == null || vb == null || r(va) === r(vb) ? -1 : (va > vb) !== !!s.low ? 0 : 1;
  const tot = Math.max(0, va ?? 0) + Math.max(0, vb ?? 0);
  const share = tot ? Math.max(0, va ?? 0) / tot : 0.5;
  return (
    <div className="cmp-stat">
      <div className="cmp-line">
        <span className={`num-sm${best === 0 ? ' strong' : ' muted'}`}>{show(a, va)}</span>
        <span className="small">{s.label}</span>
        <span className={`num-sm right${best === 1 ? ' strong' : ' muted'}`}>{show(b, vb)}</span>
      </div>
      <div className="cmp-bar" aria-hidden="true">
        <i style={{ width: `${share * 100}%`, background: COLOR[0] }} />
        <i style={{ width: `${(1 - share) * 100}%`, background: COLOR[1] }} />
      </div>
    </div>
  );
}

/** Deux courbes de points par journée ; toucher une journée affiche les deux valeurs. */
function DuoChart({ a, b, rounds }: { a: PlayerStats; b: PlayerStats; rounds: number }) {
  const series = [a, b].map(p => windowStats(p, 'saison', rounds).series);
  const [sel, setSel] = useState<number | null>(null);
  const W = 340, H = 170, l = 26, r = 8, t = 10, bt = 22;
  const vals = series.flat().filter((v): v is number => v != null);
  const max = Math.max(10, ...vals), min = Math.min(0, ...vals);
  const x = (i: number) => l + (i * (W - l - r)) / Math.max(1, rounds - 1);
  const y = (v: number) => t + ((max - v) * (H - t - bt)) / (max - min);
  const path = (s: (number | null)[]) => {
    let d = '', on = false;
    s.forEach((v, i) => { if (v == null) { on = false; return; } d += `${on ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; on = true; });
    return d;
  };
  // Le minimum (négatif) n'a son repère que s'il est assez loin de zéro pour ne pas chevaucher l'étiquette « 0 ».
  const ticks = [...(min < -0.15 * max ? [min] : []), 0, max / 2, max];
  return (
    <div className="duo">
      <div className="legend-row small">{[a, b].map((p, i) => <span key={p.id}><i style={{ background: COLOR[i] }} />{p.n}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Points par journée : ${a.n} et ${b.n}`}>
        {ticks.map(v => <g key={v}><line x1={l} x2={W - r} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={l - 6} y={y(v) + 3} textAnchor="end" className="pc-axis">{Math.round(v)}</text></g>)}
        {Array.from({ length: rounds }, (_, i) => (i % 2 === 0 || i === rounds - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="pc-axis">J{i + 1}</text>)}
        {sel != null && <line x1={x(sel)} x2={x(sel)} y1={t} y2={H - bt} stroke="var(--muted)" strokeDasharray="3 3" />}
        {series.map((s, k) => <path key={k} d={path(s)} fill="none" stroke={COLOR[k]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        {series.map((s, k) => s.map((v, i) => v != null && <circle key={`${k}-${i}`} cx={x(i)} cy={y(v)} r={sel === i ? 5 : 3.5} fill={COLOR[k]} stroke="var(--surface)" strokeWidth="2" />))}
        {Array.from({ length: rounds }, (_, i) => (
          <rect key={i} x={x(i) - (W - l - r) / rounds / 2} y={t} width={(W - l - r) / rounds} height={H - t - bt} fill="transparent" onClick={() => setSel(sel === i ? null : i)} />
        ))}
      </svg>
      <p className="small bump-tip" aria-live="polite">
        {sel != null ? <><strong>J{sel + 1}</strong> · {a.n} : {series[0][sel] == null ? 'n\'a pas joué' : `${num(series[0][sel]!, 0)} pts`} · {b.n} : {series[1][sel] == null ? 'n\'a pas joué' : `${num(series[1][sel]!, 0)} pts`}</>
          : <span className="muted">Touchez une journée pour voir les points des deux joueurs.</span>}
      </p>
    </div>
  );
}

function Picker({ exclude, onPick, onClose }: { exclude?: number; onPick: (p: PlayerStats) => void; onClose: () => void }) {
  const { players } = useData();
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const list = useMemo(() => {
    const words = norm(q.trim()).split(/\s+/).filter(Boolean);
    return players.filter(p => p.apps > 0 && p.id !== exclude && words.every(w => norm(`${p.n} ${p.full ?? ''} ${p.club}`).includes(w)))
      .sort((a, b) => b.pts - a.pts).slice(0, 30);
  }, [q, players, exclude]);
  return (
    <div className="sheet-backdrop top" onClick={onClose}>
      <div className="search" role="dialog" aria-label="Choisir un joueur" onClick={e => e.stopPropagation()}>
        <div className="search-head">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input ref={input} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nom du joueur ou club"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          </label>
          <button className="textbtn" onClick={onClose}>Annuler</button>
        </div>
        <div className="search-res">
          <div className="group">
            {list.map(p => (
              <button key={p.id} className="row link" onClick={() => onPick(p)}>
                <Avatar name={p.n} club={p.club} id={p.id} />
                <span className="grow ellipsis">{p.n}<small className="muted block">{POSITION[p.pos]} · {p.club} · {num(p.ptsAvg)} pts/match</small></span>
              </button>
            ))}
            {!list.length && <p className="muted small pad">Aucun joueur.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
