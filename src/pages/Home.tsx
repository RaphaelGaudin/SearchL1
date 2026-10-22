import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { NavBar, Star } from '../components/Glass.tsx';
import { Logo } from '../components/Icon.tsx';
import { PlayerRow } from '../components/PlayerRow.tsx';
import { Chip, Empty, Form, Group, Row, Section } from '../components/ui.tsx';
import { CLUBS } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { useFavorites } from '../lib/favorites.ts';
import { countdown, dateShort, dayShort, num, parisDay, POSITION, time } from '../lib/format.ts';
import { importance, type PlayerStats } from '../lib/model.ts';
import { usePref } from '../lib/prefs.ts';
import { ABSENCE } from './Injuries.tsx';

function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}

type Watch = 'forme' | 'supersubs' | 'gardiens' | 'defenseurs';
const WATCH: { k: Watch; label: string; meta: string; vue: string }[] = [
  { k: 'forme', label: 'En forme', meta: 'pts/match sur les 3 dernières J, écart avec la saison', vue: 'synthese&periode=3' },
  { k: 'supersubs', label: 'Supersubs', meta: 'pts par entrée en jeu', vue: 'supersubs' },
  { k: 'gardiens', label: 'Gardiens', meta: 'pts/match sur la saison', vue: 'gardiens' },
  { k: 'defenseurs', label: 'Défenseurs', meta: 'pts/match sur la saison', vue: 'defense&poste=D' },
];

export function Home() {
  const d = useData();
  const fav = useFavorites();
  const now = useNow();
  const [watch, setWatch] = usePref<Watch>('accueil-liste', 'forme');
  const next = d.nextRound != null ? (d.rounds.get(d.nextRound) ?? []).filter(m => m.status !== 'finished').sort((a, b) => a.d.localeCompare(b.d)) : [];
  const first = next.find(m => Date.parse(m.d) > now) ?? next[0];
  const days = [...new Set(next.map(m => parisDay(m.d)))];

  const minApps = Math.max(2, Math.ceil(d.lastRound / 2));
  const top = (list: PlayerStats[], key: (p: PlayerStats) => number | null, n = 5) =>
    list.filter(p => key(p) != null).sort((a, b) => key(b)! - key(a)!).slice(0, n);
  const lists: Record<Watch, { p: PlayerStats; v: number | null; sub?: string; trend?: boolean }[]> = {
    forme: top(d.players.filter(p => p.l3Apps >= 2 && p.trend != null && !p.absence), p => p.l3Avg).map(p => ({ p, v: p.l3Avg, trend: true })),
    supersubs: top(d.players.filter(p => p.superSub && !p.absence), p => p.subAvg).map(p => ({ p, v: p.subAvg, sub: `${POSITION[p.pos]} · ${p.club} · ${p.subApps} entrées` })),
    gardiens: top(d.players.filter(p => p.pos === 'G' && p.starts >= minApps), p => p.ptsAvg).map(p => ({ p, v: p.ptsAvg, sub: `${p.club} · ${p.starts} tit.` })),
    defenseurs: top(d.players.filter(p => p.pos === 'D' && p.starts >= minApps), p => p.ptsAvg).map(p => ({ p, v: p.ptsAvg, sub: `${p.club} · ${p.starts} tit.` })),
  };
  const W = WATCH.find(w => w.k === watch)!;
  const absent = d.players.filter(p => p.absence && p.starts >= 2).sort((a, b) => importance(b) - importance(a));

  const favPlayers = fav.players.map(id => d.playerById.get(id)).filter((p): p is PlayerStats => !!p);
  const nextOf = (club: string) => d.matches.find(m => m.status !== 'finished' && (m.h === club || m.a === club));

  return (
    <div className="page">
      <NavBar title="SearchL1" />
      <header className="home-brand">
        <span className="brand big"><Logo size={36} /><span>Search<b>L1</b></span></span>
        <span className="small muted">J{d.lastRound} jouée</span>
      </header>

      {first && (
        <Link to={`/matchs?j=${d.nextRound}`} className="card next next-link">
          <div className="next-top">
            <span>
              <span className="small muted block">Prochaine journée</span>
              <span className="h2">J{d.nextRound} · {days.length > 1 ? `${dateShort(days[0])} – ${dateShort(days[days.length - 1])}` : dayShort(days[0])}</span>
            </span>
            <span className="countdown" aria-live="polite">
              {countdown(Date.parse(first.d) - now).map(c => <span key={c.u}><b className="num-lg accent">{c.n}</b><span className="small muted"> {c.u}</span></span>)}
            </span>
          </div>
          <span className="next-first">
            <Crest club={first.h} size={20} /><span className="strong">{first.h} – {first.a}</span><Crest club={first.a} size={20} />
            <span className="grow right muted small">{dayShort(first.d)} {time(first.d)}</span>
          </span>
          <span className="next-cta">Voir les {next.length} matchs et pronostics ›</span>
        </Link>
      )}

      <Section title="Favoris">
        {fav.clubs.length > 0 && (
          <div className="rail fav-clubs">
            {fav.clubs.map(c => {
              const m = nextOf(c);
              const r = d.table.find(x => x.club === c);
              return (
                <Link key={c} to={`/club/${encodeURIComponent(c)}`} className="fav-club">
                  <Crest club={c} size={30} />
                  <span className="strong">{c}</span>
                  <span className="tiny muted">{r ? `${r.rank}${r.rank === 1 ? 'er' : 'e'} · ${r.pts} pts` : ''}</span>
                  {m && <span className="tiny">{m.h === c ? 'vs' : 'à'} {m.h === c ? m.a : m.h}</span>}
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
                  sub={`${p.club}${m ? ` · ${m.h === p.club ? 'vs' : 'à'} ${m.h === p.club ? m.a : m.h}` : ''}${p.absence ? ' · absent' : ''}`}
                  extra={<span className="tiny muted">pts/match</span>} />
              );
            })}
          </Group>
        )}
        {!favPlayers.length && !fav.clubs.length && (
          <p className="hint-line small muted"><Star filled={false} size={16} /> Touchez l'étoile d'une fiche joueur ou club pour l'épingler ici.</p>
        )}
      </Section>

      <div className="cols">
        <div>
          <Section title="Joueurs à suivre">
            <div className="seg glass-seg watch-seg" role="tablist" aria-label="Liste de joueurs">
              {WATCH.map(w => <button key={w.k} role="tab" aria-selected={watch === w.k} onClick={() => setWatch(w.k)}>{w.label}</button>)}
            </div>
            <p className="tiny muted">{W.meta}</p>
            <Group>
              {lists[watch].map(({ p, v, sub, trend }) => (
                <PlayerRow key={p.id} p={p} value={num(v)} sub={sub}
                  extra={trend && p.trend != null ? <Chip tone={p.trend >= 0 ? 'accent' : 'down'}>{p.trend >= 0 ? '↑' : '↓'} {num(Math.abs(p.trend))}</Chip> : undefined} />
              ))}
              {!lists[watch].length && <Empty>Pas encore assez de matchs.</Empty>}
            </Group>
            <Link to={`/joueurs?vue=${W.vue}`} className="textlink">Voir tout le classement ›</Link>
          </Section>
        </div>

        <div>
          <Section title="Absents qui comptent" meta={d.nextRound ? `J${d.nextRound}` : undefined}>
            <Group>
              {absent.slice(0, 3).map(p => (
                <Row key={p.id} to={`/joueur/${p.id}`}>
                  <Crest club={p.club} size={24} />
                  <span className="grow ellipsis"><span className="strong">{p.n}</span><small className="muted block ellipsis">{p.club} · {p.absence!.why} · {num(p.ptsAvg)} pts/m</small></span>
                  <Chip tone={ABSENCE[p.absence!.type].tone}>{ABSENCE[p.absence!.type].label}</Chip>
                </Row>
              ))}
              {!absent.length && <Empty>Pas d'absent important annoncé pour l'instant.</Empty>}
            </Group>
            <Link to="/infirmerie" className="textlink">Infirmerie · {d.season.absences.length} absents ›</Link>
          </Section>

          <Section title="Classement" meta={`après J${d.lastRound}`}>
            <Group>
              {d.table.slice(0, 5).map(r => (
                <Row key={r.club} to={`/club/${encodeURIComponent(r.club)}`} className="tight">
                  <span className="rank num-sm muted">{r.rank}</span>
                  <Crest club={r.club} size={22} />
                  <span className="grow strong">{r.club}</span>
                  <Form results={r.form} n={3} />
                  <span className="num-md pts">{r.pts}</span>
                </Row>
              ))}
            </Group>
            <Link to="/classement" className="textlink">Classement complet ›</Link>
          </Section>

          <Section title="Clubs">
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
        Données du {new Date(d.meta.updatedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
        {d.meta.warnings.length ? ' (scores seulement)' : ''} · points estimés, barème du Championnat des Étoiles.
      </p>
    </div>
  );
}
