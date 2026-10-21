import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { NavBar, Star } from '../components/Glass.tsx';
import { Logo } from '../components/Icon.tsx';
import { PlayerRow } from '../components/PlayerRow.tsx';
import { Card, Chip, Empty, Form, Group, Row, Section } from '../components/ui.tsx';
import { CLUBS } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { useFavorites } from '../lib/favorites.ts';
import { countdown, dateShort, dayShort, num, parisDay, POSITION, time } from '../lib/format.ts';
import { importance, type PlayerStats } from '../lib/model.ts';

function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}

const ABS_LABEL = { B: ['down', 'Blessé'], S: ['down', 'Suspendu'], D: ['warn', 'Incertain'], C: ['neutral', 'Non retenu'] } as const;

export function Home() {
  const d = useData();
  const fav = useFavorites();
  const now = useNow();
  const next = d.nextRound != null ? (d.rounds.get(d.nextRound) ?? []).filter(m => m.status !== 'finished').sort((a, b) => a.d.localeCompare(b.d)) : [];
  const first = next.find(m => Date.parse(m.d) > now) ?? next[0];
  const days = [...new Set(next.map(m => parisDay(m.d)))];

  const minApps = Math.max(2, Math.ceil(d.lastRound / 2));
  const top = (list: PlayerStats[], key: (p: PlayerStats) => number | null, n: number) =>
    list.filter(p => key(p) != null).sort((a, b) => key(b)! - key(a)!).slice(0, n);
  const inForm = top(d.players.filter(p => p.l3Apps >= 2 && p.apps > p.l3Apps && !p.absence), p => p.l3Avg, 5);
  const supersubs = top(d.players.filter(p => p.superSub && !p.absence), p => p.subAvg, 4);
  const keepers = top(d.players.filter(p => p.pos === 'G' && p.starts >= minApps), p => p.ptsAvg, 3);
  const defenders = top(d.players.filter(p => p.pos === 'D' && p.starts >= minApps), p => p.ptsAvg, 4);
  const absent = d.players.filter(p => p.absence && p.starts >= 2).sort((a, b) => importance(b) - importance(a)).slice(0, 6);

  const favPlayers = fav.players.map(id => d.playerById.get(id)).filter((p): p is PlayerStats => !!p);
  const nextOf = (club: string) => d.matches.find(m => m.status !== 'finished' && (m.h === club || m.a === club));

  return (
    <div className="page">
      <NavBar title="SearchL1" />
      <header className="home-brand">
        <span className="brand big"><Logo size={36} /><span>Search<b>L1</b></span></span>
        <span className="small muted">Ligue 1 · J{d.lastRound} jouée</span>
      </header>

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
          <Link to={`/matchs?j=${d.nextRound}`} className="glass-pill">Voir les {next.length} matchs</Link>
        </Card>
      )}

      <Section title="Favoris" meta={favPlayers.length + fav.clubs.length ? `${favPlayers.length + fav.clubs.length}` : undefined}>
        {fav.clubs.length > 0 && (
          <div className="rail fav-clubs">
            {fav.clubs.map(c => {
              const m = nextOf(c);
              const r = d.table.find(x => x.club === c);
              return (
                <Link key={c} to={`/club/${encodeURIComponent(c)}`} className="fav-club glass-card">
                  <Crest club={c} size={34} />
                  <span className="strong">{c}</span>
                  <span className="tiny muted">{r ? `${r.rank}${r.rank === 1 ? 'er' : 'e'} · ${r.pts} pts` : ''}</span>
                  {m && <span className="tiny">{m.h === c ? 'vs' : 'à'} {m.h === c ? m.a : m.h} · {dayShort(m.d)}</span>}
                </Link>
              );
            })}
          </div>
        )}
        {favPlayers.length > 0 && (
          <Group>
            {favPlayers.map(p => {
              const m = nextOf(p.club);
              return (
                <PlayerRow key={p.id} p={p} value={num(p.ptsAvg)}
                  sub={`${POSITION[p.pos]} · ${p.club}${m ? ` · ${m.h === p.club ? 'vs' : 'à'} ${m.h === p.club ? m.a : m.h}` : ''}${p.absence ? ' · absent' : ''}`}
                  extra={p.trend != null && Math.abs(p.trend) >= 0.05 ? <Chip tone={p.trend >= 0 ? 'accent' : 'down'}>{p.trend >= 0 ? '↑' : '↓'} {num(Math.abs(p.trend))}</Chip> : undefined} />
              );
            })}
          </Group>
        )}
        {!favPlayers.length && !fav.clubs.length && (
          <Card className="hint">
            <span className="hint-star"><Star filled={false} size={22} /></span>
            <p className="small">Touchez l'étoile en haut d'une fiche joueur ou club pour la retrouver ici en un geste.</p>
          </Card>
        )}
      </Section>

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
              {!supersubs.length && <Empty>Aucun bon supersub pour l'instant.</Empty>}
            </Group>
            <Link to="/joueurs?vue=supersubs" className="textlink">Tous les remplaçants ›</Link>
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
                  <Row key={p.id} to={`/joueur/${p.id}`}>
                    <Crest club={p.club} size={24} />
                    <span className="grow ellipsis"><span className="strong">{p.n}</span><small className="muted block ellipsis">{p.club} · {p.absence!.why} · {num(p.ptsAvg)} pts/m</small></span>
                    <Chip tone={tone}>{label}</Chip>
                  </Row>
                );
              })}
              {!absent.length && <Empty>Pas d'absent important annoncé pour l'instant.</Empty>}
            </Group>
            <Link to="/infirmerie" className="textlink">Toute l'infirmerie ›</Link>
          </Section>

          <Section title="Classement" meta={`après J${d.lastRound}`}>
            <Group>
              {d.table.slice(0, 5).map(r => (
                <Row key={r.club} to={`/club/${encodeURIComponent(r.club)}`} className="tight">
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
                <Link key={c.name} to={`/club/${encodeURIComponent(c.name)}`} className="rail-item" role="listitem">
                  <Crest club={c.name} size={36} /><span className="tiny">{c.name}</span>
                  {fav.isClub(c.name) && <span className="rail-star" aria-label="favori"><Star filled size={11} /></span>}
                </Link>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <p className="foot muted tiny">
        Données Sofascore et openfootball du {new Date(d.meta.updatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' })}
        {d.meta.warnings.length ? ' (Sofascore indisponible lors de la dernière mise à jour : scores seulement)' : ''}.
        Points estimés avec le barème du Championnat des Étoiles et une note L'Équipe estimée.
      </p>
    </div>
  );
}
