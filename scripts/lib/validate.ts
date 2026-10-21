import { buildTable } from '../../src/lib/standings.ts';
import type { Match, Player } from '../../src/lib/types.ts';

export interface PublishedRow { club: string; mp: number; pts: number; gf: number; ga: number }

/** Classement recalculé = classement publié (matchs joués, points, buts pour et contre). */
export function checkStandings(matches: Match[], published: PublishedRow[]): string[] {
  const mine = new Map(buildTable(matches).map(r => [r.club, r]));
  const errors: string[] = [];
  if (published.length !== mine.size) errors.push(`classement : ${published.length} clubs publiés, ${mine.size} recalculés`);
  for (const p of published) {
    const r = mine.get(p.club);
    if (!r) { errors.push(`classement : ${p.club} absent du recalcul`); continue; }
    for (const k of ['mp', 'pts', 'gf', 'ga'] as const) {
      if (r[k] !== p[k]) errors.push(`classement : ${p.club} ${k} recalculé ${r[k]}, publié ${p[k]}`);
    }
  }
  return errors;
}

/**
 * Buts des joueurs + contre-son-camp adverses = score, match par match.
 * Renvoie les id des matchs qui ne collent pas (à marquer incomplets, sans rien inventer).
 */
export function checkGoals(matches: Match[], players: Player[]): { bad: number[]; errors: string[] } {
  const sum = new Map<number, { h: number; a: number }>();
  for (const p of players) {
    for (const L of p.logs) {
      if (!L.lu) continue;
      const s = sum.get(L.match) ?? { h: 0, a: 0 };
      if (L.home) { s.h += L.g; s.a += L.og; } else { s.a += L.g; s.h += L.og; }
      sum.set(L.match, s);
    }
  }
  const bad: number[] = [];
  const errors: string[] = [];
  for (const m of matches) {
    if (m.status !== 'finished' || m.incomplete) continue;
    const s = sum.get(m.id) ?? { h: 0, a: 0 };
    if (s.h !== m.hg || s.a !== m.ag) {
      bad.push(m.id);
      errors.push(`buts : ${m.h}-${m.a} (J${m.j}) score ${m.hg}-${m.ag}, joueurs ${s.h}-${s.a}`);
    }
  }
  return { bad, errors };
}
