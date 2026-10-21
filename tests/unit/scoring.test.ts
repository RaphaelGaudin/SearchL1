import { describe, expect, it } from 'vitest';
import { gamePoints, matchPoints, noteLEquipe } from '../../src/lib/scoring.ts';
import type { PlayerLog } from '../../src/lib/types.ts';

const log = (o: Partial<PlayerLog> = {}): PlayerLog => ({
  j: 1, match: 1, home: true, gf: 0, ga: 0, lu: true, sub: false, min: 90, r: 6.7,
  g: 0, pen: 0, a: 0, og: 0, y: 0, rc: 0, tk: 0, int: 0, kp: 0, xg: 0, xa: 0, sav: 0, gp: 0, ...o,
});

describe('note L\'Équipe estimée', () => {
  it('ramène 6,7 Sofascore à 5', () => expect(noteLEquipe(6.7, 90)).toBe(5));
  it('suit 5 + 1,5 × (r − 6,7), arrondi', () => {
    expect(noteLEquipe(8.0, 90)).toBe(7); // 6,95
    expect(noteLEquipe(6.0, 90)).toBe(4); // 3,95
  });
  it('est bornée entre 1 et 9', () => {
    expect(noteLEquipe(10, 90)).toBe(9);
    expect(noteLEquipe(3, 90)).toBe(1);
  });
  it('est absente sous 20 minutes ou sans note', () => {
    expect(noteLEquipe(7.5, 19)).toBeNull();
    expect(noteLEquipe(null, 90)).toBeNull();
    expect(noteLEquipe(7.5, 20)).toBe(6);
  });
});

describe('barème du Championnat des Étoiles', () => {
  it('points équipe : domicile et extérieur, ± 2 par but d\'écart', () => {
    expect(matchPoints(log({ home: true, gf: 2, ga: 1 }), 'M').team).toBe(8 + 2);
    expect(matchPoints(log({ home: true, gf: 1, ga: 1 }), 'M').team).toBe(2);
    expect(matchPoints(log({ home: true, gf: 0, ga: 2 }), 'M').team).toBe(-2 - 4);
    expect(matchPoints(log({ home: false, gf: 3, ga: 1 }), 'A').team).toBe(12 + 4);
    expect(matchPoints(log({ home: false, gf: 0, ga: 0 }), 'A').team).toBe(6);
    expect(matchPoints(log({ home: false, gf: 0, ga: 1 }), 'A').team).toBe(2 - 2);
  });

  it('proratise les points équipe au temps de jeu', () => {
    expect(matchPoints(log({ home: true, gf: 1, ga: 0, min: 45 }), 'A').team).toBeCloseTo((8 + 2) / 2);
  });

  it('clean sheet : gardien 12, défenseur 4, à partir de 60 minutes', () => {
    expect(matchPoints(log({ gf: 1, ga: 0 }), 'G').team).toBe(8 + 2 + 12);
    expect(matchPoints(log({ gf: 1, ga: 0 }), 'D').team).toBe(8 + 2 + 4);
    expect(matchPoints(log({ gf: 1, ga: 0 }), 'M').team).toBe(8 + 2);
    expect(matchPoints(log({ gf: 1, ga: 0, min: 59 }), 'D').team).toBeCloseTo((8 + 2) * 59 / 90);
    expect(matchPoints(log({ gf: 1, ga: 0, min: 60 }), 'D').team).toBeCloseTo((8 + 2 + 4) * 60 / 90);
  });

  it('note : 2 × (note − 5), 0 si non noté', () => {
    expect(matchPoints(log({ r: 8.0 }), 'M').note).toBe(4);
    expect(matchPoints(log({ r: 5.4 }), 'M').note).toBe(-4); // note 3
    expect(matchPoints(log({ r: 8.0, min: 15, sub: true }), 'M').note).toBe(0);
  });

  it('buts, penalties et passes selon le poste', () => {
    expect(matchPoints(log({ g: 1 }), 'G').actions).toBe(25);
    expect(matchPoints(log({ g: 1 }), 'D').actions).toBe(18);
    expect(matchPoints(log({ g: 1 }), 'M').actions).toBe(15);
    expect(matchPoints(log({ g: 1 }), 'A').actions).toBe(12);
    expect(matchPoints(log({ g: 2, pen: 1 }), 'A').actions).toBe(12 + 6);
    expect(matchPoints(log({ g: 1, pen: 1 }), 'D').actions).toBe(10);
    expect(matchPoints(log({ a: 1 }), 'M').actions).toBe(8);
    expect(matchPoints(log({ a: 2 }), 'D').actions).toBe(20);
    expect(matchPoints(log({ og: 1 }), 'D').actions).toBe(-5);
  });

  it('défense : tacles réussis et buts encaissés du gardien', () => {
    expect(matchPoints(log({ tk: 3 }), 'D').defense).toBe(9);
    expect(matchPoints(log({ tk: 3 }), 'M').defense).toBe(6);
    expect(matchPoints(log({ ga: 2, gf: 0 }), 'G').defense).toBe(-6);
    expect(matchPoints(log({ ga: 2, gf: 0 }), 'D').defense).toBe(0);
  });

  it('cartons : jaune −3, rouge −5', () => {
    expect(matchPoints(log({ y: 1 }), 'M').cards).toBe(-3);
    expect(matchPoints(log({ y: 1, rc: 1 }), 'M').cards).toBe(-8);
  });

  it('total = somme des sources', () => {
    const p = matchPoints(log({ home: false, gf: 2, ga: 0, r: 7.7, g: 1, tk: 2 }), 'D');
    expect(p.total).toBeCloseTo(p.team + p.note + p.actions + p.defense + p.cards);
    expect(p.total).toBe((12 + 4 + 4) + 2 * (7 - 5) + 18 + 6);
  });

  it('feuille incomplète : seulement actions et cartons', () => {
    const p = matchPoints(log({ lu: false, g: 1, y: 1, gf: 3, ga: 0 }), 'A');
    expect(p).toMatchObject({ partial: true, team: 0, note: 0, total: 12 - 3 });
  });

  it('bonus du jeu : capitaine, remplaçant, SuperSub', () => {
    expect(gamePoints(10, 'capitaine')).toBe(40);
    expect(gamePoints(10, 'remplaçant')).toBe(5);
    expect(gamePoints(10, 'supersub')).toBe(30);
    expect(gamePoints(10, 'supersub', false)).toBe(0);
  });
});
