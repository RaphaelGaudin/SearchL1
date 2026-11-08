// Statut d'un joueur dans une composition officielle Sofascore (alertes « compo »).
import type { SfLineups } from './sofascore.ts';

export interface Alert { id: number; name: string; club: string; match: number; kickoff: string; opp: string }

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

/** Notification à envoyer, ou null si la composition n'est pas encore officielle. */
export function compoStatus(L: SfLineups | null, a: Alert): { title: string; body: string } | null {
  if (!L?.confirmed) return null;
  const where = `${a.club} – ${a.opp} · ${time(a.kickoff)}`;
  for (const side of [L.home, L.away]) {
    const p = side.players.find(x => x.player.id === a.id);
    if (p) return p.substitute
      ? { title: `${a.name} commence sur le banc`, body: `Remplaçant · ${where}` }
      : { title: `${a.name} est titulaire`, body: `Titulaire · ${where}` };
    const m = side.missingPlayers?.find(x => x.player.id === a.id);
    if (m) return { title: `${a.name} est absent`, body: `${m.description ?? (m.type === 'suspended' ? 'suspendu' : 'absent')} · ${where}` };
  }
  return { title: `${a.name} n'est pas dans le groupe`, body: `Ni titulaire ni remplaçant · ${where}` };
}
