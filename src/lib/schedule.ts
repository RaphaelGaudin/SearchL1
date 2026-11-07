// Créneaux de mise à jour des données, à l'heure de Paris : lundi 18 h 30 et vendredi 8 h.
export const SLOTS = [
  { day: 1, h: 18, m: 30 },
  { day: 5, h: 8, m: 0 },
];

/** Décalage de Paris par rapport à l'UTC (en minutes) à un instant donné. */
function parisOffset(at: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(at)).map(x => [x.type, x.value]),
  );
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at / 6e4) * 6e4) / 6e4;
}

/** Instant UTC d'une heure de Paris donnée (y, m 1-12, d). */
function parisTime(y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return guess - parisOffset(guess - 2 * 3600e3) * 6e4;
}

/** Dernier créneau passé (ms), ou le prochain si next = true. */
export function slot(now = Date.now(), next = false): number {
  const found: number[] = [];
  for (let k = -8; k <= 8; k++) {
    const day = new Date(now + k * 864e5);
    const [y, mo, d] = day.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }).split('-').map(Number);
    const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    for (const s of SLOTS) if (s.day === wd) found.push(parisTime(y, mo, d, s.h, s.m));
  }
  found.sort((a, b) => a - b);
  return next ? found.find(t => t > now)! : found.filter(t => t <= now).at(-1)!;
}

// ---------- récupération des scores après les matchs ----------
// Un match est fini environ 2 h après le coup d'envoi (mi-temps et arrêts de jeu compris, plus le temps
// que Sofascore valide le score). Des matchs qui finissent à moins de 30 minutes d'écart sont récupérés
// en une seule fois, après le dernier. Au bout de 24 h sans score, on arrête d'attendre (report non signalé…).
export const MATCH_END = 2 * 3600e3;
const TOGETHER = 30 * 60e3;
const GIVE_UP = 24 * 3600e3;

type Fixture = { d: string; status: string };

/** Instant de récupération des scores de chaque match : la fin estimée du dernier match de son groupe. */
export function scoreSlots<M extends Fixture>(matches: M[]): Map<M, number> {
  const out = new Map<M, number>();
  const ends = matches
    .filter(m => m.status !== 'postponed' && m.status !== 'canceled')
    .map(m => ({ m, end: Date.parse(m.d) + MATCH_END }))
    .sort((a, b) => a.end - b.end);
  for (let i = 0; i < ends.length; ) {
    let k = i;
    while (k + 1 < ends.length && ends[k + 1].end - ends[k].end <= TOGETHER) k++;
    for (let x = i; x <= k; x++) out.set(ends[x].m, ends[k].end);
    i = k + 1;
  }
  return out;
}

/** Dernière récupération de scores passée (ms), ou 0. */
export function lastScoreSlot(matches: Fixture[], now = Date.now()): number {
  return Math.max(0, ...[...scoreSlots(matches).values()].filter(t => t <= now && t > now - GIVE_UP));
}

/** Matchs dont l'heure de récupération est passée (depuis moins de 24 h) mais dont on n'a pas encore le score. */
export function awaitingScores<M extends Fixture>(matches: M[], now = Date.now()): M[] {
  return [...scoreSlots(matches)].filter(([m, t]) => t <= now && t > now - GIVE_UP && (m.status === 'notstarted' || m.status === 'live')).map(([m]) => m);
}
