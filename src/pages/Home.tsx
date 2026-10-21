import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUi } from '../App.tsx';
import { Crest } from '../components/Crest.tsx';
import { Icon, Logo } from '../components/Icon.tsx';
import { PlayerRow } from '../components/PlayerRow.tsx';
import { Card, Chip, Empty, Form, Group, Row, Section } from '../components/ui.tsx';
import { CLUBS } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { countdown, dateShort, dayShort, num, parisDay, POSITION, time } from '../lib/format.ts';
import { importance, type PlayerStats } from '../lib/model.ts';

export function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}

const ABS_LABEL = { B: ['down', 'Blessé'], S: ['down', 'Suspendu'], D: ['warn', 'Incertain'], C: ['neutral', 'Non retenu'] } as const;

export function Home() {
  const d = useData();
  const { openSearch } = useUi();
  const now = useNow();
  const next = d.nextRound != null ? (d.rounds.get(d.nextRound) ?? []).filter(m => m.status !== 'finished').sort((a, b) => a.d.localeCompare(b.d)) : [];
  const first = next.find(m => Date.parse(m.d) > now) ?? next[0];
  const days = [...new Set(next.map(m => parisDay(m.d)))];

  const minApps = Math.max(2, Math.ceil(d.lastRound / 2));
  const top = (list: PlayerStats[], key: (p: PlayerStats) => number | null, n: number) =>
    list.filter(p => key(p) != null).sort((a, b) => key(b)! - key(a)!).slice(0, n);
  const inForm = top(d.players.filter(p => p.l3Apps >= 2 && !p.absence), p => p.l3Avg, 5);
  const supersubs = top(d.players.filter(p => p.subApps >= 2 && !p.absence), p => p.subAvg, 4);
  const keepers = top(d.players.filter(p => p.pos === 'G' && p.starts >= minApps), p => p.ptsAvg, 3);
  const defenders = top(d.players.filter(p => p.pos === 'D' && p.starts >= minApps), p => p.ptsAvg, 4);
  const absent = d.players.filter(p => p.absence && p.starts >= 2).sort((a, b) => importance(b) - importance(a)).slice(0, 6);

  return (
    <div className="page">
      <div className="page-head mobile-only">
        <span className="brand big"><Logo size={34} /><span>Search<b>L1</b></span></span>
        <button className="iconbtn" onClick={openSearch} aria-label="Rechercher"><Icon name="search" size={20} /></button>
      </div>

      {first && (
        <Card className="next">
          <div>
            <span className="small muted">Prochaine journée</span>
            <h2>J{d.nextRound} · {days.length > 1 ? `${dateShort(days[0])} – ${dateShort(days[days.length - 1])}` : dayShort(days[0])}</h2>
          </div>
          <div className="countdown" aria-live="polite">
            {countdown(Date.parse(first.d) - now).map(c => <span key={c.u}><b className="num-xl accent">{c.n}</b> <span className="muted">{c.u}</span></span>)}
          </div>
          <Link to={`/match/${first.id}`} className="next-first">
            <Crest club={first.h} size={20} /><span className="strong">{first.h} – {first.a}</span><Crest club={first.a} size={20} />
            <span className="grow right muted small">{dayShort(first.d)} {time(first.d)}</span>
          </Link>
          <Link to={`/matchs?j=${d.nextRound}`} className="textlink">Voir les {next.length} matchs ›</Link>
        </Card>
      )}

      <div className="cols">
        <div>
          <Section title="En forme" meta="pts/match · 3 dernières J">
            <Group>
              {inForm.map(p => (
                <PlayerRow key={p.id} p={p} value={num(p.l3Avg)}
                  extra={p.trend != null && <Chip tone={p.trend >= 0 ? 'accent' : 'down'}>{p.trend >= 0 ? '↑' : '↓'} {num(Math.abs(p.trend))}</Chip>} />
              ))}
              {!inForm.length && <Empty>Pas encore assez de matchs.</Empty>}
            </Group>
          </Section>

          <Section title="Supersubs" meta="pts par entrée en jeu">
            <Group>
              {supersubs.map(p => <PlayerRow key={p.id} p={p} value={num(p.subAvg)} sub={`${POSITION[p.pos]} · ${p.club} · ${p.subApps} entrées`} />)}
              {!supersubs.length && <Empty>Aucun remplaçant entré au moins deux fois.</Empty>}
            </Group>
          </Section>

          <Section title="Gardiens et défenseurs" meta="pts/match">
            <Group>
              {[...keepers, ...defenders].map(p => <PlayerRow key={p.id} p={p} value={num(p.ptsAvg)} sub={`${POSITION[p.pos]} · ${p.club} · ${p.starts} tit.`} />)}
            </Group>
          </Section>
        </div>

        <div>
          <Section title="Absents qui comptent" meta={d.nextRound ? `J${d.nextRound}` : undefined}>
            <Group>
              {absent.map(p => {
                const [tone, label] = ABS_LABEL[p.absence!.type];
                return (
                  <Row key={p.id} to={`/matchs?club=${encodeURIComponent(p.club)}`}>
                    <Crest club={p.club} size={24} />
                    <span className="grow ellipsis"><span className="strong">{p.n}</span><small className="muted block">{p.club} · {num(p.ptsAvg)} pts/match · {p.starts} tit.</small></span>
                    <Chip tone={tone} title={p.absence!.why}>{label}{p.absence!.type === 'B' ? ` · ${p.absence!.why}` : ''}</Chip>
                  </Row>
                );
              })}
              {!absent.length && <Empty>Pas d'absent important annoncé pour l'instant.</Empty>}
            </Group>
          </Section>

          <Section title="Classement" meta={`après J${d.lastRound}`}>
            <Group>
              {d.table.slice(0, 5).map(r => (
                <Row key={r.club} to={`/matchs?club=${encodeURIComponent(r.club)}`} className="tight">
                  <span className="rank num-sm muted">{r.rank}</span>
                  <Crest club={r.club} size={22} />
                  <span className="grow strong">{r.club}</span>
                  <Form results={r.form} />
                  <span className="num-md pts">{r.pts}</span>
                </Row>
              ))}
            </Group>
            <Link to="/classement" className="textlink">Classement complet ›</Link>
          </Section>

          <Section title="Clubs" meta="18">
            <div className="rail" role="list">
              {CLUBS.map(c => (
                <Link key={c.name} to={`/matchs?club=${encodeURIComponent(c.name)}`} className="rail-item" role="listitem">
                  <Crest club={c.name} size={36} /><span className="tiny">{c.name}</span>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <p className="foot muted tiny">
        Données Sofascore et openfootball, mises à jour le {new Date(d.meta.updatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' })}.
        Points estimés avec le barème du Championnat des Étoiles et une note L'Équipe estimée. {d.meta.warnings.length > 0 && `${d.meta.warnings.length} avertissement(s) lors de la mise à jour.`}
      </p>
    </div>
  );
}
