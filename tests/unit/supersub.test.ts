import { describe, expect, it } from 'vitest';
import { isSuperSub } from '../../src/lib/model.ts';

const E = { sub: true }, T = { sub: false };

describe('bon supersub', () => {
  it('remplaçant sur les dernières journées et décisif en entrant', () => {
    expect(isSuperSub([E, E, T, E], 7.9, 5)).toBe(true);
    expect(isSuperSub([E, E], 5, 2)).toBe(true);
  });

  it('pas un titulaire qui a fait quelques bonnes entrées', () => {
    // 7 titularisations pour 2 entrées : c'est un titulaire.
    expect(isSuperSub([T, T, E, T, T], 9.5, 2)).toBe(false);
    // Plus d'entrées que de titularisations, mais pas deux fois plus.
    expect(isSuperSub([T, E, T, E, E], 8, 4)).toBe(false);
  });

  it('pas s\'il vient d\'être titularisé', () => {
    expect(isSuperSub([E, E, E, E, T], 7.6, 5)).toBe(false);
  });

  it('pas si ses entrées ne rapportent pas assez, ou s\'il est trop peu entré', () => {
    expect(isSuperSub([E, E, E], 1.6, 3)).toBe(false);
    expect(isSuperSub([E], 13, 1)).toBe(false);
    expect(isSuperSub([], null, 0)).toBe(false);
  });
});
