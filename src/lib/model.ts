// Tout ce que l'app calcule à partir des JSON : points des joueurs, classement, coupes, pronostics.
import { CLUB_NAMES } from './clubs.ts';
import { dayGap, parisDay } from './format.ts';
import { dayNum, fit, predict, type Context, type Fit, type H2hMatch, type ModelMatch, type Prediction } from './predict.ts';
import { matchPoints, type MatchPoints } from './scoring.ts';
import { buildTable, type TableRow } from './standings.ts';
import type { Absence, CupMatch, HistoryFile, Match, MetaFile, Player, PlayerLog, SeasonFile } from './types.ts';

export interface ScoredLog extends PlayerLog { P: MatchPoints }

/** Points par entrée en jeu en dessous desquels on ne parle jamais de bon supersub. */
export const SUPERSUB_MIN = 6;

export interface PlayerStats extends Omit<Player, 'logs'> {
  logs: ScoredLog[];
  apps: number;
  starts: number;
  subs: number;
  min: number;
  g: number;
  a: number;
  pts: number;
  /** Points moyens par match joué (feuilles complètes). */
  ptsAvg: number | null;
  /** Moyenne sur les 3 dernières journées. */
  l3Avg: number | null;
  l3Apps: number;
  trend: number | null;
  subAvg: number | null;
  subApps: number;
  /** Bon supersub : au moins 2 entrées en jeu et une moyenne par entrée parmi les 10 % meilleures (6 pts minimum). */
  superSub: boolean;
  absence: Absence | null;
}

export interface Meeting { s: string; d: string; h: string; a: string; hg: number; ag: number; j: number }

export interface Data {
  meta: MetaFile;
  season: SeasonFile;
  matches: Match[];
  byId: Map<number, Match>;
  rounds: Map<number, Match[]>;
  lastRound: number;
  nextRound: number | null;
  table: TableRow[];
  prevTable: TableRow[] | null;
  players: PlayerStats[];
  playerById: Map<number, PlayerStats>;
  cupsByClub: Map<string, CupMatch[]>;
  absByClub: Map<string, Absence[]>;
  model: Fit;
  predictions: Map<number, Prediction>;
  meetings: (a: string, b: string, before?: string) => Meeting[];
  /** Matchs de coupe à 7 jours ou moins d'un match de L1, pour un club. */
  cupsAround: (club: string, iso: string) => (CupMatch & { gap: number })[];
  /** Pronostic d'un match déjà joué, tel qu'il aurait été calculé la veille. */
  predictBefore: (m: Match) => Prediction;
  /** Classements finaux depuis 2014-15. */
  finals: { s: string; table: TableRow[] }[];
}

export function buildData(meta: MetaFile, season: SeasonFile, history: HistoryFile): Data {
  const matches = season.matches;
  const byId = new Map(matches.map(m => [m.id, m]));
  const rounds = new Map<number, Match[]>();
  for (const m of matches) rounds.set(m.j, [...(rounds.get(m.j) ?? []), m]);
  const finished = matches.filter(m => m.status === 'finished' && m.hg != null);
  const lastRound = finished.reduce((n, m) => Math.max(n, m.j), 0);
  const nextRound = meta.nextRound;

  const table = buildTable(matches);
  const prevTable = lastRound > 1 ? buildTable(matches.filter(m => m.j < lastRound)) : null;

  // ---------- joueurs ----------
  const absences = season.absences;
  const players: PlayerStats[] = season.players.map(p => {
    const logs: ScoredLog[] = p.logs.map(L => ({ ...L, P: matchPoints(L, p.pos) })).sort((x, y) => x.j - y.j);
    const full = logs.filter(L => L.lu && L.min > 0);
    const l3 = full.filter(L => L.j > lastRound - 3);
    const sub = full.filter(L => L.sub);
    const avg = (ls: ScoredLog[]) => (ls.length ? ls.reduce((s, L) => s + L.P.total, 0) / ls.length : null);
    const ptsAvg = avg(full), l3Avg = avg(l3);
    return {
      ...p, logs,
      apps: logs.filter(L => L.min > 0 || !L.lu).length,
      starts: full.filter(L => !L.sub).length,
      subs: sub.length,
      min: full.reduce((s, L) => s + L.min, 0),
      g: logs.reduce((s, L) => s + L.g, 0),
      a: logs.reduce((s, L) => s + L.a, 0),
      pts: logs.reduce((s, L) => s + L.P.total, 0),
      ptsAvg, l3Avg, l3Apps: l3.length,
      // Tendance seulement si la saison compte d'autres matchs que les 3 derniers (sinon on compare un chiffre à lui-même).
      trend: ptsAvg != null && l3Avg != null && l3.length >= 2 && full.length > l3.length ? l3Avg - ptsAvg : null,
      subAvg: avg(sub), subApps: sub.length, superSub: false,
      absence: absences.find(a => a.playerId === p.id) ?? null,
    };
  });
  const subAvgs = players.filter(p => p.subApps >= 2).map(p => p.subAvg!).sort((a, b) => b - a);
  const ssMin = Math.max(SUPERSUB_MIN, subAvgs[Math.floor(subAvgs.length * 0.1)] ?? Infinity);
  players.forEach(p => (p.superSub = p.subApps >= 2 && p.subAvg! >= ssMin));
  const playerById = new Map(players.map(p => [p.id, p]));

  const absByClub = new Map<string, Absence[]>();
  for (const a of absences) absByClub.set(a.club, [...(absByClub.get(a.club) ?? []), a]);

  const cupsByClub = new Map<string, CupMatch[]>();
  for (const c of season.cups) cupsByClub.set(c.club, [...(cupsByClub.get(c.club) ?? []), c]);
  cupsByClub.forEach(l => l.sort((x, y) => x.d.localeCompare(y.d)));
  const cupsAround = (club: string, iso: string) =>
    (cupsByClub.get(club) ?? []).map(c => ({ ...c, gap: dayGap(iso, c.d) })).filter(c => c.gap !== 0 && Math.abs(c.gap) <= 7);

  // ---------- face-à-face L1 depuis 2014 ----------
  const hist: Meeting[] = history.seasons.flatMap(S => S.m.map(r => ({ s: S.s, j: r[0], d: r[1], h: r[2], a: r[3], hg: r[4], ag: r[5] })));
  const cur: Meeting[] = finished.map(m => ({ s: season.season, j: m.j, d: parisDay(m.d), h: m.h, a: m.a, hg: m.hg!, ag: m.ag! }));
  const allMeetings = [...hist, ...cur];
  const meetings = (a: string, b: string, before?: string) =>
    allMeetings
      .filter(m => ((m.h === a && m.a === b) || (m.h === b && m.a === a)) && (!before || m.d < before))
      .sort((x, y) => y.d.localeCompare(x.d));

  // ---------- pronostics ----------
  const all: ModelMatch[] = allMeetings.map(m => ({ t: dayNum(m.d), h: m.h, a: m.a, hg: m.hg, ag: m.ag }));
  const today = dayNum(new Date());
  const model = fit(all, today + 1, CLUB_NAMES);
  const absCtx = absenceFactors(players, absByClub, lastRound);
  const restOf = (m: Match) => {
    const rest: Record<string, number> = {};
    for (const t of [m.h, m.a]) {
      // Match européen 3 jours avant ou moins : −3 %.
      if (cupsAround(t, m.d).some(c => c.comp !== 'CDF' && !c.tbd && c.gap < 0 && c.gap >= -3)) rest[t] = 0.97;
    }
    return rest;
  };
  const h2hOf = (m: Match): H2hMatch[] => meetings(m.h, m.a, parisDay(m.d));
  const predictions = new Map<number, Prediction>();
  for (const m of matches) {
    if (m.status === 'finished') continue;
    const ctx: Context = { h2h: h2hOf(m), rest: restOf(m), abs: m.j === nextRound ? absCtx : {} };
    predictions.set(m.id, predict(model, m.h, m.a, ctx));
  }
  const predictBefore = (m: Match) => {
    const t = dayNum(m.d);
    return predict(fit(all, t, CLUB_NAMES), m.h, m.a, { h2h: h2hOf(m), rest: restOf(m) });
  };

  const finals = history.seasons.map(S => ({ s: S.s, table: buildTable(S.m.map(r => ({ j: r[0], d: r[1], h: r[2], a: r[3], hg: r[4], ag: r[5] }))) }));

  return { meta, season, matches, byId, rounds, lastRound, nextRound, table, prevTable, players, playerById, cupsByClub, absByClub, model, predictions, meetings, cupsAround, predictBefore, finals };
}

/**
 * Absents de la prochaine journée (repris du prototype) : part des buts + 0,7 × passes qui manque en attaque,
 * et gardien / défenseurs titulaires absents en défense.
 */
function absenceFactors(players: PlayerStats[], absByClub: Map<string, Absence[]>, lastRound: number) {
  const out: Record<string, { att: number; def: number; who: string[] }> = {};
  for (const club of CLUB_NAMES) {
    const squad = players.filter(p => p.club === club);
    const total = squad.reduce((s, p) => s + p.g + 0.7 * p.a, 0) || 1;
    let miss = 0, dm = 1;
    const who: string[] = [];
    const ids = new Set((absByClub.get(club) ?? []).map(a => a.playerId));
    for (const p of squad) {
      if (!ids.has(p.id) || !p.absence) continue;
      const w = p.absence.type === 'D' ? 0.5 : p.absence.type === 'B' || p.absence.type === 'S' ? 1 : 0;
      if (!w) continue;
      const regular = p.starts >= Math.max(2, lastRound * 0.5);
      miss += w * (p.g + 0.7 * p.a);
      if (regular && p.pos === 'G') dm *= 1 + 0.05 * w;
      if (regular && p.pos === 'D') dm *= 1 + 0.025 * w;
      if (regular || p.g + p.a >= 2) who.push(p.n);
    }
    out[club] = { att: Math.max(0.85, 1 - (0.5 * miss) / total), def: Math.min(1.1, dm), who };
  }
  return out;
}

export type Period = 'saison' | 5 | 3 | 1;
export const PERIODS: { k: Period; label: string; short: string }[] = [
  { k: 'saison', label: 'Saison', short: 'Saison' }, { k: 5, label: '5 dernières journées', short: '5 J' },
  { k: 3, label: '3 dernières journées', short: '3 J' }, { k: 1, label: 'Dernière journée', short: 'Dern. J' },
];

export interface WindowStats {
  from: number;
  to: number;
  apps: number;
  starts: number;
  subs: number;
  min: number;
  g: number; pen: number; a: number; og: number; y: number; rc: number;
  tk: number; int: number; kp: number; xg: number; xa: number; sav: number; gp: number;
  cs: number; conc: number;
  pts: number;
  ptsAvg: number | null;
  /** Moyennes par source : équipe, note, actions, défense, cartons. */
  src: { team: number; note: number; actions: number; defense: number; cards: number };
  noteAvg: number | null;
  subAvg: number | null;
  savePct: number | null;
  /** Points par journée (null : n'a pas joué). */
  series: (number | null)[];
}

/** Stats d'un joueur sur une période qui finit à la dernière journée jouée. */
export function windowStats(p: PlayerStats, period: Period, lastRound: number): WindowStats {
  const from = period === 'saison' ? 1 : Math.max(1, lastRound - period + 1);
  const logs = p.logs.filter(L => L.j >= from && L.j <= lastRound);
  const played = logs.filter(L => L.min > 0 || !L.lu);
  const full = played.filter(L => L.lu);
  const sum = (f: (L: ScoredLog) => number, ls = played) => ls.reduce((s, L) => s + f(L), 0);
  const n = full.length;
  const notes = full.filter(L => L.P.noteLE != null);
  const subs = full.filter(L => L.sub);
  const conc = sum(L => L.ga * Math.min(1, L.min / 90), full);
  const sav = sum(L => L.sav, full);
  return {
    from, to: lastRound, apps: played.length, starts: full.filter(L => !L.sub).length, subs: subs.length, min: sum(L => L.min, full),
    g: sum(L => L.g), pen: sum(L => L.pen), a: sum(L => L.a), og: sum(L => L.og), y: sum(L => L.y), rc: sum(L => L.rc),
    tk: sum(L => L.tk, full), int: sum(L => L.int, full), kp: sum(L => L.kp, full), xg: sum(L => L.xg, full), xa: sum(L => L.xa, full),
    sav, gp: sum(L => L.gp, full), cs: full.filter(L => L.ga === 0 && L.min >= 60).length, conc,
    pts: sum(L => L.P.total), ptsAvg: n ? sum(L => L.P.total, full) / n : null,
    src: {
      team: n ? sum(L => L.P.team, full) / n : 0, note: n ? sum(L => L.P.note, full) / n : 0, actions: n ? sum(L => L.P.actions, full) / n : 0,
      defense: n ? sum(L => L.P.defense, full) / n : 0, cards: n ? sum(L => L.P.cards, full) / n : 0,
    },
    noteAvg: notes.length ? notes.reduce((s, L) => s + L.P.noteLE!, 0) / notes.length : null,
    subAvg: subs.length ? sum(L => L.P.total, subs) / subs.length : null,
    savePct: p.pos === 'G' && sav + conc > 0 ? sav / (sav + conc) : null,
    series: Array.from({ length: lastRound - from + 1 }, (_, i) => {
      const L = full.find(x => x.j === from + i && x.min > 0);
      return L ? L.P.total : null;
    }),
  };
}

/** Importance d'un joueur pour son club : titularisations et points par match. */
export const importance = (p: PlayerStats) => (p.ptsAvg ?? 0) * Math.min(1, p.starts / 5) + p.starts;
