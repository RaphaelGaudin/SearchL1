import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LargeTitle, NavBar } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { MatchRow } from '../components/MatchRow.tsx';
import { Chip, Empty, Group, Row, type Tone } from '../components/ui.tsx';
import { CLUB_NAMES } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { CUP_LONG, CUP_SHORT, dateShort, dayLong, dayShort, parisDay, time } from '../lib/format.ts';
import type { CupMatch, Match } from '../lib/types.ts';

const ROUNDS = Array.from({ length: 34 }, (_, i) => i + 1);

export function Matches() {
  const d = useData();
  const [params, setParams] = useSearchParams();
  const club = params.get('club');
  const j = Number(params.get('j')) || d.nextRound || d.lastRound || 1;
  const set = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };

  return (
    <div className="page">
      <NavBar title={club ? `Matchs · ${club}` : `Matchs · J${j}`} />
      <LargeTitle>Matchs</LargeTitle>
      <div className="toolbar">
        <label className="select">
          <span className="sr-only">Club</span>
          <select value={club ?? ''} onChange={e => set({ club: e.target.value || null })}>
            <option value="">Tous les clubs</option>
            {[...CLUB_NAMES].sort((a, b) => a.localeCompare(b, 'fr')).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Icon name="down" size={18} />
        </label>
      </div>
      {club ? <ClubSeason club={club} /> : <Round j={j} onPick={n => set({ j: String(n) })} />}
    </div>
  );
}

function Round({ j, onPick }: { j: number; onPick: (j: number) => void }) {
  const d = useData();
  const strip = useRef<HTMLDivElement>(null);
  const ms = (d.rounds.get(j) ?? []).slice().sort((a, b) => a.d.localeCompare(b.d));
  const byDay = new Map<string, Match[]>();
  ms.forEach(m => byDay.set(parisDay(m.d), [...(byDay.get(parisDay(m.d)) ?? []), m]));
  const firstDay = (n: number) => (d.rounds.get(n) ?? []).map(m => m.d).sort()[0];

  // Garde la journée choisie au centre de la bande.
  useLayoutEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (el && strip.current) strip.current.scrollLeft = el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2;
  }, [j]);

  const played = ms.filter(m => m.status === 'finished').length;
  return (
    <>
      <div className="roundband">
        <button className="iconbtn" disabled={j <= 1} onClick={() => onPick(j - 1)} aria-label="Journée précédente"><Icon name="left" size={18} /></button>
        <div className="strip" ref={strip}>
          {ROUNDS.map(n => {
            const f = firstDay(n);
            return (
              <button key={n} className={`rd${n === j ? ' on' : ''}${n <= d.lastRound ? ' past' : ''}`} aria-current={n === j} onClick={() => onPick(n)}>
                <span className="num-sm">J{n}</span>
                <span className="tiny">{f ? dateShort(f) : ''}</span>
              </button>
            );
          })}
        </div>
        <button className="iconbtn" disabled={j >= 34} onClick={() => onPick(j + 1)} aria-label="Journée suivante"><Icon name="right" size={18} /></button>
      </div>
      <div className="section-head">
        <h2>Journée {j}</h2>
        <span className="small muted">{played === ms.length ? 'terminée' : played ? `${played}/${ms.length} joués` : j === d.nextRound ? 'prochaine journée' : 'à venir'}</span>
      </div>
      {played < ms.length && (
        <p className="small muted hint-text">
          Les pourcentages : chances de victoire de chaque équipe, et de match nul au milieu.
          {ms.some(m => d.cupsAround(m.h, m.d).length || d.cupsAround(m.a, m.d).length) && <> Une pastille comme <span className="cup-tag t-LDC">LdC −4 j</span> : match de coupe d'Europe 4 jours avant (−) ou après (+), donc de la fatigue possible.</>}
        </p>
      )}
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="day">
          <h3 className="dayhead">{dayLong(list[0].d)}</h3>
          <Group>{list.map(m => <MatchRow key={m.id} m={m} />)}</Group>
        </div>
      ))}
    </>
  );
}

type Item = { kind: 'l1'; d: string; m: Match } | { kind: 'cup'; d: string; c: CupMatch } | { kind: 'today'; d: string };

/** Période affichée : matchs à venir, résultats (du plus récent au plus ancien) ou toute la saison. */
export type When = 'next' | 'past' | 'all';

export function ClubSeason({ club, autoScroll = true, title = true, when = 'all' }: { club: string; autoScroll?: boolean; title?: boolean; when?: When }) {
  const d = useData();
  const todayRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date().toISOString());
  // Un match est « joué » quand on a son score, pas seulement quand sa date est passée.
  const done = (it: Item) => (it.kind === 'l1' ? it.m.status === 'finished' : it.kind === 'cup' ? it.c.gf != null || it.d < now : false);
  let items: Item[] = [
    ...d.matches.filter(m => m.h === club || m.a === club).map(m => ({ kind: 'l1' as const, d: m.d, m })),
    ...(d.cupsByClub.get(club) ?? []).map(c => ({ kind: 'cup' as const, d: c.d, c })),
    ...(when === 'all' ? [{ kind: 'today' as const, d: now }] : []),
  ].sort((a, b) => a.d.localeCompare(b.d));
  if (when === 'next') items = items.filter(it => it.kind !== 'today' && !done(it));
  if (when === 'past') items = items.filter(it => it.kind !== 'today' && done(it)).reverse();

  useEffect(() => { if (autoScroll) todayRef.current?.scrollIntoView({ block: 'center' }); }, [club, autoScroll]);

  // Regroupe les éléments consécutifs dans des listes, le repère « Aujourd'hui » coupe la liste.
  const blocks: Item[][] = [];
  for (const it of items) {
    if (it.kind === 'today') { blocks.push([it]); continue; }
    const last = blocks[blocks.length - 1];
    if (last && last[0].kind !== 'today') last.push(it); else blocks.push([it]);
  }
  return (
    <>
      {title && <div className="section-head"><h2>Saison de {club}</h2><Link to={`/club/${encodeURIComponent(club)}`} className="textlink small">Fiche club ›</Link></div>}
      {!blocks.length && <Group><Empty>{when === 'past' ? 'Pas encore de match joué.' : 'Plus de match à venir.'}</Empty></Group>}
      {blocks.map((b, i) =>
        b[0].kind === 'today'
          ? <div key="today" ref={todayRef} className="today"><span>Aujourd'hui · {dayShort(now)}</span></div>
          : <Group key={i}>{b.map(it => it.kind === 'l1' ? <MatchRow key={it.m.id} m={it.m} showDate /> : it.kind === 'cup' ? <CupRow key={it.c.d + it.c.comp} c={it.c} /> : null)}</Group>,
      )}
    </>
  );
}

export function CupRow({ c }: { c: CupMatch }) {
  const res = c.gf != null && c.ga != null ? (c.gf > c.ga ? 'V' : c.gf < c.ga ? 'D' : 'N') : null;
  return (
    <Row className="cup-row">
      <Chip tone={c.comp as Tone} title={CUP_LONG[c.comp]}>{CUP_SHORT[c.comp]}</Chip>
      <span className="grow ellipsis">
        <span className="strong">{c.tbd ? 'Adversaire à tirer au sort' : `${c.home ? 'vs' : 'à'} ${c.opp}`}</span>
        <small className="muted block">{CUP_LONG[c.comp]} · {c.stage} · {dayShort(c.d)}{!c.tbd && c.gf == null ? ` ${time(c.d)}` : ''}</small>
      </span>
      {res && <span className={`num-md res-${res}`}>{c.gf}–{c.ga}</span>}
      {c.out && <Chip tone="down">éliminé</Chip>}
    </Row>
  );
}
