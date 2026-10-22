import { describe, expect, it } from 'vitest';
import { ageOf } from '../../src/lib/age.ts';

describe('âge du joueur', () => {
  it('compte les années révolues', () => {
    expect(ageOf('1994-05-14', new Date(2026, 9, 22))).toBe(32);
    expect(ageOf('2000-10-23', new Date(2026, 9, 22))).toBe(25);
    expect(ageOf('2000-10-22', new Date(2026, 9, 22))).toBe(26);
  });
});
