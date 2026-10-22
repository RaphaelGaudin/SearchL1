import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LargeTitle, NavBar, Star, SuperSubBadge } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar, PlayerName } from '../components/PlayerRow.tsx';
import { Chip, Empty } from '../components/ui.tsx';
import { CLUB_NAMES } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { useFavorites } from '../lib/favorites.ts';
import { norm, num, POSITION, POSITIONS } from '../lib/format.ts';
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
  const [sheet, setSheet] = useState<'filtres' | 'tri' | null>(null);
  // Filtres actifs, montrés en pastilles qu'on retire d'un toucher.
  const active: { k: string; label: string }[] = [
    ...(!V.pos && pos !== 'all' ? [{ k: 'poste', label: POSITIONS[pos] }] : []),
    ...(club !== 'all' ? [{ k: 'club', label: club }] : []),
    ...(role !== 'all' ? [{ k: 'role', label: role === 'tit' ? 'Plutôt titulaires' : 'Plutôt remplaçants' }] : []),
    ...(minSel !== 'auto' ? [{ k: 'min', label: MIN_OPTS.find(o => o[0] === minSel)![1].replace('Tous les temps de jeu', 'Tout temps de jeu') }] : []),
    ...(only ? [{ k: 'seul', label: only === 'dispo' ? 'Disponibles' : only === 'ss' ? 'Bons supersubs' : 'Favoris' }] : []),
  ];

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

      <div className="chips-row views-row" role="tablist" aria-label="Vue">
        {Object.entries(VIEWS).map(([k, v]) => (
          <button key={k} role="tab" aria-selected={view === k} className={`toggle${view === k ? ' on' : ''}`}
            onClick={() => { const p = new URLSearchParams(params); if (k === 'synthese') p.delete('vue'); else p.set('vue', k); p.delete('tri'); setParams(p, { replace: true }); }}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="action-row">
        <button className="glass-pill filter-btn" onClick={() => setSheet('filtres')} aria-haspopup="dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          Filtres{active.length > 0 && <span className="badge-count">{active.length}</span>}
        </button>
        <button className="glass-pill" onClick={() => setSheet('tri')} aria-haspopup="dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16m0 0-4-4m4 4 4-4M16 20V4m0 0-4 4m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {S[sort].label}
        </button>
      </div>
      {active.length > 0 && (
        <div className="chips-row" aria-label="Filtres actifs">
          {active.map(f => <button key={f.k} className="toggle on removable" onClick={() => set(f.k, null)} aria-label={`Retirer le filtre ${f.label}`}>{f.label} <span aria-hidden="true">×</span></button>)}
        </div>
      )}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet glass" role="dialog" aria-label={sheet === 'tri' ? 'Trier les joueurs' : 'Filtrer les joueurs'} onClick={e => e.stopPropagation()}>
            <div className="grab" />
            {sheet === 'tri' ? (
              <>
                <h2 className="sheet-title">Trier par</h2>
                <div className="group sheet-list">
                  {[...new Set([V.main, ...SORTS])].map(k => (
                    <button key={k} className="row link" aria-pressed={sort === k} onClick={() => { set('tri', k, V.main); setSheet(null); }}>
                      <span className="grow">{S[k].label}</span>{sort === k && <span className="accent strong">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="sheet-title">Filtres</h2>
                <div className="sheet-body">
                  {!V.pos && (
                    <Field label="Poste">
                      <Chips value={pos} options={[['all', 'Tous'], ...Object.entries(POSITIONS) as [string, string][]]} onPick={v => set('poste', v, 'all')} />
                    </Field>
                  )}
                  <Field label="Club">
                    <label className="select"><select value={club} onChange={e => set('club', e.target.value, 'all')} aria-label="Club">
                      <option value="all">Tous les clubs</option>
                      {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                    </select><Icon name="down" size={18} /></label>
                  </Field>
                  <Field label="Rôle">
                    <Chips value={role} options={[['all', 'Tous'], ['tit', 'Plutôt titulaires'], ['remp', 'Plutôt remplaçants']]} onPick={v => set('role', v, 'all')} />
                  </Field>
                  <Field label="Temps de jeu">
                    <Chips value={minSel} options={MIN_OPTS.map(([k, l]) => [k, l.replace('Temps de jeu : ', '').replace('Tous les temps de jeu', 'Tous')] as [string, string])} onPick={v => set('min', v, 'auto')} />
                  </Field>
                  <Field label="Afficher seulement">
                    <div className="chips-wrap">
                      {[['dispo', 'Disponibles'], ['ss', 'Bons supersubs'], ['fav', 'Favoris']].map(([k, l]) => (
                        <button key={k} className={`toggle${only === k ? ' on' : ''}`} aria-pressed={only === k} onClick={() => set('seul', only === k ? null : k)}>
                          {k === 'fav' && <Star filled={only === k} size={15} />}{k === 'ss' && <SuperSubBadge small />}{l}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="sheet-actions">
                  <button className="textbtn" onClick={() => { const p = new URLSearchParams(params); ['poste', 'club', 'role', 'min', 'seul'].forEach(k => p.delete(k)); setParams(p, { replace: true }); }}>Réinitialiser</button>
                  <button className="primary-btn" onClick={() => setSheet(null)}>Voir {rows.length} joueurs</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="cards">
        {rows.slice(0, limit).map(({ p, s: w }) => (
          <Link key={p.id} to={`/joueur/${p.id}`} className="pcard">
            <div className="pcard-head">
              <Avatar name={p.n} club={p.club} id={p.id} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><span className="small muted">{label}</span>{children}</div>;
}

function Chips({ value, options, onPick }: { value: string; options: [string, string][]; onPick: (v: string) => void }) {
  return (
    <div className="chips-wrap" role="radiogroup">
      {options.map(([k, l]) => <button key={k} role="radio" aria-checked={value === k} className={`toggle${value === k ? ' on' : ''}`} onClick={() => onPick(k)}>{l}</button>)}
    </div>
  );
}
