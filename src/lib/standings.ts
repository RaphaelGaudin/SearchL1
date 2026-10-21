export type Result = 'V' | 'N' | 'D';

export interface TableRow {
  club: string;
  rank: number;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: Result[];
}

interface Scored { j: number; d: string; h: string; a: string; hg: number | null; ag: number | null }

export const resultOf = (gf: number, ga: number): Result => (gf > ga ? 'V' : gf === ga ? 'N' : 'D');

/** Classement à partir des matchs joués. side = 'h' / 'a' pour le classement domicile / extérieur. */
export function buildTable(matches: Scored[], side?: 'h' | 'a'): TableRow[] {
  const T = new Map<string, TableRow>();
  const row = (club: string) => {
    let r = T.get(club);
    if (!r) T.set(club, (r = { club, rank: 0, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] }));
    return r;
  };
  matches.forEach(m => { row(m.h); row(m.a); });
  const played = matches.filter(m => m.hg != null && m.ag != null).sort((x, y) => x.d.localeCompare(y.d) || x.j - y.j);
  for (const m of played) {
    for (const [club, gf, ga, s] of [[m.h, m.hg!, m.ag!, 'h'], [m.a, m.ag!, m.hg!, 'a']] as const) {
      if (side && side !== s) continue;
      const r = row(club);
      const res = resultOf(gf, ga);
      r.mp++; r.gf += gf; r.ga += ga;
      if (res === 'V') { r.w++; r.pts += 3; } else if (res === 'N') { r.d++; r.pts += 1; } else r.l++;
      r.form.push(res);
    }
  }
  const rows = [...T.values()];
  rows.forEach(r => (r.gd = r.gf - r.ga));
  // Départage simplifié : points, différence de buts, buts marqués (la LFP départage ensuite par les confrontations).
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.club.localeCompare(b.club));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
