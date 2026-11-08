import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useSheet } from '../lib/data.tsx';
import type { Match, SheetEvent, SheetPlayer, SheetSide } from '../lib/types.ts';
import { Crest } from './Crest.tsx';
import { Avatar } from './PlayerRow.tsx';
import { Empty, Group, Section } from './ui.tsx';

// « H. Haraldsson » → « Haraldsson » : sur le terrain, le nom de famille suffit.
const last = (n: string) => n.replace(/^(\p{L}\.\s?)+/u, '') || n;
const note = (r: number) => (r >= 7.5 ? 'hi' : r >= 7 ? 'good' : r >= 6 ? 'mid' : 'low');

/** Lignes du terrain, de l'attaque (en haut) au gardien (en bas), chaque ligne de gauche à droite. */
function lines(s: SheetSide): SheetPlayer[][] {
  const [gk, ...rest] = s.xi;
  const counts = (s.formation ?? '').split('-').map(Number).filter(n => n > 0);
  let rows: SheetPlayer[][];
  if (counts.length && counts.reduce((a, b) => a + b, 0) === rest.length) {
    let k = 0;
    rows = counts.map(n => rest.slice(k, (k += n)));
  } else {
    rows = (['D', 'M', 'A'] as const).map(pos => rest.filter(p => p.pos === pos)).filter(r => r.length);
  }
  // Sofascore range chaque ligne de droite à gauche (latéral droit d'abord) : l'équipe attaque vers le haut.
  return [...rows.map(r => [...r].reverse()).reverse(), gk ? [gk] : []];
}

function Ball() {
  return (
    <svg className="ev-ball" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#fff" stroke="#14201A" strokeWidth="1.2" />
      <path d="M8 4.6l3 2.2-1.1 3.5H6.1L5 6.8z" fill="#14201A" />
    </svg>
  );
}
const Card = ({ red }: { red?: boolean }) => <i className={`ev-card${red ? ' red' : ''}`} aria-label={red ? 'carton rouge' : 'carton jaune'} />;

function OnPitch({ p, s, known }: { p: SheetPlayer; s: SheetSide; known: boolean }) {
  const body = (
    <>
      <span className="pp-shirt" style={{ background: s.color, color: s.ink }}>
        {p.num ?? ''}
        {p.r != null && <span className={`pp-note ${note(p.r)}`}>{p.r.toFixed(1)}</span>}
        <span className="pp-badges">
          {Array.from({ length: p.g }, (_, i) => <Ball key={i} />)}
          {p.rc > 0 ? <Card red /> : p.y > 0 && <Card />}
        </span>
      </span>
      <span className="pp-name">{last(p.n)}</span>
      {p.out != null && <span className="pp-out">↓ {p.out}'</span>}
    </>
  );
  return known ? <Link to={`/joueur/${p.id}`} className="pp">{body}</Link> : <span className="pp">{body}</span>;
}

/** Feuille de match : compositions sur le terrain, remplaçants et déroulé (buts, cartons, changements). */
export function MatchSheetView({ m }: { m: Match }) {
  const d = useData();
  const sheet = useSheet(m.id);
  const [home, setHome] = useState(true);
  if (sheet === undefined) return <Section title="Compositions"><Empty>Chargement de la feuille de match…</Empty></Section>;
  if (!sheet) return <Section title="Compositions"><Empty>Feuille de match pas encore disponible.</Empty></Section>;

  const s = home ? sheet.home : sheet.away;
  const club = home ? m.h : m.a;
  const known = (id: number) => d.playerById.has(id);
  const entered = (s?.bench ?? []).filter(p => p.in != null || p.min > 0).sort((a, b) => (a.in ?? 99) - (b.in ?? 99));
  const unused = (s?.bench ?? []).filter(p => p.in == null && !p.min);
  // Joueur remplacé par chaque entrant (d'après le déroulé du match).
  const replaced = new Map(sheet.events.filter(e => e.kind === 'sub' && e.home === home).map(e => [e.player, e.other]));

  return (
    <>
      <Section title="Compositions" meta={s?.formation}>
        <div className="seg sheet-seg" role="tablist" aria-label="Équipe">
          {[true, false].map(h => (
            <button key={String(h)} role="tab" aria-selected={home === h} onClick={() => setHome(h)}>
              <Crest club={h ? m.h : m.a} size={18} /> {h ? m.h : m.a}
            </button>
          ))}
        </div>
        {s ? (
          <div className="pitch" aria-label={`Composition de ${club}${s.formation ? ` en ${s.formation}` : ''}`}>
            <i className="pitch-box top" /><i className="pitch-mid" /><i className="pitch-circle" /><i className="pitch-box bottom" />
            {lines(s).map((row, i) => (
              <div key={i} className="pitch-row">{row.map(p => <OnPitch key={p.id} p={p} s={s} known={known(p.id)} />)}</div>
            ))}
          </div>
        ) : <Empty>Compositions non publiées pour ce match.</Empty>}
        <p className="small muted">Note Sofascore sur la pastille. Touchez un joueur pour sa fiche.</p>
      </Section>

      {s && (
        <Section title="Remplaçants" meta={club}>
          <Group>
            {entered.map(p => {
              const out = replaced.get(p.n);
              const inner = (
                <>
                  <Avatar name={p.n} club={club} id={p.id} />
                  <span className="grow ellipsis"><span className="strong">{p.num != null && <span className="muted num-sm">{p.num} </span>}{p.n}</span>
                    <small className="muted block">entré{p.in != null ? ` à la ${p.in}e` : ''}{out ? ` · remplace ${out}` : ''}{p.g ? ` · ${p.g} but${p.g > 1 ? 's' : ''}` : ''}{p.a ? ` · ${p.a} passe${p.a > 1 ? 's' : ''}` : ''}</small></span>
                  {p.r != null && <span className={`pp-note inline ${note(p.r)}`}>{p.r.toFixed(1)}</span>}
                </>
              );
              return known(p.id) ? <Link key={p.id} to={`/joueur/${p.id}`} className="row link">{inner}</Link> : <div key={p.id} className="row">{inner}</div>;
            })}
            {!entered.length && <div className="row small muted">Aucun remplacement.</div>}
            {unused.length > 0 && <div className="row tight small muted">Non entrés : {unused.map(p => p.n).join(', ')}</div>}
          </Group>
        </Section>
      )}

      <Section title="Déroulé du match" meta={`${sheet.events.length} faits de jeu`}>
        <Timeline m={m} events={sheet.events} />
      </Section>
    </>
  );
}

function Timeline({ m, events }: { m: Match; events: SheetEvent[] }) {
  if (!events.length) return <Group><Empty>Pas de détail pour ce match.</Empty></Group>;
  let h = 0, a = 0;
  return (
    <div className="card flush timeline">
      <div className="tl-head small muted"><span><Crest club={m.h} size={16} /> {m.h}</span><span /><span>{m.a} <Crest club={m.a} size={16} /></span></div>
      {events.map((e, i) => {
        const goal = e.kind === 'goal' || e.kind === 'pen' || e.kind === 'og';
        if (goal) { if (e.home) h++; else a++; }
        const what = (
          <span className={`tl-ev${e.home ? '' : ' away'}`}>
            {goal ? <Ball /> : e.kind === 'sub' ? <span className="tl-sub" aria-label="remplacement">⇅</span> : <Card red={e.kind === 'red'} />}
            <span className="ellipsis">
              <span className={goal ? 'strong' : undefined}>{e.player}</span>
              {e.kind === 'pen' && ' (pen.)'}{e.kind === 'og' && ' (csc)'}
              {e.other && <small className="muted block ellipsis">{e.kind === 'sub' ? `remplace ${e.other}` : `passe de ${e.other}`}</small>}
            </span>
          </span>
        );
        return (
          <div key={i} className={`tl-row${goal ? ' goal' : ''}`}>
            <div>{e.home && what}</div>
            <span className="tl-min num-sm">{goal ? <b>{h}-{a}</b> : null}<span className="muted">{e.min}'</span></span>
            <div>{!e.home && what}</div>
          </div>
        );
      })}
    </div>
  );
}
