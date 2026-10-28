// Les données publiées sont-elles en retard sur le dernier créneau (lundi 18 h 30, vendredi 8 h) ?
// Code de sortie 0 = oui, une mise à jour est due ; 1 = non. Avec --full, des données de secours
// (openfootball, sans Sofascore) comptent comme en retard : seule une mise à jour complète les remplace.
// Avec --grace=N, on ne déclare le retard que N minutes après le créneau (pour laisser le Mac passer d'abord).
import fs from 'node:fs';
import { slot } from '../src/lib/schedule.ts';
import type { MetaFile } from '../src/lib/types.ts';

const file = process.argv.find(a => a.endsWith('.json')) ?? 'public/data/meta.json';
const meta: MetaFile = JSON.parse(fs.readFileSync(file, 'utf8'));
const last = slot();
const full = process.argv.includes('--full');
const grace = Number(process.argv.find(a => a.startsWith('--grace='))?.slice(8) ?? 0) * 6e4;
const stale = Date.now() - last >= grace && (Date.parse(meta.updatedAt) < last || (full && meta.sources.season !== 'Sofascore'));
console.log(`${stale ? 'en retard' : 'à jour'} (données du ${meta.updatedAt}, créneau du ${new Date(last).toISOString()})`);
process.exit(stale ? 0 : 1);
