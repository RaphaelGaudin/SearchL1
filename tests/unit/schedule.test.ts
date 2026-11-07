import { describe, expect, it } from 'vitest';
import { awaitingScores, lastScoreSlot, scoreSlots, slot } from '../../src/lib/schedule.ts';

const iso = (t: number) => new Date(t).toISOString();

describe('créneaux de mise à jour (heure de Paris)', () => {
  it('lundi 18 h 30 en heure d\'été = 16 h 30 UTC', () => {
    // mardi 20 octobre 2026, midi UTC → dernier créneau : lundi 19 octobre 18 h 30 à Paris
    expect(iso(slot(Date.parse('2026-10-20T12:00:00Z')))).toBe('2026-10-19T16:30:00.000Z');
  });
  it('vendredi 8 h en heure d\'hiver = 7 h UTC', () => {
    expect(iso(slot(Date.parse('2026-11-07T09:00:00Z')))).toBe('2026-11-06T07:00:00.000Z');
  });
  it('donne le prochain créneau', () => {
    expect(iso(slot(Date.parse('2026-10-22T10:00:00Z'), true))).toBe('2026-10-23T06:00:00.000Z');
    expect(iso(slot(Date.parse('2026-10-23T06:00:01Z'), true))).toBe('2026-10-26T17:30:00.000Z'); // passage à l'heure d'hiver le 25
  });
  it('un créneau passé d\'une seconde compte', () => {
    expect(iso(slot(Date.parse('2026-10-23T06:00:01Z')))).toBe('2026-10-23T06:00:00.000Z');
  });
});

describe('récupération des scores après les matchs', () => {
  const m = (d: string, status = 'notstarted') => ({ d, status });
  it('une seule récupération pour des matchs qui finissent ensemble, après le dernier', () => {
    const a = m('2026-11-08T14:00:00Z'), b = m('2026-11-08T14:00:00Z'), c = m('2026-11-08T14:15:00Z'), d = m('2026-11-08T16:15:00Z');
    const s = scoreSlots([a, b, c, d]);
    expect(iso(s.get(a)!)).toBe('2026-11-08T16:15:00.000Z');
    expect(s.get(b)).toBe(s.get(a));
    expect(s.get(c)).toBe(s.get(a));
    expect(iso(s.get(d)!)).toBe('2026-11-08T18:15:00.000Z');
  });
  it('attend les scores manquants pendant 24 h, pas les matchs reportés', () => {
    const ms = [m('2026-11-08T14:00:00Z'), m('2026-11-08T14:15:00Z', 'finished'), m('2026-11-08T14:00:00Z', 'postponed')];
    expect(awaitingScores(ms, Date.parse('2026-11-08T16:10:00Z'))).toHaveLength(0); // le groupe n'est pas fini
    expect(awaitingScores(ms, Date.parse('2026-11-08T16:15:00Z'))).toEqual([ms[0]]);
    expect(iso(lastScoreSlot(ms, Date.parse('2026-11-08T20:00:00Z')))).toBe('2026-11-08T16:15:00.000Z');
    expect(awaitingScores(ms, Date.parse('2026-11-09T17:00:00Z'))).toHaveLength(0);
  });
});
