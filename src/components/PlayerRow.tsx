import { useState, type ReactNode } from 'react';
import { clubByName } from '../lib/clubs.ts';
import { POSITION } from '../lib/format.ts';
import type { PlayerStats } from '../lib/model.ts';
import { SuperSubBadge } from './Glass.tsx';
import { Row } from './ui.tsx';

// Photos absentes ou en erreur : on ne les redemande pas à chaque affichage.
const noPhoto = new Set<number>();

/** Photo du joueur (public/photos, téléchargée par le script de données) ; à défaut, ses initiales aux couleurs du club. */
export function Avatar({ name, club, id, size = 36 }: { name: string; club: string; id?: number; size?: number }) {
  // L'échec est lié à l'identifiant : un même composant réutilisé pour un autre joueur retente sa photo.
  const [failed, setFailed] = useState<number | null>(null);
  const ko = id == null || failed === id || noPhoto.has(id);
  const c = clubByName.get(club)?.colors[0] ?? '#5E6B63';
  if (!ko)
    return (
      <span className="avatar avatar-photo" style={{ width: size, height: size }} aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}photos/${id}.webp`} alt="" width={size} height={size} loading="lazy" decoding="async"
          draggable={false} onError={() => { noPhoto.add(id!); setFailed(id!); }} />
      </span>
    );
  const parts = name.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return <span className="avatar" style={{ background: c, width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">{ini}</span>;
}

/** Nom du joueur suivi du badge supersub s'il le mérite. */
export function PlayerName({ p }: { p: PlayerStats }) {
  return <span className="pname"><span className="strong ellipsis">{p.n}</span>{p.superSub && <SuperSubBadge subAvg={p.subAvg} small />}</span>;
}

/** Ligne joueur : avatar, nom, poste et club, valeur à droite. */
export function PlayerRow({ p, value, extra, sub, to }: { p: PlayerStats; value: ReactNode; extra?: ReactNode; sub?: ReactNode; to?: string }) {
  return (
    <Row to={to ?? `/joueur/${p.id}`}>
      <Avatar name={p.n} club={p.club} id={p.id} />
      <span className="grow ellipsis">
        <PlayerName p={p} />
        <small className="muted block ellipsis">{sub ?? `${POSITION[p.pos]} · ${p.club}`}</small>
      </span>
      <span className="right-stack">
        <span className="num-md">{value}</span>
        {extra}
      </span>
    </Row>
  );
}
