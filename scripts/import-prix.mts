// Prix du Championnat des Étoiles : scripts/lcde/prix.txt (relevé sur le site du jeu, compte de l'utilisateur)
// → public/data/prix.json, rattaché à nos joueurs par nom et club.
// Usage : npx tsx scripts/import-prix.mts   (après avoir remplacé prix.txt par un nouveau relevé)
import fs from 'node:fs';
import type { PrixFile, SeasonFile } from '../src/lib/types.ts';

// Codes club du jeu → nos noms de club.
const CLUB: Record<string, string> = {
  PSG: 'PSG', OL: 'Lyon', LOSC: 'Lille', OM: 'Marseille', RCL: 'Lens', ASM: 'Monaco', SRFC: 'Rennes', OGCN: 'Nice', PFC: 'Paris FC',
  TFC: 'Toulouse', SB29: 'Brest', RCSA: 'Strasbourg', LOT: 'Lorient', AJA: 'Auxerre', HAC: 'Le Havre', SCO: 'Angers', TRO: 'Troyes', LEM: 'Le Mans',
};
// Sans accents ni ponctuation ; ø, æ, ß, ł ne se décomposent pas : remplacés à la main.
const fold = (s: string) => s.replace(/['’]/g, '').replace(/ø/gi, 'o').replace(/æ/gi, 'ae').replace(/ß/g, 'ss').replace(/ł/gi, 'l')
  .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const lastOf = (s: string) => fold(s).split(' ').at(-1)!;
const words = (s: string) => fold(s).split(' ').filter(w => w.length >= 4);
// Deux mots proches : identiques, ou l'un commence par l'autre (Golovin / Golovine).
const near = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

const txt = fs.readFileSync('scripts/lcde/prix.txt', 'utf8');
const date = txt.match(/relevés le (\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
const rows = txt.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const [full, code, pos, prix, moy, sel] = l.split('|');
  return { full, club: CLUB[code], pos, prix: Number(prix), moy: moy ? Number(moy) : null, sel: sel ? Number(sel) : null };
});
const season: SeasonFile = JSON.parse(fs.readFileSync('public/data/season.json', 'utf8'));

const out: PrixFile = { updatedAt: date, players: {} };
const missed: string[] = [];
for (const r of rows) {
  const same = season.players.filter(p => p.club === r.club);
  // Nom complet identique, sinon même nom de famille et seul de ce nom dans le club (Sofascore et le jeu écrivent parfois différemment le prénom).
  let hit = same.filter(p => p.full && fold(p.full) === fold(r.full));
  if (hit.length !== 1) hit = same.filter(p => lastOf(p.full ?? p.n) === lastOf(r.full));
  if (hit.length !== 1) hit = season.players.filter(p => p.full && fold(p.full) === fold(r.full));
  // Derniers recours, dans le club : un mot du nom en commun (Alexsandro = Alexsandro Ribeiro), au même poste d'abord.
  const close = (p: SeasonFile['players'][number]) => words(`${p.full ?? ''} ${p.n}`).some(w => words(r.full).some(x => near(w, x)));
  if (hit.length !== 1) hit = same.filter(p => p.pos === r.pos && close(p));
  // Le poste peut différer entre le jeu et Sofascore (Dermane Karim, prénom et nom inversés).
  if (hit.length !== 1) hit = same.filter(close);
  if (hit.length === 1) out.players[hit[0].id] = { prix: r.prix, moy: r.moy, sel: r.sel };
  else if (r.moy != null) missed.push(`${r.full} (${r.club})`);
}
fs.writeFileSync('public/data/prix.json', JSON.stringify(out));
console.log(`[prix] ${rows.length} joueurs du jeu, ${Object.keys(out.players).length} rattachés à nos joueurs`);
if (missed.length) console.log(`[prix] non rattachés (ayant déjà joué) : ${missed.join(', ')}`);
