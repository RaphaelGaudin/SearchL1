import { describe, expect, it } from 'vitest';
import { parseSeason } from '../../scripts/lib/openfootball.ts';
import { checkGoals, checkStandings } from '../../scripts/lib/validate.ts';
import { buildTable } from '../../src/lib/standings.ts';
import type { Match, Player } from '../../src/lib/types.ts';

describe('openfootball', () => {
  it('lit l\'ancien format (« Matchday », « A v B 1-0 »)', () => {
    const txt = `▪ Matchday 1
  Fri Aug 16 2024
    20:45  Le Havre AC             v Paris Saint-Germain FC   1-4 (0-1)
  Sat Aug 17
           AS Monaco FC            v AS Saint-Étienne         1-0 (1-0)
▪ Matchday 20
  Sat Jan 11
    17:00  Olympique Lyonnais      v AS Monaco FC
`;
    expect(parseSeason(txt, 2024)).toEqual([
      { j: 1, date: '2024-08-16', time: '20:45', h: 'Le Havre', a: 'PSG', hg: 1, ag: 4 },
      { j: 1, date: '2024-08-17', time: '20:45', h: 'Monaco', a: 'Saint-Étienne', hg: 1, ag: 0 },
      { j: 20, date: '2025-01-11', time: '17:00', h: 'Lyon', a: 'Monaco', hg: null, ag: null },
    ]);
  });

  it('lit le format 2025-26 (« Regular Season », score au milieu) et ignore les annulés', () => {
    const txt = `▪ Regular Season - 1
Fri Aug 15 2025
  20:45   Rennes  1-0 (0-0)  Olympique Marseille
                  (Ludovic Blas 90+1')
    15:00  Amiens SC   v Lille OSC   [cancelled]
`;
    expect(parseSeason(txt, 2025)).toEqual([{ j: 1, date: '2025-08-15', time: '20:45', h: 'Rennes', a: 'Marseille', hg: 1, ag: 0 }]);
  });
});

const M = (id: number, h: string, a: string, hg: number, ag: number): Match => ({ id, j: id, d: `2026-08-${10 + id}T18:00:00Z`, h, a, hg, ag, status: 'finished' });

describe('vérifications des mises à jour', () => {
  const matches = [M(1, 'Lens', 'Lille', 2, 1), M(2, 'Lille', 'PSG', 0, 0)];

  it('classement : points, différence de buts, forme', () => {
    const t = buildTable(matches);
    expect(t.map(r => [r.club, r.pts, r.gd])).toEqual([['Lens', 3, 1], ['PSG', 1, 0], ['Lille', 1, -1]]);
    expect(t.find(r => r.club === 'Lille')!.form).toEqual(['D', 'N']);
  });

  it('détecte un classement publié différent', () => {
    const ok = [{ club: 'Lens', mp: 1, pts: 3, gf: 2, ga: 1 }, { club: 'Lille', mp: 2, pts: 1, gf: 1, ga: 2 }, { club: 'PSG', mp: 1, pts: 1, gf: 0, ga: 0 }];
    expect(checkStandings(matches, ok)).toEqual([]);
    expect(checkStandings(matches, ok.map(r => (r.club === 'PSG' ? { ...r, pts: 3 } : r)))).toHaveLength(1);
  });

  it('buts des joueurs + csc = score, sinon match signalé', () => {
    const base = { j: 1, match: 1, gf: 2, ga: 1, lu: true, sub: false, min: 90, r: 7, pen: 0, a: 0, y: 0, rc: 0, tk: 0, int: 0, kp: 0, xg: 0, xa: 0, sav: 0, gp: 0 };
    const players: Player[] = [
      { id: 1, n: 'A', club: 'Lens', pos: 'A', logs: [{ ...base, home: true, g: 1, og: 0 }] },
      { id: 2, n: 'B', club: 'Lille', pos: 'D', logs: [{ ...base, home: false, gf: 1, ga: 2, g: 1, og: 1 }] },
    ];
    expect(checkGoals([matches[0]], players).bad).toEqual([]);
    players[1].logs[0].og = 0;
    expect(checkGoals([matches[0]], players).bad).toEqual([1]);
  });
});
