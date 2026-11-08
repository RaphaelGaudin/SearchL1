import { describe, expect, it } from 'vitest';
import { compoStatus } from '../../scripts/lib/compo.ts';
import type { SfLineups } from '../../scripts/lib/sofascore.ts';

const a = { id: 7, name: 'Marquinhos', club: 'PSG', match: 1, kickoff: '2026-11-21T19:45:00Z', opp: 'Lens' };
const pl = (id: number, substitute: boolean) => ({ player: { id, name: `J${id}` }, substitute });
const lineups = (confirmed: boolean, home: ReturnType<typeof pl>[], missing: SfLineups['home']['missingPlayers'] = []): SfLineups =>
  ({ confirmed, home: { players: home, missingPlayers: missing }, away: { players: [pl(99, false)] } });

describe('alerte compo : statut du joueur', () => {
  it('rien tant que la composition n\'est pas officielle', () => {
    expect(compoStatus(lineups(false, [pl(7, false)]), a)).toBeNull();
    expect(compoStatus(null, a)).toBeNull();
  });
  it('titulaire, remplaçant, absent, pas dans le groupe', () => {
    expect(compoStatus(lineups(true, [pl(7, false)]), a)!.title).toBe('Marquinhos est titulaire');
    expect(compoStatus(lineups(true, [pl(7, true)]), a)!.title).toBe('Marquinhos commence sur le banc');
    const abs = compoStatus(lineups(true, [pl(1, false)], [{ player: { id: 7, name: 'Marquinhos' }, type: 'missing', description: 'Blessure au mollet' }]), a)!;
    expect(abs.title).toBe('Marquinhos est absent');
    expect(abs.body).toContain('Blessure au mollet');
    expect(compoStatus(lineups(true, [pl(1, false)]), a)!.title).toBe("Marquinhos n'est pas dans le groupe");
  });
  it('heure de Paris dans le message', () => {
    expect(compoStatus(lineups(true, [pl(7, false)]), a)!.body).toBe('Titulaire · PSG – Lens · 20:45');
  });
});
