// Modèle de pronostic repris du prototype (pmFit / pmPredict / pmProbs).
// Poisson à forces attaque/défense (Maher, Dixon-Coles), pondéré dans le temps, avantage du terrain par club,
// puis corrections légères : forme, face-à-face, absents, match européen juste avant.

export interface ModelOptions {
  iters: number;
  /** Demi-vie de la pondération, en jours. */
  half: number;
  maxDays: number;
  /** Retour vers la moyenne : nombre de matchs fictifs. */
  k: number;
  kh: number;
  G: number;
  rho: number;
  gForm: number;
  nForm: number;
  gH2h: number;
  promoA: number;
  promoD: number;
}

export const DEFAULTS: ModelOptions = { iters: 20, half: 350, maxDays: 1100, k: 10, kh: 12, G: 1.35, rho: -0.05, gForm: 0.10, nForm: 6, gH2h: 0.12, promoA: 0.80, promoD: 1.22 };

/** Un match pour le modèle. t = numéro du jour (jours depuis 1970). */
export interface ModelMatch { t: number; h: string; a: string; hg: number | null; ag: number | null }
interface Weighted extends ModelMatch { hg: number; ag: number; w: number }

export interface Fit {
  att: Record<string, number>;
  def: Record<string, number>;
  hb: Record<string, number>;
  mu: number;
  HA: number;
  opt: ModelOptions;
  W: Weighted[];
  ref: number;
}

/**
 * Ajustement par mises à jour successives par blocs (attaque, défense, terrain, avantage domicile, moyenne).
 * Les mises à jour simultanées divergent : l'ordre compte.
 */
export function fit(all: ModelMatch[], ref: number, teams: string[], o: Partial<ModelOptions> = {}): Fit {
  const opt = { ...DEFAULTS, ...o };
  const xi = Math.LN2 / opt.half;
  const W: Weighted[] = all
    .filter((m): m is ModelMatch & { hg: number; ag: number } => m.t < ref && ref - m.t < opt.maxDays && m.hg != null && m.ag != null)
    .map(m => ({ ...m, w: Math.exp(-xi * (ref - m.t)) }));
  const T = new Set(teams);
  W.forEach(m => { T.add(m.h); T.add(m.a); });
  // Promu = club absent des matchs joués entre 60 et 400 jours avant la date de référence.
  const prev = new Set<string>();
  W.forEach(m => { if (ref - m.t > 60 && ref - m.t < 400) { prev.add(m.h); prev.add(m.a); } });
  const att: Record<string, number> = {}, def: Record<string, number> = {}, hb: Record<string, number> = {};
  const a0: Record<string, number> = {}, d0: Record<string, number> = {};
  T.forEach(t => {
    const promoted = !prev.has(t);
    a0[t] = promoted ? opt.promoA : 1;
    d0[t] = promoted ? opt.promoD : 1;
    att[t] = a0[t]; def[t] = d0[t]; hb[t] = 1;
  });
  let mu = opt.G, HA = 1.25;
  const { G, k, kh } = opt;
  const lam = (m: Weighted): [number, number] => [mu * HA * hb[m.h] * att[m.h] * def[m.a], (mu * att[m.a] * def[m.h]) / hb[m.h]];
  const cur = teams.length ? teams : [...T];
  const zero = () => Object.fromEntries([...T].map(t => [t, 0])) as Record<string, number>;

  for (let it = 0; it < opt.iters; it++) {
    let O = zero(), E = zero();
    W.forEach(m => { const [lh, la] = lam(m); O[m.h] += m.w * m.hg; E[m.h] += (m.w * lh) / att[m.h]; O[m.a] += m.w * m.ag; E[m.a] += (m.w * la) / att[m.a]; });
    T.forEach(t => (att[t] = (O[t] + k * a0[t] * G) / (E[t] + k * G)));

    O = zero(); E = zero();
    W.forEach(m => { const [lh, la] = lam(m); O[m.a] += m.w * m.hg; E[m.a] += (m.w * lh) / def[m.a]; O[m.h] += m.w * m.ag; E[m.h] += (m.w * la) / def[m.h]; });
    T.forEach(t => (def[t] = (O[t] + k * d0[t] * G) / (E[t] + k * G)));

    const Hf = zero(), HEf = zero(), Ha = zero(), HEa = zero();
    W.forEach(m => { const [lh, la] = lam(m); Hf[m.h] += m.w * m.hg; HEf[m.h] += (m.w * lh) / hb[m.h]; Ha[m.h] += m.w * m.ag; HEa[m.h] += m.w * la * hb[m.h]; });
    T.forEach(t => (hb[t] = Math.sqrt((Hf[t] + kh * G) / (HEf[t] + kh * G) / ((Ha[t] + kh * G) / (HEa[t] + kh * G)))));

    let sh = 0, eh = 0;
    W.forEach(m => { const [lh] = lam(m); sh += m.w * m.hg; eh += (m.w * lh) / HA; });
    if (eh > 0) HA = sh / eh;

    let sg = 0, eg = 0;
    W.forEach(m => { const [lh, la] = lam(m); sg += m.w * (m.hg + m.ag); eg += (m.w * (lh + la)) / mu; });
    if (eg > 0) mu = sg / eg;

    const ga = Math.exp(cur.reduce((s, t) => s + Math.log(att[t]), 0) / cur.length);
    const gd = Math.exp(cur.reduce((s, t) => s + Math.log(def[t]), 0) / cur.length);
    T.forEach(t => { att[t] /= ga; def[t] /= gd; });
    mu *= ga * gd;
  }
  return { att, def, hb, mu, HA, opt, W, ref };
}

export function poisson(l: number, n: number): number[] {
  let p = Math.exp(-l);
  const o = [p];
  for (let i = 1; i <= n; i++) { p *= l / i; o.push(p); }
  return o;
}

export interface Probs { H: number; D: number; A: number; score: [number, number]; csH: number; csA: number }

/** Probabilités 1-N-2 avec correction Dixon-Coles des petits scores. */
export function probs(lh: number, la: number, rho: number): Probs {
  const N = 10, ph = poisson(lh, N), pa = poisson(la, N);
  let H = 0, D = 0, A = 0, csH = 0, csA = 0, tot = 0;
  let best: [number, number, number] = [0, 0, 0];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    let p = ph[i] * pa[j];
    if (i === 0 && j === 0) p *= 1 - lh * la * rho;
    else if (i === 0 && j === 1) p *= 1 + lh * rho;
    else if (i === 1 && j === 0) p *= 1 + la * rho;
    else if (i === 1 && j === 1) p *= 1 - rho;
    tot += p;
    if (i > j) H += p; else if (i === j) D += p; else A += p;
    if (p > best[2]) best = [i, j, p];
    if (j === 0) csH += p;
    if (i === 0) csA += p;
  }
  return { H: H / tot, D: D / tot, A: A / tot, score: [best[0], best[1]], csH: csH / tot, csA: csA / tot };
}

export interface FormInfo { fa: number; fd: number; n: number; gf: number; ga: number; ef: number; ea: number }
export interface H2hMatch { h: string; a: string; hg: number; ag: number }
export interface Context {
  /** Face-à-face antérieurs, du plus récent au plus ancien. */
  h2h?: H2hMatch[];
  /** Multiplicateurs liés aux absents. */
  abs?: Record<string, { att: number; def: number }>;
  /** Multiplicateur de fraîcheur (match européen 3 jours avant ou moins). */
  rest?: Record<string, number>;
}

export interface Prediction extends Probs {
  lh: number;
  la: number;
  base: { lh: number; la: number };
  fh: FormInfo;
  fa: FormInfo;
  hm: number;
  ah: { att: number; def: number };
  aa: { att: number; def: number };
  rh: number;
  ra: number;
  hbH: number;
  hbA: number;
  /** Effet de chaque facteur, ajouté dans l'ordre, pour l'expliquer à l'écran. */
  steps: { key: StepKey; H: number; D: number; A: number; lh: number; la: number }[];
}
export type StepKey = 'forces' | 'terrain' | 'forme' | 'h2h' | 'absents' | 'coupe';

function form(F: Fit, t: string): FormInfo {
  const o = F.opt;
  const L = F.W.filter(m => m.h === t || m.a === t).sort((x, y) => y.t - x.t).slice(0, o.nForm);
  if (L.length < 2) return { fa: 1, fd: 1, n: 0, gf: 0, ga: 0, ef: 0, ea: 0 };
  let gf = 0, ga = 0, ef = 0, ea = 0;
  L.forEach(m => {
    const home = m.h === t;
    const lH = F.mu * F.HA * F.hb[m.h] * F.att[m.h] * F.def[m.a];
    const lA = (F.mu * F.att[m.a] * F.def[m.h]) / F.hb[m.h];
    gf += home ? m.hg : m.ag; ga += home ? m.ag : m.hg;
    ef += home ? lH : lA; ea += home ? lA : lH;
  });
  const c = (v: number) => Math.max(0.85, Math.min(1.15, v));
  return { fa: c(Math.pow((gf + 1.5) / (ef + 1.5), o.gForm)), fd: c(Math.pow((ga + 1.5) / (ea + 1.5), o.gForm)), n: L.length, gf, ga, ef, ea };
}

export function predict(F: Fit, h: string, a: string, ctx: Context = {}): Prediction {
  const o = F.opt;
  const steps: Prediction['steps'] = [];
  const push = (key: StepKey, lh: number, la: number) => { const p = probs(lh, la, o.rho); steps.push({ key, H: p.H, D: p.D, A: p.A, lh, la }); };
  const att = (t: string) => F.att[t] ?? o.promoA;
  const def = (t: string) => F.def[t] ?? o.promoD;
  const hbOf = (t: string) => F.hb[t] ?? 1;

  // Forces seules, avec l'avantage domicile moyen de la L1 ; puis l'avantage propre au club.
  push('forces', F.mu * F.HA * att(h) * def(a), F.mu * att(a) * def(h));
  let lh = F.mu * F.HA * hbOf(h) * att(h) * def(a);
  let la = (F.mu * att(a) * def(h)) / hbOf(h);
  const base = { lh, la };
  push('terrain', lh, la);

  // Forme : écart entre buts réels et buts attendus par le modèle sur les derniers matchs.
  const fh = form(F, h), fa = form(F, a);
  lh *= fh.fa * fa.fd; la *= fa.fa * fh.fd;
  push('forme', lh, la);

  // Face-à-face : léger, plafonné.
  let hm = 1;
  const H2 = (ctx.h2h ?? []).slice(0, 8);
  if (H2.length && o.gH2h) {
    let gh = 0, gA = 0;
    H2.forEach(m => { if (m.h === h) { gh += m.hg; gA += m.ag; } else { gh += m.ag; gA += m.hg; } });
    hm = Math.max(0.93, Math.min(1.07, Math.pow((gh + 3) / (gA + 3), (o.gH2h * H2.length) / 8)));
    lh *= hm; la /= hm;
  }
  push('h2h', lh, la);

  const ab = ctx.abs ?? {};
  const ah = ab[h] ?? { att: 1, def: 1 }, aa = ab[a] ?? { att: 1, def: 1 };
  lh *= ah.att * aa.def; la *= aa.att * ah.def;
  push('absents', lh, la);

  const rs = ctx.rest ?? {};
  const rh = rs[h] ?? 1, ra = rs[a] ?? 1;
  lh *= rh / ra; la *= ra / rh;
  push('coupe', lh, la);

  const P = probs(lh, la, o.rho);
  return { ...P, lh, la, base, fh, fa, hm, ah, aa, rh, ra, hbH: hbOf(h), hbA: hbOf(a), steps };
}

/** Ranked Probability Score pour un résultat 1-N-2 (plus bas = mieux). */
export function rps(p: { H: number; D: number; A: number }, hg: number, ag: number): number {
  const o = hg > ag ? [1, 0, 0] : hg === ag ? [0, 1, 0] : [0, 0, 1];
  const c1 = p.H - o[0], c2 = p.H + p.D - o[0] - o[1];
  return (c1 * c1 + c2 * c2) / 2;
}

/** Jour (jours depuis 1970) d'une date, en heure de Paris. */
export function dayNum(d: string | Date): number {
  const s = typeof d === 'string' && !d.includes('T') ? d : new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  return Math.round(Date.parse(s + 'T12:00:00Z') / 864e5);
}
