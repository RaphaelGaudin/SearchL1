import type { ReactNode } from 'react';
import { clubByName } from '../lib/clubs.ts';
import { POSITION } from '../lib/format.ts';
import type { PlayerStats } from '../lib/model.ts';
import { Row } from './ui.tsx';

export function Avatar({ name, club }: { name: string; club: string }) {
  const c = clubByName.get(club)?.colors[0] ?? '#5E6B63';
  const parts = name.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return <span className="avatar" style={{ background: c }} aria-hidden="true">{ini}</span>;
}

/** Ligne joueur : avatar, nom, poste et club, valeur à droite. */
export function PlayerRow({ p, value, extra, sub, to }: { p: PlayerStats; value: ReactNode; extra?: ReactNode; sub?: ReactNode; to?: string }) {
  return (
    <Row to={to ?? `/matchs?club=${encodeURIComponent(p.club)}`}>
      <Avatar name={p.n} club={p.club} />
      <span className="grow ellipsis">
        <span className="strong">{p.n}</span>
        <small className="muted block">{sub ?? `${POSITION[p.pos]} · ${p.club}`}</small>
      </span>
      <span className="right-stack">
        <span className="num-md">{value}</span>
        {extra}
      </span>
    </Row>
  );
}
