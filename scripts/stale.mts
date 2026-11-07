// Les données publiées sont-elles en retard sur le dernier créneau (lundi 18 h 30, vendredi 8 h) ?
// Code de sortie 0 = oui, une mise à jour est due ; 1 = non. Avec --full, des données de secours
// (openfootball, sans Sofascore) comptent comme en retard : seule une mise à jour complète les remplace.
// Avec --grace=N, on ne déclare le retard que N minutes après le créneau (pour laisser le Mac passer d'abord).
// Avec --scores, si aucune mise à jour complète n'est due, on regarde aussi les matchs qui viennent de finir :
// code 2 = récupérer leurs scores (puis toutes les 15 minutes tant qu'un score manque).
import fs from 'node:fs';
import { awaitingScores, lastScoreSlot, slot } from '../src/lib/schedule.ts';
import type { MetaFile, SeasonFile } from '../src/lib/types.ts';

const file = process.argv.find(a => a.endsWith('.json')) ?? 'public/data/meta.json';
const meta: MetaFile = JSON.parse(fs.readFileSync(file, 'utf8'));
const last = slot();
const full = process.argv.includes('--full');
const grace = Number(process.argv.find(a => a.startsWith('--grace='))?.slice(8) ?? 0) * 6e4;
const fullAt = Date.parse(meta.fullAt ?? meta.updatedAt);
const stale = Date.now() - last >= grace && (fullAt < last || (full && meta.sources.season !== 'Sofascore'));
if (stale || !process.argv.includes('--scores')) {
  console.log(`${stale ? 'en retard' : 'à jour'} (données complètes du ${meta.fullAt ?? meta.updatedAt}, créneau du ${new Date(last).toISOString()})`);
  process.exit(stale ? 0 : 1);
}

const season: SeasonFile = JSON.parse(fs.readFileSync(file.replace(/meta\.json$/, 'season.json'), 'utf8'));
const waiting = awaitingScores(season.matches);
const updated = Date.parse(meta.updatedAt);
const due = waiting.length > 0 && (updated < lastScoreSlot(season.matches) || Date.now() - updated >= 15 * 6e4);
console.log(due ? `scores à récupérer : ${waiting.map(m => `${m.h}-${m.a}`).join(', ')}` : 'à jour');
process.exit(due ? 2 : 1);
