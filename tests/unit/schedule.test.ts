import { describe, expect, it } from 'vitest';
import { slot } from '../../src/lib/schedule.ts';

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
