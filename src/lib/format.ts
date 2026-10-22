// Mise en forme française, dates à l'heure de Paris.
const TZ = 'Europe/Paris';

export const num = (x: number | null | undefined, d = 1) => {
  if (x == null || !isFinite(x)) return '—';
  // Évite « −0 » quand une petite valeur négative s'arrondit à zéro.
  const r = Math.round(x * 10 ** d) / 10 ** d || 0;
  return r.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
};
export const pct = (x: number) => `${Math.round(x * 100)} %`;
export const signed = (x: number, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d);

/** Jour à Paris au format AAAA-MM-JJ. */
export const parisDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ });
export const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const dayLong = (iso: string) => cap(new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }));
export const dayShort = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
export const dateShort = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ });
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Écart en jours (calendrier parisien) de a vers b. */
export const dayGap = (a: string, b: string) => Math.round((Date.parse(parisDay(b)) - Date.parse(parisDay(a))) / 864e5);

export function countdown(ms: number): { n: string; u: string }[] {
  if (ms <= 0) return [{ n: '0', u: 'min' }];
  const m = Math.floor(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mn = m % 60;
  const out: { n: string; u: string }[] = [];
  if (d) out.push({ n: String(d), u: d > 1 ? 'jours' : 'jour' });
  if (d || h) out.push({ n: String(h), u: 'h' });
  out.push({ n: String(mn), u: 'min' });
  return out;
}

export const POSITION: Record<string, string> = { G: 'Gardien', D: 'Défenseur', M: 'Milieu', A: 'Attaquant' };
export const POSITIONS: Record<string, string> = { G: 'Gardiens', D: 'Défenseurs', M: 'Milieux', A: 'Attaquants' };
export const CUP_SHORT: Record<string, string> = { LDC: 'LdC', LE: 'LE', LC: 'LC', CDF: 'CdF' };
export const CUP_LONG: Record<string, string> = { LDC: 'Ligue des champions', LE: 'Ligue Europa', LC: 'Ligue Conférence', CDF: 'Coupe de France' };

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
