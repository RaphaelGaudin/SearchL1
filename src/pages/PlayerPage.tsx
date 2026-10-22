import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { FavButton, NavBar, SuperSubBadge } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar } from '../components/PlayerRow.tsx';
import { PointsChart } from '../components/PointsChart.tsx';
import { PointsDetail } from '../components/PointsDetail.tsx';
import { PositionCompare } from '../components/PositionCompare.tsx';
import { Card, Chip, Empty, Estimate, Group, Section, SubNav } from '../components/ui.tsx';
import { useData } from '../lib/data.tsx';
import { dayShort, num, POSITION, signed, time } from '../lib/format.ts';
import { windowStats } from '../lib/model.ts';

const ABS = { B: ['down', 'Blessé'], S: ['down', 'Suspendu'], D: ['warn', 'Incertain'], C: ['neutral', 'Non retenu'] } as const;

export function PlayerPage() {
  const { id } = useParams();
  const d = useData();
  const navigate = useNavigate();
  const p = d.playerById.get(Number(id));
  if (!p) return <div className="page"><NavBar title="Joueur" back="Joueurs" fallback="/joueurs" /><Empty>Joueur introuvable.</Empty></div>;

  const season = windowStats(p, 'saison', d.lastRound);
  const w5 = windowStats(p, 5, d.lastRound);
  const w3 = windowStats(p, 3, d.lastRound);
  const trend = p.trend;
  const trendLabel = trend == null ? null : trend >= 2 ? ['accent', 'En forme'] : trend <= -2 ? ['down', 'En baisse'] : ['neutral', 'Stable'];
  const mates = d.players.filter(x => x.club === p.club && x.id !== p.id && x.apps > 0).sort((a, b) => b.min - a.min);
  const upcoming = d.matches.filter(m => m.status !== 'finished' && (m.h === p.club || m.a === p.club)).slice(0, 3);
  const logs = [...p.logs].sort((a, b) => b.j - a.j);
  const cmp: [string, (s: typeof season) => string][] = [
    ['Points par match', s => num(s.ptsAvg)], ['Matchs (titul.)', s => `${s.apps} (${s.starts})`], ['Minutes', s => String(s.min)],
    ['Buts / passes', s => `${s.g} / ${s.a}`], ['Note L\'Équipe moy.', s => num(s.noteAvg)],
    ['· équipe', s => num(s.src.team)], ['· note', s => num(s.src.note)], ['· actions', s => num(s.src.actions)], ['· défense', s => num(s.src.defense)], ['· cartons', s => num(s.src.cards)],
  ];
  const byPos: [string, string][] = p.pos === 'G'
    ? [['Arrêts', String(season.sav)], ['Buts encaissés', num(season.conc, 0)], ['% d\'arrêts', season.savePct != null ? `${Math.round(season.savePct * 100)} %` : '—'], ['Buts évités', num(season.gp)], ['Clean sheets', String(season.cs)]]
    : p.pos === 'D'
      ? [['Tacles réussis', String(season.tk)], ['Interceptions', String(season.int)], ['Clean sheets', String(season.cs)], ['Cartons', `${season.y} J · ${season.rc} R`]]
      : [['xG / xA', `${num(season.xg)} / ${num(season.xa)}`], ['Passes clés', String(season.kp)], ['Penalties marqués', String(season.pen)], ['Tacles réussis', String(season.tk)], ['Cartons', `${season.y} J · ${season.rc} R`]];

  return (
    <div className="page">
      <NavBar title={p.n} back="Retour" fallback="/joueurs" right={<FavButton kind="player" id={p.id} label={p.n} />} />

      <header className="entity-head">
        <Avatar name={p.n} club={p.club} size={64} />
        <div className="grow">
          <h1 className="h1-sm">{p.n}</h1>
          <Link to={`/club/${encodeURIComponent(p.club)}`} className="club-link"><Crest club={p.club} size={18} /> {POSITION[p.pos]} · {p.club}</Link>
          <div className="chips-inline">
            {p.superSub && <Chip tone="accent"><SuperSubBadge small subAvg={p.subAvg} /> Bon supersub · {num(p.subAvg)} pts/entrée</Chip>}
            {p.absence && <Chip tone={ABS[p.absence.type][0]}>{ABS[p.absence.type][1]} · {p.absence.why}</Chip>}
          </div>
        </div>
      </header>

      <SubNav items={[['resume', 'Résumé'], ['compare', 'Comparatif'], ['points', 'Points'], ['matchs', 'Match par match'], ['avenir', 'À venir'], ['equipe', 'Coéquipiers']]} />

      <Section title="Résumé" meta={<>saison <Estimate /></>} id="resume">
        <div className="tiles">
          <div className="tile"><b className="num-lg accent">{num(season.ptsAvg)}</b><span className="small muted">pts/match</span></div>
          <div className="tile"><b className="num-lg">{season.apps}</b><span className="small muted">{season.starts} tit. · {season.subs} entr.</span></div>
          <div className="tile"><b className="num-lg">{season.g}<span className="muted"> / </span>{season.a}</b><span className="small muted">buts / passes</span></div>
        </div>
        {trendLabel && (
          <div className="trend-line">
            <Chip tone={trendLabel[0] as 'accent'}>{trend! >= 2 ? '↑' : trend! <= -2 ? '↓' : '='} {trendLabel[1]}</Chip>
            <span className="small muted">3 derniers matchs : {num(p.l3Avg)} pts/match ({signed(trend!, 1)} par rapport à la saison)</span>
          </div>
        )}
        <details className="more-stats card flush">
          <summary className="row link"><span className="grow strong">Toutes les stats</span><span className="small muted">{num(season.pts, 0)} pts · {season.min} min · note {num(season.noteAvg)}</span><Icon name="down" size={16} /></summary>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th className="l sticky">Moyennes</th><th>Saison</th><th>5 J</th><th>3 J</th></tr></thead>
              <tbody>{cmp.map(([k, f]) => <tr key={k}><td className="l sticky">{k}</td><td>{f(season)}</td><td>{f(w5)}</td><td>{f(w3)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="more-pos">
            <div className="row tight"><span className="grow muted">Points au total</span><span className="num-sm">{num(season.pts, 0)}</span></div>
            <div className="row tight"><span className="grow muted">Minutes jouées</span><span className="num-sm">{season.min}</span></div>
            {byPos.map(([k, v]) => <div key={k} className="row tight"><span className="grow muted">{k}</span><span className="num-sm">{v}</span></div>)}
          </div>
        </details>
      </Section>

      <Section title={`Comparé aux ${{ G: 'gardiens', D: 'défenseurs', M: 'milieux', A: 'attaquants' }[p.pos]}`} meta="saison" id="compare">
        <Card><PositionCompare key={p.id} player={p} /></Card>
      </Section>

      <Section title="Points par match" meta="empilés par source" id="points">
        <Card><PointsChart logs={p.logs} rounds={d.lastRound} byId={d.byId} club={p.club} /></Card>
      </Section>

      <Section title="Match par match" id="matchs">
        <Group>
          {logs.map(L => {
            const m = d.byId.get(L.match);
            if (!m) return null;
            const opp = L.home ? m.a : m.h;
            const res = L.gf > L.ga ? 'V' : L.gf < L.ga ? 'D' : 'N';
            return (
              <details key={L.match} className="row-details">
                <summary className="row link">
                  <span className="jtag num-sm muted">J{L.j}</span>
                  <Crest club={opp} size={20} />
                  <span className="grow ellipsis"><span className="strong">{L.home ? 'vs' : 'à'} {opp}</span>
                    <small className="muted block"><span className={`res-${res}`}>{res} {m.hg}-{m.ag}</span> · {L.lu ? (L.min ? `${L.sub ? 'entré' : 'titulaire'} · ${L.min}'` : 'non entré') : 'feuille incomplète'}{L.P.noteLE != null ? ` · note ${L.P.noteLE}` : ''}</small></span>
                  <span className={`num-md ${Math.round(L.P.total) < 0 ? 'down' : ''}`}>{num(L.P.total, 0)}</span>
                </summary>
                <PointsDetail L={L} pos={p.pos} />
              </details>
            );
          })}
          {!logs.length && <Empty>Pas encore de match joué.</Empty>}
        </Group>
      </Section>

      <Section title="Prochains matchs" id="avenir">
        <Group>
          {upcoming.map(m => {
            const pr = d.predictions.get(m.id);
            const home = m.h === p.club;
            const win = pr ? (home ? pr.H : pr.A) : null;
            const cs = pr ? (home ? pr.csH : pr.csA) : null;
            return (
              <Link key={m.id} to={`/match/${m.id}`} className="row link">
                <span className="jtag num-sm muted">J{m.j}</span>
                <Crest club={home ? m.a : m.h} size={20} />
                <span className="grow ellipsis"><span className="strong">{home ? 'vs' : 'à'} {home ? m.a : m.h}</span>
                  <small className="muted block">{dayShort(m.d)} {time(m.d)}{cs != null && (p.pos === 'G' || p.pos === 'D') ? ` · clean sheet ${Math.round(cs * 100)} %` : ''}</small></span>
                {win != null && <span className="right-stack"><span className="num-md">{Math.round(win * 100)} %</span><span className="tiny muted">victoire</span></span>}
              </Link>
            );
          })}
          {!upcoming.length && <Empty>Plus de match de L1 à venir.</Empty>}
        </Group>
      </Section>

      <Section title={`Coéquipiers à ${p.club}`} id="equipe">
        <div className="rail people">
          {mates.map(x => (
            <button key={x.id} className="rail-item" onClick={() => navigate(`/joueur/${x.id}`, { replace: true })}>
              <Avatar name={x.n} club={x.club} size={40} />
              <span className="tiny ellipsis">{x.n}</span>
              <span className="tiny muted">{num(x.ptsAvg)}</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
