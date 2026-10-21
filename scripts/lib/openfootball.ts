// Lecture des fichiers texte openfootball (github.com/openfootball/europe, dossier france).
import { clubFromOpenfootball } from '../../src/lib/clubs.ts';

const BASE = 'https://raw.githubusercontent.com/openfootball/europe/master/france';
const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

export interface OfMatch {
  j: number;
  /** Date locale AAAA-MM-JJ. */
  date: string;
  time: string | null;
  h: string;
  a: string;
  hg: number | null;
  ag: number | null;
}

export async function fetchSeason(season: string): Promise<OfMatch[]> {
  const res = await fetch(`${BASE}/${season}_fr1.txt`);
  if (!res.ok) throw new Error(`openfootball ${season}: HTTP ${res.status}`);
  return parseSeason(await res.text(), Number(season.slice(0, 4)));
}

/** startYear : année du début de saison, pour dater les lignes « Sat Aug 17 » sans année. */
export function parseSeason(text: string, startYear: number): OfMatch[] {
  const out: OfMatch[] = [];
  let j = 0;
  let date = '';
  let time: string | null = null;
  for (const raw of text.split('\n')) {
    // Matchs annulés (2019-20) ignorés ; « [awarded] » (match sur tapis vert) gardé avec son score.
    if (/\[(cancelled|postponed|abandoned)\]/i.test(raw)) continue;
    const line = raw.replace(/\s*\[[^\]]*\]/g, '').replace(/\s+$/, '');
    const md = line.match(/Matchday (\d+)|Regular Season - (\d+)/);
    if (md) { j = Number(md[1] ?? md[2]); continue; }
    const dm = line.match(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/);
    if (dm) {
      const m = MONTHS[dm[1]];
      const y = dm[3] ? Number(dm[3]) : m >= 7 ? startYear : startYear + 1;
      date = `${y}-${String(m).padStart(2, '0')}-${dm[2].padStart(2, '0')}`;
      continue;
    }
    // «     20:45  Le Havre AC     v Paris Saint-Germain FC   1-4 (0-1) » ; l'horaire peut être omis (même horaire que la ligne précédente).
    const mm = line.match(/^\s+(?:(\d{1,2}[:.]\d{2})\s+)?(.+?)\s+v\s+(.+?)(?:\s+(\d+)-(\d+)(?:\s+\(.*\))?)?\s*$/);
    if (mm && j && date) {
      if (mm[1]) time = mm[1].replace('.', ':');
      out.push({
        j, date, time,
        h: clubFromOpenfootball(mm[2]),
        a: clubFromOpenfootball(mm[3]),
        hg: mm[4] != null ? Number(mm[4]) : null,
        ag: mm[5] != null ? Number(mm[5]) : null,
      });
      continue;
    }
    // Format 2025-26 : «   20:45   Rennes  1-0 (0-0)  Olympique Marseille ».
    const m2 = line.match(/^\s+(?:(\d{1,2}:\d{2})\s+)?(\S.*?)\s{2,}(\d+)-(\d+)(?:\s+\([^)]*\))?\s{2,}(\S.*?)\s*$/);
    if (m2 && j && date) {
      if (m2[1]) time = m2[1];
      out.push({ j, date, time, h: clubFromOpenfootball(m2[2]), a: clubFromOpenfootball(m2[5]), hg: Number(m2[3]), ag: Number(m2[4]) });
    }
  }
  return out;
}
