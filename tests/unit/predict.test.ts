import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { backtest } from '../../src/lib/backtest.ts';
import { fit, poisson, predict, probs, rps, type ModelMatch } from '../../src/lib/predict.ts';
import type { HistoryFile } from '../../src/lib/types.ts';

describe('lois de probabilité', () => {
  it('Poisson somme à 1', () => {
    expect(poisson(1.4, 30).reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
  });
  it('1-N-2 somme à 1 et reste symétrique', () => {
    const p = probs(1.3, 1.3, -0.05);
    expect(p.H + p.D + p.A).toBeCloseTo(1, 10);
    expect(p.H).toBeCloseTo(p.A, 10);
  });
  it('Dixon-Coles (rho < 0) augmente un peu les nuls', () => {
    expect(probs(1.2, 1.1, -0.05).D).toBeGreaterThan(probs(1.2, 1.1, 0).D);
  });
  it('RPS : 0 pour un pronostic parfait, 1 pour le pire', () => {
    expect(rps({ H: 1, D: 0, A: 0 }, 2, 0)).toBe(0);
    expect(rps({ H: 0, D: 0, A: 1 }, 2, 0)).toBe(1);
  });
});

describe('ajustement et facteurs', () => {
  // Petit championnat fictif : Fort bat tout le monde, Faible perd tout.
  const teams = ['Fort', 'Moyen', 'Faible'];
  const ms: ModelMatch[] = [];
  for (let t = 0; t < 300; t += 7) {
    ms.push({ t, h: 'Fort', a: 'Faible', hg: 3, ag: 0 }, { t, h: 'Moyen', a: 'Faible', hg: 2, ag: 1 }, { t, h: 'Fort', a: 'Moyen', hg: 2, ag: 1 });
    ms.push({ t: t + 3, h: 'Faible', a: 'Fort', hg: 0, ag: 2 }, { t: t + 3, h: 'Faible', a: 'Moyen', hg: 1, ag: 1 }, { t: t + 3, h: 'Moyen', a: 'Fort', hg: 1, ag: 2 });
  }
  const F = fit(ms, 310, teams);

  it('classe les forces dans le bon ordre', () => {
    expect(F.att.Fort).toBeGreaterThan(F.att.Moyen);
    expect(F.att.Moyen).toBeGreaterThan(F.att.Faible);
    expect(F.def.Fort).toBeLessThan(F.def.Faible);
  });

  it('donne le favori gagnant et explique chaque étape', () => {
    const p = predict(F, 'Fort', 'Faible');
    expect(p.H).toBeGreaterThan(0.6);
    expect(p.steps.map(s => s.key)).toEqual(['forces', 'terrain', 'forme', 'h2h', 'absents', 'coupe']);
    expect(p.steps.at(-1)!.H).toBeCloseTo(p.H, 10);
  });

  it('borne les corrections : face-à-face ±7 %, absents et fatigue appliqués', () => {
    const h2h = Array.from({ length: 8 }, () => ({ h: 'Faible', a: 'Fort', hg: 5, ag: 0 }));
    const p = predict(F, 'Fort', 'Faible', { h2h });
    expect(p.hm).toBeGreaterThanOrEqual(0.93);
    const tired = predict(F, 'Fort', 'Faible', { rest: { Fort: 0.97 } });
    expect(tired.H).toBeLessThan(predict(F, 'Fort', 'Faible').H);
    const missing = predict(F, 'Fort', 'Faible', { abs: { Fort: { att: 0.85, def: 1 } } });
    expect(missing.lh).toBeCloseTo(predict(F, 'Fort', 'Faible').lh * 0.85, 10);
  });

  it('part des valeurs de promu pour un club inconnu', () => {
    const G = fit(ms, 310, [...teams, 'Promu']);
    expect(G.att.Promu).toBeLessThan(1);
    expect(G.def.Promu).toBeGreaterThan(1);
  });
});

describe('backtest de référence (2023-24 à 2025-26)', () => {
  const file = 'public/data/history.json';
  const history: HistoryFile | null = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

  it.runIf(history)('RPS ≈ 0,208, nettement mieux qu\'un pronostic fixe (≈ 0,233), bien calibré', () => {
    const r = backtest(history!, ['2023-24', '2024-25', '2025-26']);
    expect(r.n).toBeGreaterThanOrEqual(917);
    expect(r.rps).toBeLessThan(0.21);
    expect(r.rpsFixed).toBeGreaterThan(0.23);
    // Calibration : dans chaque tranche bien remplie, l'écart prévu / observé reste sous 5 points.
    for (const c of r.calibration.filter(c => c.n >= 100)) expect(Math.abs(c.predicted - c.observed)).toBeLessThan(0.05);
  }, 60_000);
});
