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
