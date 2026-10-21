import { useLayoutEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { FavButton, NavBar } from '../components/Glass.tsx';
import { PlayerRow } from '../components/PlayerRow.tsx';
import { Card, Chip, Empty, Form, Group, Row, Section, SubNav } from '../components/ui.tsx';
import { CLUBS, clubByName } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { dayShort, num, POSITION, time } from '../lib/format.ts';
import { buildTable } from '../lib/standings.ts';
import { ClubSeason, CupRow } from './Matches.tsx';

const ABS = { B: ['down', 'Blessé'], S: ['down', 'Suspendu'], D: ['warn', 'Incertain'], C: ['neutral', 'Non retenu'] } as const;

/** Barre de clubs défilante : changer de club en un geste, le club affiché reste au centre. */
export function ClubRail({ current, to = c => `/club/${encodeURIComponent(c)}` }: { current: string; to?: (c: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2;
  }, [current]);
  return (
    <div className="rail club-rail" ref={ref} role="tablist" aria-label="Clubs">
      {CLUBS.map(c => (
        <button key={c.name} role="tab" className={`rail-item${c.name === current ? ' on' : ''}`} aria-current={c.name === current}
          onClick={() => navigate(to(c.name), { replace: true })}>
          <Crest club={c.name} size={30} /><span className="tiny">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export function ClubPage() {
  const { name = '' } = useParams();
  const club = decodeURIComponent(name);
  const d = useData();
  const info = clubByName.get(club);
  if (!info) return <div className="page"><NavBar title="Club" back="Équipes" fallback="/equipes" /><Empty>Club introuvable.</Empty></div>;

  const row = d.table.find(r => r.club === club)!;
  const played = d.matches.filter(m => m.status === 'finished');
  const home = buildTable(played, 'h').find(r => r.club === club);
  const away = buildTable(played, 'a').find(r => r.club === club);
  const cs = played.filter(m => (m.h === club && m.ag === 0) || (m.a === club && m.hg === 0)).length;
  const next = d.matches.find(m => m.status !== 'finished' && (m.h === club || m.a === club));
  const squad = d.players.filter(p => p.club === club);
  const abs = d.absByClub.get(club) ?? [];
  const cups = d.cupsByClub.get(club) ?? [];
  const hist = d.finals.map(f => ({ s: f.s, r: f.table.find(r => r.club === club), n: f.table.length }));

  return (
    <div className="page">
      <NavBar title={club} back="Retour" fallback="/equipes" right={<FavButton kind="club" id={club} label={club} />} />
      <ClubRail current={club} />

      <header className="entity-head">
        <Crest club={club} size={60} />
        <div className="grow">
          <h1 className="h1-sm">{club}</h1>
          <span className="small muted">{info.full} · {row.rank}{row.rank === 1 ? 'er' : 'e'} · {row.pts} pts</span>
          <div className="chips-inline"><Form results={row.form} /></div>
        </div>
      </header>

      <SubNav items={[['resume', 'Résumé'], ['calendrier', 'Calendrier'], ['effectif', 'Effectif'], ['coupes', 'Coupes'], ['infirmerie', 'Infirmerie'], ['historique', 'Historique']]} />

      <Section title="Résumé" meta={`après J${d.lastRound}`} id="resume">
        <div className="tiles">
          <div className="tile"><b className="num-lg accent">{row.rank}<small>{row.rank === 1 ? 'er' : 'e'}</small></b><span className="small muted">classement</span></div>
          <div className="tile"><b className="num-lg">{row.pts}</b><span className="small muted">{row.w} V · {row.d} N · {row.l} D</span></div>
          <div className="tile"><b className="num-lg">{row.gd > 0 ? '+' : ''}{row.gd}</b><span className="small muted">{row.gf} BP · {row.ga} BC</span></div>
          <div className="tile"><b className="num-lg">{cs}</b><span className="small muted">clean sheets</span></div>
          <div className="tile"><b className="num-lg">{home?.pts ?? 0}</b><span className="small muted">pts à domicile</span></div>
          <div className="tile"><b className="num-lg">{away?.pts ?? 0}</b><span className="small muted">pts à l'extérieur</span></div>
        </div>
        {next && (
          <Group>
            <Row to={`/match/${next.id}`}>
              <span className="small muted">Prochain</span>
              <Crest club={next.h === club ? next.a : next.h} size={22} />
              <span className="grow strong ellipsis">{next.h === club ? 'vs' : 'à'} {next.h === club ? next.a : next.h}</span>
              <span className="small muted">{dayShort(next.d)} {time(next.d)}</span>
            </Row>
          </Group>
        )}
      </Section>

      <Section title="Calendrier" meta="L1 et coupes" id="calendrier">
        <ClubSeason club={club} autoScroll={false} title={false} />
      </Section>

      <Section title="Effectif" meta="pts/match" id="effectif">
        {(['G', 'D', 'M', 'A'] as const).map(pos => {
          const list = squad.filter(p => p.pos === pos && p.apps > 0).sort((a, b) => (b.ptsAvg ?? -99) - (a.ptsAvg ?? -99));
          const unused = squad.filter(p => p.pos === pos && p.apps === 0);
          if (!list.length && !unused.length) return null;
          return (
            <div key={pos} className="day">
              <h3 className="dayhead">{POSITION[pos]}s</h3>
              <Group>
                {list.map(p => (
                  <PlayerRow key={p.id} p={p} value={num(p.ptsAvg)}
                    sub={`${p.starts} tit.${p.subs ? ` · ${p.subs} entr.` : ''} · ${p.g} but${p.g > 1 ? 's' : ''} · ${p.a} passe${p.a > 1 ? 's' : ''}${p.absence ? ` · ${ABS[p.absence.type][1].toLowerCase()}` : ''}`} />
                ))}
                {unused.length > 0 && <div className="row tight small muted">Sans minute jouée : {unused.map(p => p.n).join(', ')}</div>}
              </Group>
            </div>
          );
        })}
      </Section>

      <Section title="Coupes" meta="Europe et Coupe de France" id="coupes">
        <Group>{cups.length ? cups.map(c => <CupRow key={c.d + c.comp} c={c} />) : <Empty>Pas de coupe en cours.</Empty>}</Group>
      </Section>

      <Section title="Infirmerie" meta={d.nextRound ? `J${d.nextRound}` : undefined} id="infirmerie">
        <Group>
          {abs.map(a => {
            const p = a.playerId != null ? d.playerById.get(a.playerId) : undefined;
            return (
              <Row key={a.player} to={p ? `/joueur/${p.id}` : undefined}>
                <span className="grow ellipsis"><span className="strong">{p?.n ?? a.player}</span>
                  <small className="muted block">{a.why}{p ? ` · ${p.starts} tit. · ${num(p.ptsAvg)} pts/match` : ''}</small></span>
                <Chip tone={ABS[a.type][0]}>{ABS[a.type][1]}</Chip>
              </Row>
            );
          })}
          {!abs.length && <Empty>Aucun absent annoncé.</Empty>}
        </Group>
      </Section>

      <Section title="Historique" meta="classement final depuis 2014" id="historique">
        <Card><RankChart hist={hist} /></Card>
        <Group>
          {[...hist].reverse().map(h => (
            <div key={h.s} className="row tight">
              <span className="grow">{h.s}</span>
              {h.r ? <><span className="num-sm">{h.r.rank}{h.r.rank === 1 ? 'er' : 'e'}</span><span className="small muted pts-w">{h.r.pts} pts</span></> : <span className="small muted">pas en L1</span>}
            </div>
          ))}
        </Group>
      </Section>
      <Link to={`/matchs?club=${encodeURIComponent(club)}`} className="textlink">Voir dans l'onglet Matchs ›</Link>
    </div>
  );
}

/** Position finale saison par saison (1 en haut). Les saisons hors L1 laissent un trou. */
function RankChart({ hist }: { hist: { s: string; r?: { rank: number }; n: number }[] }) {
  const W = 340, H = 140, l = 24, r = 8, t = 10, b = 20;
  const x = (i: number) => l + (i * (W - l - r)) / Math.max(1, hist.length - 1);
  const y = (rank: number) => t + ((rank - 1) * (H - t - b)) / 19;
  const segs: string[] = [];
  let cur = '';
  hist.forEach((h, i) => {
    if (h.r) cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)} ${y(h.r.rank).toFixed(1)} `;
    else if (cur) { segs.push(cur); cur = ''; }
  });
  if (cur) segs.push(cur);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Classement final par saison">
      {[1, 5, 10, 15, 20].map(k => <g key={k}><line x1={l} x2={W - r} y1={y(k)} y2={y(k)} stroke="var(--line)" /><text x={l - 6} y={y(k) + 3} textAnchor="end" className="pc-axis">{k}</text></g>)}
      {segs.map((s, i) => <path key={i} d={s} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />)}
      {hist.map((h, i) => h.r && <circle key={h.s} cx={x(i)} cy={y(h.r.rank)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2"><title>{h.s} : {h.r.rank}e</title></circle>)}
      {hist.map((h, i) => (i % 2 === 0 || i === hist.length - 1) && <text key={h.s} x={x(i)} y={H - 5} textAnchor="middle" className="pc-axis">{h.s.slice(2, 4)}</text>)}
    </svg>
  );
}
