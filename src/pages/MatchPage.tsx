import { useMemo, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { NavBar } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar, PlayerName } from '../components/PlayerRow.tsx';
import { PointsDetail } from '../components/PointsDetail.tsx';
import { Card, Chip, Empty, Estimate, Form, Group, ProbBar, Row, Section, SubNav, pcts, type Tone } from '../components/ui.tsx';
import { useData } from '../lib/data.tsx';
import { CUP_LONG, CUP_SHORT, dayShort, num, parisDay, POSITION, signed, time } from '../lib/format.ts';
import type { Data, PlayerStats, ScoredLog } from '../lib/model.ts';
import type { Prediction, StepKey } from '../lib/predict.ts';
import { buildTable } from '../lib/standings.ts';
import type { Match } from '../lib/types.ts';

const ABS = { B: ['down', 'Blessé'], S: ['down', 'Suspendu'], D: ['warn', 'Incertain'], C: ['neutral', 'Non retenu'] } as const;

export function MatchPage() {
  const { id } = useParams();
  const d = useData();
  const navigate = useNavigate();
  const m = d.byId.get(Number(id));
  const played = m?.status === 'finished';
  const touch = useRef<{ x: number; y: number } | null>(null);
  const pred = useMemo(() => (m ? (played ? d.predictBefore(m) : d.predictions.get(m.id)) : undefined), [m, played, d]);
  if (!m) return <div className="page"><Empty>Match introuvable.</Empty></div>;

  const round = (d.rounds.get(m.j) ?? []).slice().sort((a, b) => a.d.localeCompare(b.d) || a.id - b.id);
  const idx = round.findIndex(x => x.id === m.id);
  const prev = round[idx - 1], next = round[idx + 1];

  const sections: [string, string][] = [
    ['prono', 'Pronostic'],
    ...(played ? [['points', 'Points'] as [string, string]] : []),
    ['coupes', 'Coupes'], ['h2h', 'Face-à-face'], ['saison', 'Saison'], ['joueurs', 'Joueurs'],
  ];

  // Glisser à gauche / à droite (loin du bord gauche, réservé au retour) : match suivant / précédent.
  const swipe = (e: React.TouchEvent) => {
    const t0 = touch.current;
    const t = e.changedTouches[0];
    if (!t0 || t0.x < 30) return;
    const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 40) {
      const target = dx < 0 ? next : prev;
      if (target) navigate(`/match/${target.id}`, { replace: true });
    }
  };
  return (
    <div className="page match-page"
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={swipe}>
      <NavBar title={`${m.h} – ${m.a}`} back="Matchs" fallback={`/matchs?j=${m.j}`} right={
        <span className="glass-group">
          <button disabled={!prev} onClick={() => prev && navigate(`/match/${prev.id}`, { replace: true })} aria-label="Match précédent de la journée"><Icon name="left" size={18} /></button>
          <span className="num-sm" aria-label={`Match ${idx + 1} sur ${round.length}`}>{idx + 1}/{round.length}</span>
          <button disabled={!next} onClick={() => next && navigate(`/match/${next.id}`, { replace: true })} aria-label="Match suivant de la journée"><Icon name="right" size={18} /></button>
        </span>
      } />

      <div className="hero">
        <Link to={`/club/${encodeURIComponent(m.h)}`} className="hero-team"><Crest club={m.h} size={56} /><span className="strong">{m.h}</span></Link>
        <div className="hero-mid">
          {played ? <span className="num-xl">{m.hg} – {m.ag}</span> : <span className="num-xl">{time(m.d)}</span>}
          <span className="small muted">{dayShort(m.d)} · J{m.j}</span>
        </div>
        <Link to={`/club/${encodeURIComponent(m.a)}`} className="hero-team"><Crest club={m.a} size={56} /><span className="strong">{m.a}</span></Link>
      </div>
      {played && m.goals && m.goals.length > 0 && (
        <div className="goals small">
          {/* Sofascore range un csc du côté de l'équipe qui en profite : la colonne suit le score. */}
          <div>{m.goals.filter(g => g.home).map((g, i) => <span key={i}>{g.scorer} {g.min}'{g.kind === 'penalty' ? ' (pen.)' : g.kind === 'own' ? ' (csc)' : ''}</span>)}</div>
          <div className="right">{m.goals.filter(g => !g.home).map((g, i) => <span key={i}>{g.scorer} {g.min}'{g.kind === 'penalty' ? ' (pen.)' : g.kind === 'own' ? ' (csc)' : ''}</span>)}</div>
        </div>
      )}

      <SubNav items={sections} />

      <div className="cols">
        <div>
          {pred && <Pronostic m={m} p={pred} played={played} />}
          {pred && <Factors m={m} p={pred} />}
          {played && <MatchPoints m={m} />}
        </div>
        <div>
          <Cups m={m} />
          <HeadToHead m={m} />
          <SeasonCompare m={m} />
          <KeyPlayers m={m} />
        </div>
      </div>
    </div>
  );
}

function Pronostic({ m, p, played }: { m: Match; p: Prediction; played: boolean }) {
  const [H, D, A] = pcts(p);
  return (
    <Section title="Pronostic" meta={played ? "calculé la veille du match" : 'estimation'} id="prono">
      <Card>
        <div className="tri">
          <div><b className="num-xl accent">{H} %</b><span className="small muted">{m.h}</span></div>
          <div className="center"><b className="num-xl muted">{D} %</b><span className="small muted">Nul</span></div>
          <div className="right"><b className="num-xl">{A} %</b><span className="small muted">{m.a}</span></div>
        </div>
        <ProbBar {...p} big />
        <dl className="kv">
          <div><dt>Buts attendus</dt><dd className="num-sm">{num(p.lh, 2)} – {num(p.la, 2)}</dd></div>
          <div><dt>Score le plus probable</dt><dd className="num-sm">{p.score[0]} – {p.score[1]}</dd></div>
          <div><dt>Clean sheet {m.h}</dt><dd className="num-sm">{Math.round(p.csH * 100)} %</dd></div>
          <div><dt>Clean sheet {m.a}</dt><dd className="num-sm">{Math.round(p.csA * 100)} %</dd></div>
        </dl>
      </Card>
    </Section>
  );
}

function Factors({ m, p }: { m: Match; p: Prediction }) {
  const d = useData();
  const isNext = m.j === d.nextRound && m.status !== 'finished';
  const f = (x: number) => num(x, 2);
  const absNames = (club: string) => (d.absByClub.get(club) ?? []).filter(a => a.type !== 'C').map(a => a.player.split(' ').slice(-1)[0]);
  const why: Record<StepKey, [string, ReactNode]> = {
    forces: ['Forces attaque / défense', <>Poisson sur 3 saisons, demi-vie 350 j · {m.h} att. {f(d.model.att[m.h] ?? 0)} déf. {f(d.model.def[m.h] ?? 0)} · {m.a} att. {f(d.model.att[m.a] ?? 0)} déf. {f(d.model.def[m.a] ?? 0)}</>],
    terrain: ['Avantage du terrain', <>{m.h} à domicile : ×{f(p.hbH)} par rapport à la moyenne de L1</>],
    forme: ['Forme récente', <>6 derniers matchs · {m.h} {p.fh.gf} buts marqués pour {num(p.fh.ef)} attendus · {m.a} {p.fa.gf} pour {num(p.fa.ef)}</>],
    h2h: ['Face-à-face', <>8 derniers matchs entre eux en L1 : ×{f(p.hm)} pour {m.h} (borné à ±7 %)</>],
    absents: ['Absents', isNext
      ? <>{m.h} att. ×{f(p.ah.att)} déf. ×{f(p.ah.def)}{absNames(m.h).length ? ` (${absNames(m.h).slice(0, 3).join(', ')})` : ''} · {m.a} att. ×{f(p.aa.att)} déf. ×{f(p.aa.def)}{absNames(m.a).length ? ` (${absNames(m.a).slice(0, 3).join(', ')})` : ''}</>
      : <>Compté seulement pour la prochaine journée, quand les absents sont connus</>],
    coupe: ['Coupe d\'Europe', p.rh < 1 || p.ra < 1
      ? <>{[p.rh < 1 && m.h, p.ra < 1 && m.a].filter(Boolean).join(' et ')} : match européen 3 jours avant ou moins (−3 %)</>
      : <>Pas de match européen dans les 3 jours avant</>],
  };
  return (
    <Section title={`D'où vient le ${pcts(p)[0]} %`} meta={`victoire ${m.h}`}>
      <Card className="flush">
        <div className="steps">
          {p.steps.map((s, i) => {
            const delta = i ? (s.H - p.steps[i - 1].H) * 100 : 0;
            const [title, text] = why[s.key];
            return (
              <details key={s.key} className="step-d">
                <summary className="step">
                  <span className="grow strong">{title}</span>
                  <span className={`num-md ${i === 0 ? '' : delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'muted'}`}>
                    {i === 0 ? `${Math.round(s.H * 100)} %` : Math.abs(delta) < 0.5 ? '=' : signed(delta, 0)}
                  </span>
                  <Icon name="down" size={16} />
                </summary>
                <p className="small muted step-text">{text}</p>
              </details>
            );
          })}
          <div className="step total">
            <span className="grow strong">Pronostic final</span>
            <span className="num-md accent">{pcts(p)[0]} %</span>
          </div>
        </div>
        <p className="small muted pad">Touchez un facteur pour voir le calcul. Écarts en points de pourcentage. Correction Dixon-Coles (rho = −0,05) sur les petits scores. Backtest sur 918 matchs de 2023-24 à 2025-26 : RPS 0,208 contre 0,233 pour un pronostic fixe.</p>
      </Card>
    </Section>
  );
}

function MatchPoints({ m }: { m: Match }) {
  const d = useData();
  // Côté domicile / extérieur pris dans la ligne du match : un joueur transféré depuis reste du bon côté.
  const rows = (club: string) => d.players
    .map(p => ({ p, L: p.logs.find(L => L.match === m.id) }))
    .filter((x): x is { p: PlayerStats; L: ScoredLog } => !!x.L && x.L.home === (club === m.h))
    .sort((a, b) => b.L.P.total - a.L.P.total);
  return (
    <Section title="Points des joueurs" meta={<>barème du jeu <Estimate /></>} id="points">
      {m.incomplete && <p className="small muted">Feuille de match incomplète : seuls les buts, passes et cartons sont comptés.</p>}
      {[m.h, m.a].map(club => (
        <div key={club} className="day">
          <h3 className="dayhead"><Crest club={club} size={18} /> {club}</h3>
          <Group>
            {rows(club).map(({ p, L }) => (
              <details key={p.id} className="row-details">
                <summary className="row link">
                  <Avatar name={p.n} club={club} id={p.id} />
                  <span className="grow ellipsis"><PlayerName p={p} />
                    <small className="muted block">{POSITION[p.pos]} · {L.sub ? 'remplaçant' : 'titulaire'} · {L.min}'{L.P.noteLE != null ? ` · note ${L.P.noteLE}` : ''}</small></span>
                  <span className={`num-md ${Math.round(L.P.total) < 0 ? 'down' : ''}`}>{num(L.P.total, 0)}</span>
                </summary>
                <PointsDetail L={L} pos={p.pos} />
                <Link to={`/joueur/${p.id}`} className="textlink detail-pad">Fiche de {p.n} ›</Link>
              </details>
            ))}
            {!rows(club).length && <Empty>Pas de stats joueurs pour ce match.</Empty>}
          </Group>
        </div>
      ))}
    </Section>
  );
}

function Cups({ m }: { m: Match }) {
  const d = useData();
  const list = [m.h, m.a].flatMap(c => d.cupsAround(c, m.d).map(x => ({ ...x, c })));
  return (
    <Section title="Coupes autour du match" meta="± 7 jours" id="coupes">
      <Group>
        {list.map(c => (
          <Row key={c.c + c.d}>
            <Chip tone={c.comp as Tone}>{CUP_SHORT[c.comp]}</Chip>
            <span className="grow"><span className="strong">{c.c} · {dayShort(c.d)}</span>
              <small className="muted block">{CUP_LONG[c.comp]} · {c.stage} · {c.tbd ? 'adversaire à tirer au sort' : `${c.home ? 'vs' : 'à'} ${c.opp}`} · {Math.abs(c.gap)} j {c.gap < 0 ? 'avant' : 'après'}</small></span>
            {c.gf != null && <span className="num-sm">{c.gf}–{c.ga}</span>}
          </Row>
        ))}
        {!list.length && <Empty>Aucun match de coupe à 7 jours ou moins.</Empty>}
      </Group>
    </Section>
  );
}

function record(list: { h: string; hg: number; ag: number }[], club: string) {
  const o = { w: 0, d: 0, l: 0 };
  list.forEach(x => { const gf = x.h === club ? x.hg : x.ag, ga = x.h === club ? x.ag : x.hg; if (gf > ga) o.w++; else if (gf === ga) o.d++; else o.l++; });
  return o;
}

function HeadToHead({ m }: { m: Match }) {
  const d = useData();
  const all = d.meetings(m.h, m.a, parisDay(m.d));
  const same = all.filter(x => x.h === m.h);
  const r = record(all, m.h), rs = record(same, m.h);
  return (
    <Section title="Face-à-face" meta="L1 depuis 2014" id="h2h">
      <Card>
        {all.length ? (
          <>
            <div className="tri">
              <div><b className="num-lg accent">{r.w}</b><span className="small muted">{m.h}</span></div>
              <div className="center"><b className="num-lg muted">{r.d}</b><span className="small muted">Nuls</span></div>
              <div className="right"><b className="num-lg">{r.l}</b><span className="small muted">{m.a}</span></div>
            </div>
            <p className="small muted">Au même stade ({m.h} à domicile) : {same.length} match{same.length > 1 ? 's' : ''}, {rs.w} V · {rs.d} N · {rs.l} D pour {m.h}.</p>
            <dl className="kv">
              {all.slice(0, 5).map(x => <div key={x.d}><dt>{x.s} · J{x.j}</dt><dd className="strong">{x.h} {x.hg} – {x.ag} {x.a}</dd></div>)}
            </dl>
          </>
        ) : <p className="muted small">Aucun match entre eux en L1 depuis 2014.</p>}
      </Card>
    </Section>
  );
}

function SeasonCompare({ m }: { m: Match }) {
  const d = useData();
  const before = d.matches.filter(x => x.status === 'finished' && x.d < m.d);
  const all = buildTable(before), home = buildTable(before, 'h'), away = buildTable(before, 'a');
  const H = all.find(r => r.club === m.h), A = all.find(r => r.club === m.a);
  const hh = home.find(r => r.club === m.h), aa = away.find(r => r.club === m.a);
  if (!H || !A || !H.mp) return <Section title="Comparatif de saison" id="saison"><Empty>Pas encore de match joué cette saison.</Empty></Section>;
  const cs = (club: string) => before.filter(x => (x.h === club && x.ag === 0) || (x.a === club && x.hg === 0)).length;
  const line = (k: string, a: ReactNode, b: ReactNode) => <div className="cmp-row"><span className="num-sm">{a}</span><span className="small muted">{k}</span><span className="num-sm right">{b}</span></div>;
  return (
    <Section title="Comparatif de saison" meta="avant ce match" id="saison">
      <Card>
        <div className="cmp">
          {line('Classement', `${H.rank}e`, `${A.rank}e`)}
          {line('Points', H.pts, A.pts)}
          {line('Forme', <Form results={H.form} />, <Form results={A.form} />)}
          {line('Buts pour / contre', `${H.gf} / ${H.ga}`, `${A.gf} / ${A.ga}`)}
          {line('Domicile / extérieur', hh ? `${hh.w}V ${hh.d}N ${hh.l}D` : '—', aa ? `${aa.w}V ${aa.d}N ${aa.l}D` : '—')}
          {line('Clean sheets', cs(m.h), cs(m.a))}
        </div>
      </Card>
    </Section>
  );
}

function KeyPlayers({ m }: { m: Match }) {
  const d = useData();
  const showAbs = m.status !== 'finished' && m.j === d.nextRound;
  return (
    <Section title="Joueurs clés et absents" meta="pts/match" id="joueurs">
      {[m.h, m.a].map(club => <ClubPlayers key={club} d={d} club={club} showAbs={showAbs} />)}
    </Section>
  );
}

function ClubPlayers({ d, club, showAbs }: { d: Data; club: string; showAbs: boolean }) {
  const key = d.players.filter(p => p.club === club && p.starts >= 2 && !p.absence).sort((a, b) => (b.ptsAvg ?? 0) - (a.ptsAvg ?? 0)).slice(0, 3);
  const abs = showAbs ? (d.absByClub.get(club) ?? []) : [];
  return (
    <div className="day">
      <h3 className="dayhead"><Crest club={club} size={18} /> {club}</h3>
      <Group>
        {key.map(p => (
          <Row key={p.id} to={`/joueur/${p.id}`}>
            <Avatar name={p.n} club={club} id={p.id} />
            <span className="grow ellipsis"><PlayerName p={p} /><small className="muted block">{POSITION[p.pos]} · {p.starts} tit. · {p.g} but{p.g > 1 ? 's' : ''}, {p.a} passe{p.a > 1 ? 's' : ''}</small></span>
            <span className="num-md">{num(p.ptsAvg)}</span>
          </Row>
        ))}
        {abs.map(a => {
          const p = a.playerId != null ? d.playerById.get(a.playerId) : undefined;
          const [tone, label] = ABS[a.type];
          return (
            <Row key={a.player} to={p ? `/joueur/${p.id}` : undefined}>
              <Avatar name={a.player} club={club} id={a.playerId} />
              <span className="grow ellipsis"><span className="strong">{p?.n ?? a.player}</span><small className="muted block">{a.why}{p ? ` · ${num(p.ptsAvg)} pts/match` : ''}</small></span>
              <Chip tone={tone}>{label}</Chip>
            </Row>
          );
        })}
      </Group>
      {showAbs && !abs.length && <p className="small muted">Aucun absent annoncé.</p>}
    </div>
  );
}

