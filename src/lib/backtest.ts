// Backtest du modèle : pour chaque jour de match, ajustement sur les seuls matchs antérieurs puis pronostic.
import { dayNum, fit, predict, rps, type ModelMatch, type ModelOptions } from './predict.ts';
import type { HistoryFile } from './types.ts';

export interface BacktestResult {
  n: number;
  rps: number;
  /** RPS d'un pronostic fixe : fréquences 1-N-2 des saisons d'avant. */
  rpsFixed: number;
  /** Calibration : par tranche de 10 points de probabilité, fréquence observée. */
  calibration: { bin: number; n: number; predicted: number; observed: number }[];
}

export function backtest(history: HistoryFile, seasons: string[], opt: Partial<ModelOptions> = {}): BacktestResult {
  const all: (ModelMatch & { s: string })[] = history.seasons.flatMap(S => S.m.map(r => ({ s: S.s, t: dayNum(r[1]), h: r[2], a: r[3], hg: r[4], ag: r[5] })));
  const first = Math.min(...all.filter(m => seasons.includes(m.s)).map(m => m.t));
  const before = all.filter(m => m.t < first);
  const f = { H: 0, D: 0, A: 0 };
  before.forEach(m => { if (m.hg! > m.ag!) f.H++; else if (m.hg === m.ag) f.D++; else f.A++; });
  const fixed = { H: f.H / before.length, D: f.D / before.length, A: f.A / before.length };

  let sum = 0, sumFixed = 0, n = 0;
  const bins = Array.from({ length: 10 }, (_, bin) => ({ bin, n: 0, predicted: 0, observed: 0 }));
  for (const s of seasons) {
    const ms = all.filter(m => m.s === s);
    const teams = [...new Set(ms.flatMap(m => [m.h, m.a]))];
    const days = [...new Set(ms.map(m => m.t))].sort((x, y) => x - y);
    for (const t of days) {
      const F = fit(all, t, teams, opt);
      for (const m of ms.filter(x => x.t === t)) {
        const h2h = all
          .filter(x => x.t < t && ((x.h === m.h && x.a === m.a) || (x.h === m.a && x.a === m.h)))
          .sort((x, y) => y.t - x.t)
          .map(x => ({ h: x.h, a: x.a, hg: x.hg!, ag: x.ag! }));
        const p = predict(F, m.h, m.a, { h2h });
        sum += rps(p, m.hg!, m.ag!);
        sumFixed += rps(fixed, m.hg!, m.ag!);
        n++;
        const out = m.hg! > m.ag! ? [1, 0, 0] : m.hg === m.ag ? [0, 1, 0] : [0, 0, 1];
        [p.H, p.D, p.A].forEach((q, i) => {
          const b = bins[Math.min(9, Math.floor(q * 10))];
          b.n++; b.predicted += q; b.observed += out[i];
        });
      }
    }
  }
  return {
    n, rps: sum / n, rpsFixed: sumFixed / n,
    calibration: bins.filter(b => b.n).map(b => ({ bin: b.bin, n: b.n, predicted: b.predicted / b.n, observed: b.observed / b.n })),
  };
}
