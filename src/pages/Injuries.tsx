import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crest } from '../components/Crest.tsx';
import { LargeTitle, NavBar } from '../components/Glass.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar, PlayerName } from '../components/PlayerRow.tsx';
import { Chip, Empty, Group, Row } from '../components/ui.tsx';
import { CLUBS } from '../lib/clubs.ts';
import { useData } from '../lib/data.tsx';
import { dateShort, dayShort, norm, num, POSITION } from '../lib/format.ts';
import { importance, type PlayerStats } from '../lib/model.ts';
import type { Absence } from '../lib/types.ts';

export const ABSENCE = {
  B: { tone: 'down', label: 'Blessé', plural: 'Blessés' },
  S: { tone: 'down', label: 'Suspendu', plural: 'Suspendus' },
  D: { tone: 'warn', label: 'Incertain', plural: 'Incertains' },
  C: { tone: 'neutral', label: 'Non retenu', plural: 'Autres' },
} as const;
const TYPES = ['B', 'S', 'D', 'C'] as const;

/** Date de retour lisible ; « à préciser » si la source n'en donne pas ou si elle est déjà passée. */
export function returnLabel(a: Absence): string | null {
  if (!a.until) return null;
  const t = Date.parse(a.until);
  if (!isFinite(t) || t < Date.now() - 864e5) return null;
  return `retour ~${dateShort(a.until)}`;
}

interface Item { a: Absence; p?: PlayerStats; imp: number }

export function Injuries() {
  const d = useData();
  const [params, setParams] = useSearchParams();
  const club = params.get('club');
  const type = params.get('type') as Absence['type'] | null;
  const [q, setQ] = useState('');
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v == null) p.delete(k); else p.set(k, v);
    setParams(p, { replace: true });
  };

  const all: Item[] = useMemo(() => d.season.absences.map(a => {
    const p = a.playerId != null ? d.playerById.get(a.playerId) : undefined;
    return { a, p, imp: p ? importance(p) : -1 };
  }), [d]);

  const s = norm(q.trim());
  const shown = all.filter(x => (!club || x.a.club === club) && (!type || x.a.type === type) && (!s || norm(`${x.p?.n ?? x.a.player} ${x.a.player} ${x.a.club}`).includes(s)));
  const count = (t: Absence['type']) => all.filter(x => x.a.type === t && (!club || x.a.club === club)).length;
  const perClub = (c: string) => all.filter(x => x.a.club === c && (!type || x.a.type === type)).length;

  // Groupes par club : les clubs qui perdent le plus de titulaires d'abord.
  const groups = [...new Set(shown.map(x => x.a.club))]
    .map(c => ({ c, items: shown.filter(x => x.a.club === c).sort((x, y) => y.imp - x.imp) }))
    .sort((x, y) => y.items.filter(i => (i.p?.starts ?? 0) >= 3).length - x.items.filter(i => (i.p?.starts ?? 0) >= 3).length || x.c.localeCompare(y.c, 'fr'));
  const nextOf = (c: string) => d.matches.find(m => m.status !== 'finished' && (m.h === c || m.a === c));

  return (
    <div className="page">
      <NavBar title="Infirmerie" back="Plus" fallback="/" />
      <LargeTitle sub={`${d.nextRound ? `Avant la J${d.nextRound}` : 'Prochaine journée'} · ${all.length} absents · source ${all[0]?.a.source ?? 'Sofascore'}`}>Infirmerie</LargeTitle>

      <div className="inj-counters" role="group" aria-label="Filtrer par type">
        {TYPES.map(t => (
          <button key={t} className={`tile inj-tile t-${t}${type === t ? ' on' : ''}`} aria-pressed={type === t} onClick={() => set('type', type === t ? null : t)}>
            <b className="num-lg">{count(t)}</b><span className="small" title={t === 'C' ? 'Non retenus, ménagés, raisons personnelles…' : undefined}>{ABSENCE[t].plural}</span>
          </button>
        ))}
      </div>

      <div className="rail club-rail inj-rail" role="tablist" aria-label="Filtrer par club">
        <button role="tab" className={`rail-item${!club ? ' on' : ''}`} aria-current={!club} onClick={() => set('club', null)}>
          <span className="inj-all num-sm">{all.filter(x => !type || x.a.type === type).length}</span><span className="tiny">Tous</span>
        </button>
        {CLUBS.map(c => {
          const n = perClub(c.name);
          return (
            <button key={c.name} role="tab" className={`rail-item${club === c.name ? ' on' : ''}${n ? '' : ' none'}`} aria-current={club === c.name}
              aria-label={`${c.name} : ${n} absent${n > 1 ? 's' : ''}`} onClick={() => set('club', club === c.name ? null : c.name)}>
              <Crest club={c.name} size={30} />
              {n > 0 && <span className="inj-count">{n}</span>}
              <span className="tiny">{c.name}</span>
            </button>
          );
        })}
      </div>

      <label className="search-field inline">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Joueur ou club" autoComplete="off" autoCorrect="off" spellCheck={false} />
      </label>

      {groups.map(({ c, items }) => {
        const m = nextOf(c);
        return (
          <section key={c} className="day">
            <h3 className="dayhead inj-head">
              <Link to={`/club/${encodeURIComponent(c)}`} className="inj-club"><Crest club={c} size={20} /> {c}</Link>
              <span className="muted">{items.length} absent{items.length > 1 ? 's' : ''}{m ? ` · ${m.h === c ? 'vs' : 'à'} ${m.h === c ? m.a : m.h} ${dayShort(m.d)}` : ''}</span>
            </h3>
            <Group>
              {items.map(({ a, p }) => {
                const ret = returnLabel(a);
                const key = p && p.starts >= Math.max(2, d.lastRound / 2);
                return (
                  <Row key={a.club + a.player} to={p ? `/joueur/${p.id}` : undefined}>
                    <Avatar name={p?.n ?? a.player} club={c} />
                    <span className="grow ellipsis">
                      {p ? <PlayerName p={p} /> : <span className="strong">{a.player}</span>}
                      <small className="muted block ellipsis">{p ? `${POSITION[p.pos]} · ` : ''}{a.why}</small>
                      <small className="block ellipsis">
                        {p ? <>{key && <span className="key-tag">titulaire</span>}{p.starts} tit. · {num(p.ptsAvg)} pts/m</> : <span className="muted">pas encore joué en L1</span>}
                      </small>
                    </span>
                    <span className="right-stack">
                      <Chip tone={ABSENCE[a.type].tone}>{ABSENCE[a.type].label}</Chip>
                      <span className="tiny muted">{ret ?? 'retour à préciser'}</span>
                    </span>
                  </Row>
                );
              })}
            </Group>
          </section>
        );
      })}
      {!groups.length && <Empty>{all.length ? 'Aucun absent avec ces filtres.' : 'Aucun absent annoncé pour la prochaine journée.'}</Empty>}
      <p className="tiny muted">Liste des absents publiée par Sofascore avant chaque match de la prochaine journée, mise à jour le lundi et le vendredi. « Titulaire » : au moins la moitié des matchs commencés.</p>
    </div>
  );
}
