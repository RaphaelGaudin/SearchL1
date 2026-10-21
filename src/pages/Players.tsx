import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LargeTitle, NavBar, Star, SuperSubBadge } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar, PlayerName } from '../components/PlayerRow.tsx';
import { Chip, Empty } from '../components/ui.tsx';
import { CLUB_NAMES } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { useFavorites } from '../lib/favorites.ts';
import { norm, num, POSITION } from '../lib/format.ts';
import { PERIODS, windowStats, type Period, type PlayerStats, type WindowStats } from '../lib/model.ts';

type Stat = { label: string; v: (s: WindowStats, p: PlayerStats) => number | null; d?: number; fmt?: (x: number) => string };
const pctFmt = (x: number) => `${Math.round(x * 100)} %`;
const S: Record<string, Stat> = {
  ptsAvg: { label: 'pts/match', v: s => s.ptsAvg },
  pts: { label: 'points', v: s => s.pts, d: 0 },
  apps: { label: 'matchs', v: s => s.apps, d: 0 },
  min: { label: 'minutes', v: s => s.min, d: 0 },
  g: { label: 'buts', v: s => s.g, d: 0 },
  a: { label: 'passes', v: s => s.a, d: 0 },
  note: { label: 'note moy.', v: s => s.noteAvg },
  team: { label: 'équipe', v: s => s.src.team }, noteP: { label: 'note', v: s => s.src.note }, actions: { label: 'actions', v: s => s.src.actions },
  defense: { label: 'défense', v: s => s.src.defense }, cards: { label: 'cartons', v: s => s.src.cards },
  sav: { label: 'arrêts', v: s => s.sav, d: 0 }, conc: { label: 'encaissés', v: s => s.conc, d: 0 }, cs: { label: 'clean sheets', v: s => s.cs, d: 0 },
  savePct: { label: '% arrêts', v: s => s.savePct, fmt: pctFmt }, gp: { label: 'buts évités', v: s => s.gp },
  tk: { label: 'tacles', v: s => s.tk, d: 0 }, int: { label: 'interc.', v: s => s.int, d: 0 }, y: { label: 'jaunes', v: s => s.y, d: 0 },
  rc: { label: 'rouges', v: s => s.rc, d: 0 }, og: { label: 'csc', v: s => s.og, d: 0 }, pen: { label: 'penalties', v: s => s.pen, d: 0 },
  xg: { label: 'xG', v: s => s.xg }, xa: { label: 'xA', v: s => s.xa }, kp: { label: 'passes clés', v: s => s.kp, d: 0 },
  subAvg: { label: 'pts/entrée', v: s => s.subAvg }, subs: { label: 'entrées', v: s => s.subs, d: 0 }, starts: { label: 'titul.', v: s => s.starts, d: 0 },
  trend: { label: 'tendance', v: (_, p) => p.trend },
};

const VIEWS: Record<string, { label: string; main: string; cols: string[]; pos?: string }> = {
  synthese: { label: 'Synthèse', main: 'ptsAvg', cols: ['apps', 'g', 'a', 'note'] },
  forme: { label: 'Forme', main: 'ptsAvg', cols: [] },
  points: { label: 'Points par source', main: 'ptsAvg', cols: ['team', 'noteP', 'actions', 'defense', 'cards'] },
  gardiens: { label: 'Gardiens', main: 'ptsAvg', cols: ['sav', 'conc', 'cs', 'savePct', 'gp'], pos: 'G' },
  defense: { label: 'Défense', main: 'ptsAvg', cols: ['tk', 'int', 'cs', 'g', 'a', 'y'] },
  attaque: { label: 'Attaque', main: 'g', cols: ['pen', 'a', 'xg', 'xa', 'kp'] },
  discipline: { label: 'Discipline', main: 'y', cols: ['rc', 'og', 'cards'] },
  supersubs: { label: 'Supersubs', main: 'subAvg', cols: ['subs', 'starts', 'g', 'a'] },
};
const SORTS = ['ptsAvg', 'pts', 'trend', 'subAvg', 'g', 'a', 'note', 'min', 'tk', 'sav', 'cs', 'xg', 'xa', 'kp', 'y'];
const MIN_OPTS: [string, string][] = [['auto', 'Temps de jeu : auto'], ['0', 'Tous les temps de jeu'], ['90', '90 min et +'], ['270', '270 min et +'], ['450', '450 min et +']];

export function Players() {
  const d = useData();
  const fav = useFavorites();
  const [params, setParams] = useSearchParams();
  const get = (k: string, def: string) => params.get(k) ?? def;
  const set = (k: string, v: string | null, def?: string) => {
    const p = new URLSearchParams(params);
    if (v == null || v === def) p.delete(k); else p.set(k, v);
    setParams(p, { replace: true });
  };
  const view = get('vue', 'synthese');
  const V = VIEWS[view] ?? VIEWS.synthese;
  const periodRaw = get('periode', 'saison');
  const period: Period = periodRaw === 'saison' ? 'saison' : (Number(periodRaw) as Period);
  const pos = V.pos ?? get('poste', 'all');
  const club = get('club', 'all');
  const role = get('role', 'all');
  const minSel = get('min', 'auto');
  const only = get('seul', '');
  const sort = get('tri', V.main);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);

  const rows = useMemo(() => {
    const span = period === 'saison' ? d.lastRound : Math.min(period, d.lastRound);
    const minMin = minSel === 'auto' ? Math.round(span * 90 * 0.2) : Number(minSel);
    const s = norm(q.trim());
    return d.players
      .map(p => ({ p, s: windowStats(p, period, d.lastRound) }))
      .filter(({ p, s: w }) =>
        w.apps > 0 && (pos === 'all' || p.pos === pos) && (club === 'all' || p.club === club) &&
        (view === 'supersubs' ? w.subs > 0 : w.min >= minMin || (view === 'discipline' && w.y + w.rc > 0)) &&
        (role === 'all' || (role === 'tit' ? w.starts >= w.subs : w.subs > w.starts)) &&
        (only !== 'dispo' || !p.absence) && (only !== 'ss' || p.superSub) && (only !== 'fav' || fav.isPlayer(p.id)) &&
        (!s || norm(`${p.n} ${p.club}`).includes(s)))
      .sort((a, b) => (S[sort].v(b.s, b.p) ?? -Infinity) - (S[sort].v(a.s, a.p) ?? -Infinity));
  }, [d, period, pos, club, role, minSel, only, sort, q, view, fav]);

  const clubs = [...CLUB_NAMES].sort((a, b) => a.localeCompare(b, 'fr'));
  const fmt = (k: string, w: WindowStats, p: PlayerStats) => {
    const st = S[k], v = st.v(w, p);
    return v == null ? '—' : st.fmt ? st.fmt(v) : num(v, st.d ?? 1);
  };

  return (
    <div className="page">
      <NavBar title="Joueurs" />
      <LargeTitle sub={`${rows.length} joueurs · ${PERIODS.find(x => x.k === period)!.label.toLowerCase()}`}>Joueurs</LargeTitle>

      <label className="search-field inline">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={e => { setQ(e.target.value); setLimit(50); }} placeholder="Nom ou club" autoComplete="off" autoCorrect="off" spellCheck={false} />
      </label>

      <div className="seg glass-seg" role="tablist" aria-label="Période">
        {PERIODS.map(x => <button key={String(x.k)} role="tab" aria-selected={period === x.k} onClick={() => set('periode', String(x.k), 'saison')}>{x.short}</button>)}
      </div>

      <div className="chips-row" role="toolbar" aria-label="Filtres">
        <label className="select small-select"><select value={view} onChange={e => { const p = new URLSearchParams(params); p.set('vue', e.target.value); p.delete('tri'); setParams(p, { replace: true }); }} aria-label="Vue">
          {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select><Icon name="down" size={16} /></label>
        <label className="select small-select"><select value={sort} onChange={e => set('tri', e.target.value, V.main)} aria-label="Trier par">
          {[...new Set([V.main, ...SORTS])].map(k => <option key={k} value={k}>Tri : {S[k].label}</option>)}
        </select><Icon name="down" size={16} /></label>
        {!V.pos && (
          <label className="select small-select"><select value={pos} onChange={e => set('poste', e.target.value, 'all')} aria-label="Poste">
            <option value="all">Tous postes</option>
            {Object.entries(POSITION).map(([k, l]) => <option key={k} value={k}>{l}s</option>)}
          </select><Icon name="down" size={16} /></label>
        )}
        <label className="select small-select"><select value={club} onChange={e => set('club', e.target.value, 'all')} aria-label="Club">
          <option value="all">Tous clubs</option>
          {clubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select><Icon name="down" size={16} /></label>
        <label className="select small-select"><select value={role} onChange={e => set('role', e.target.value, 'all')} aria-label="Titulaire ou remplaçant">
          <option value="all">Titulaires et remplaçants</option><option value="tit">Plutôt titulaires</option><option value="remp">Plutôt remplaçants</option>
        </select><Icon name="down" size={16} /></label>
        <label className="select small-select"><select value={minSel} onChange={e => set('min', e.target.value, 'auto')} aria-label="Temps de jeu minimum">
          {MIN_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select><Icon name="down" size={16} /></label>
      </div>
      <div className="chips-row" role="group" aria-label="Afficher seulement">
        {[['dispo', 'Disponibles'], ['ss', 'Bons supersubs'], ['fav', 'Favoris']].map(([k, l]) => (
          <button key={k} className={`toggle${only === k ? ' on' : ''}`} aria-pressed={only === k} onClick={() => set('seul', only === k ? null : k)}>
            {k === 'fav' && <Star filled={only === k} size={15} />}{k === 'ss' && <SuperSubBadge small />}{l}
          </button>
        ))}
      </div>

      <div className="cards">
        {rows.slice(0, limit).map(({ p, s: w }) => (
          <Link key={p.id} to={`/joueur/${p.id}`} className="pcard">
            <div className="pcard-head">
              <Avatar name={p.n} club={p.club} />
              <span className="grow ellipsis">
                <PlayerName p={p} />
                <small className="muted block ellipsis">{POSITION[p.pos]} · {p.club} · {w.starts} tit.{w.subs ? ` · ${w.subs} entrée${w.subs > 1 ? 's' : ''}` : ''}</small>
              </span>
              {fav.isPlayer(p.id) && <span className="fav-mark" aria-label="Favori"><Star filled size={14} /></span>}
              {p.absence && <Chip tone={p.absence.type === 'D' ? 'warn' : 'down'}>{p.absence.type === 'S' ? 'Suspendu' : p.absence.type === 'D' ? 'Incertain' : p.absence.type === 'C' ? 'Absent' : 'Blessé'}</Chip>}
              <span className="right-stack"><span className="num-md">{fmt(sort, w, p)}</span><span className="tiny muted">{S[sort].label}</span></span>
            </div>
            {view === 'forme' ? (
              <div className="formgrid" aria-label="Points par journée">
                {w.series.map((v, i) => <span key={i} className={`fcell ${v == null ? 'na' : v >= 15 ? 'f4' : v >= 8 ? 'f3' : v >= 2 ? 'f2' : v >= -2 ? 'f1' : 'f0'}`} title={`J${w.from + i} : ${v == null ? 'n\'a pas joué' : num(v, 0) + ' pts'}`}>{v == null ? '' : Math.round(v)}</span>)}
              </div>
            ) : V.cols.length > 0 && (
              <dl className="minis">
                {V.cols.filter(k => k !== sort).map(k => <div key={k}><dt>{S[k].label}</dt><dd>{fmt(k, w, p)}</dd></div>)}
              </dl>
            )}
          </Link>
        ))}
        {!rows.length && <Empty>Aucun joueur avec ces filtres.</Empty>}
      </div>
      {rows.length > limit && <button className="glass-pill wide" onClick={() => setLimit(l => l + 50)}>Afficher 50 joueurs de plus</button>}
      {view === 'forme' && <p className="small muted">Une case par journée : points estimés, du rouge (négatif) au vert foncé (15 et plus). Case vide : n'a pas joué.</p>}
    </div>
  );
}
