// Palmarès : titres des clubs (Wikidata) et des joueurs (TheSportsDB), dans public/data/palmares.json.
// Usage : npm run palmares   (lent la première fois : ~2 s par requête pour respecter la limite gratuite de TheSportsDB)
// Les palmarès des joueurs sont gardés en cache 30 jours dans .cache/palmares.
import fs from 'node:fs';
import path from 'node:path';
import { CLUBS } from '../src/lib/clubs.ts';
import type { ClubTitle, Honour, PalmaresFile, SeasonFile } from '../src/lib/types.ts';

const OUT = path.resolve('public/data/palmares.json');
const CACHE = path.resolve('.cache/palmares');
const UA = { 'User-Agent': 'SearchL1/1.0 (appli perso de stats Ligue 1)' };
const TSDB = 'https://www.thesportsdb.com/api/v1/json/123';
// Limite gratuite : 30 requêtes par minute. On reste nettement en dessous.
const DELAY = 3000;
const MAX_AGE = 30 * 864e5;
const log = (...a: unknown[]) => console.log('[palmarès]', ...a);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- clubs (Wikidata) ----------
// Compétitions seniors retenues (on écarte jeunes, réserves et tournois amicaux).
const COMPS: [RegExp, string][] = [
  [/^championnat de France de football$/i, 'Championnat de France (Ligue 1)'],
  [/deuxième division|Ligue 2/i, 'Ligue 2'],
  [/^Coupe de France de football$/i, 'Coupe de France'],
  [/^Coupe de la Ligue/i, 'Coupe de la Ligue'],
  [/^Trophée des champions/i, 'Trophée des champions'],
  [/Ligue des champions de l'UEFA|Coupe des clubs champions/i, 'Ligue des champions'],
  [/Ligue Europa|Coupe UEFA/i, 'Ligue Europa / Coupe UEFA'],
  [/Ligue Europa Conférence|Ligue Conférence/i, 'Ligue Conférence'],
  [/vainqueurs de coupe/i, 'Coupe des vainqueurs de coupe'],
  [/Supercoupe de l'UEFA/i, "Supercoupe de l'UEFA"],
  [/Intertoto/i, 'Coupe Intertoto'],
  [/Coupe intercontinentale|Coupe du monde des clubs/i, 'Coupe du monde des clubs / intercontinentale'],
];

/** « Coupe de France de football 2020-2021 » → « 2020-21 » ; « … 1995 » → « 1995 ». */
function seasonOf(label: string): string | null {
  const m = label.match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
  if (m) return `${m[1]}-${m[2].slice(-2)}`;
  const y = label.match(/(\d{4})/);
  return y ? y[1] : null;
}

async function clubTitles(): Promise<Record<string, ClubTitle[]>> {
  const values = CLUBS.map(c => `wd:${c.wikidata}`).join(' ');
  const query = `SELECT ?club ?compLabel ?seasonLabel WHERE {
    VALUES ?club { ${values} }
    ?season wdt:P1346 ?club ; wdt:P3450 ?comp .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
  }`;
  const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: 'json' })}`, { headers: { ...UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`Wikidata : HTTP ${res.status}`);
  const rows: { club: { value: string }; compLabel: { value: string }; seasonLabel: { value: string } }[] = (await res.json()).results.bindings;
  const out: Record<string, ClubTitle[]> = {};
  for (const c of CLUBS) {
    const by = new Map<string, Set<string>>();
    for (const r of rows.filter(r => r.club.value.endsWith('/' + c.wikidata))) {
      const comp = COMPS.find(([re]) => re.test(r.compLabel.value))?.[1];
      // L'ordre compte : « Ligue Europa Conférence » doit gagner sur « Ligue Europa ».
      const conf = /Conférence/i.test(r.compLabel.value) ? 'Ligue Conférence' : comp;
      const s = seasonOf(r.seasonLabel.value);
      if (!conf || !s) continue;
      if (!by.has(conf)) by.set(conf, new Set());
      by.get(conf)!.add(s);
    }
    const order = COMPS.map(x => x[1]);
    out[c.name] = [...by.entries()]
      .map(([comp, set]) => ({ comp, seasons: [...set].sort().reverse() }))
      .sort((a, b) => order.indexOf(a.comp) - order.indexOf(b.comp));
  }
  return out;
}

// ---------- joueurs (TheSportsDB) ----------
const HONOUR_FR: Record<string, string> = {
  'UEFA Champions League': 'Ligue des champions', 'UEFA Europa League': 'Ligue Europa', 'UEFA Europa Conference League': 'Ligue Conférence',
  'UEFA Conference League': 'Ligue Conférence', 'UEFA Super Cup': "Supercoupe de l'UEFA", 'FIFA World Cup': 'Coupe du monde',
  'FIFA Club World Cup': 'Coupe du monde des clubs', 'FIFA Intercontinental Cup': 'Coupe intercontinentale', 'UEFA European Championship': 'Euro',
  'UEFA Nations League': 'Ligue des nations', 'Africa Cup of Nations': "Coupe d'Afrique des nations", 'Copa America': 'Copa América',
  'French Ligue 1': 'Ligue 1', 'Ligue 1': 'Ligue 1', 'French Ligue 2': 'Ligue 2', 'Coupe de France': 'Coupe de France', 'Trophee des Champions': 'Trophée des champions',
  'Trophée des Champions': 'Trophée des champions', 'Coupe de la Ligue': 'Coupe de la Ligue', 'English Premier League': 'Premier League (Angleterre)',
  'Spanish La Liga': 'Liga (Espagne)', 'Italian Serie A': 'Serie A (Italie)', 'German Bundesliga': 'Bundesliga (Allemagne)', 'Portuguese Primeira Liga': 'Liga Portugal',
  'Dutch Eredivisie': 'Eredivisie (Pays-Bas)', 'Belgian Pro League': 'Pro League (Belgique)', 'Scottish Premiership': 'Premiership (Écosse)', 'FA Cup': 'FA Cup',
  'Copa del Rey': 'Coupe du Roi', 'Coppa Italia': "Coupe d'Italie", 'DFB-Pokal': "Coupe d'Allemagne", 'Olympic Games': 'Jeux olympiques', 'Copa Libertadores': 'Copa Libertadores',
  'CONCACAF Gold Cup': 'Gold Cup', 'AFC Asian Cup': "Coupe d'Asie des nations", 'FIFA U-20 World Cup': 'Coupe du monde U20', 'UEFA European Under-21 Championship': 'Euro Espoirs',
};

interface Cached { at: number; idPlayer: string | null; honours: Honour[] }

async function tsdb(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(attempt ? 60_000 : DELAY);
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) continue; // refusé : on attend une minute avant de réessayer
    if (!res.ok) throw new Error(`TheSportsDB : HTTP ${res.status}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  throw new Error('TheSportsDB : trop de requêtes');
}

/** Retrouve le joueur par son nom, en vérifiant la date de naissance (évite les homonymes). */
async function findPlayer(full: string, dob: string): Promise<string | null> {
  const tries = [full, full.split(' ').slice(-1)[0]];
  for (const name of [...new Set(tries)]) {
    const r = await tsdb(`${TSDB}/searchplayers.php?p=${encodeURIComponent(name)}`) as { player?: { idPlayer: string; dateBorn?: string; strSport?: string }[] | null } | null;
    const hit = (r?.player ?? []).find(p => p.strSport === 'Soccer' && p.dateBorn === dob);
    if (hit) return hit.idPlayer;
  }
  return null;
}

async function playerHonours(season: SeasonFile, prev: PalmaresFile | null): Promise<Record<string, Honour[]>> {
  fs.mkdirSync(CACHE, { recursive: true });
  const out: Record<string, Honour[]> = { ...(prev?.players ?? {}) };
  const todo = season.players.filter(p => p.logs.some(L => L.min > 0) && p.full && p.dob);
  let fetched = 0, found = 0;
  for (const p of todo) {
    const file = path.join(CACHE, `${p.id}.json`);
    let c: Cached | null = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    if (!c || Date.now() - c.at > MAX_AGE) {
      try {
        const idPlayer = c?.idPlayer ?? await findPlayer(p.full!, p.dob!);
        let honours: Honour[] = [];
        if (idPlayer) {
          const r = await tsdb(`${TSDB}/lookuphonours.php?id=${idPlayer}`) as { honours?: { strHonour: string; strSeason: string; strTeam?: string }[] | null } | null;
          honours = (r?.honours ?? []).map(h => ({ title: HONOUR_FR[h.strHonour] ?? h.strHonour, season: h.strSeason, team: h.strTeam }));
        }
        c = { at: Date.now(), idPlayer, honours };
        fs.writeFileSync(file, JSON.stringify(c));
        fetched++;
        if (fetched % 25 === 0) log(`${fetched} joueurs interrogés…`);
      } catch (e) {
        log(`${p.n} : ${(e as Error).message} (palmarès précédent conservé)`);
        continue;
      }
    }
    if (c.honours.length) { out[p.id] = c.honours; found++; } else delete out[p.id];
  }
  log(`${todo.length} joueurs, ${fetched} interrogés, ${found} avec un palmarès`);
  return out;
}

async function main() {
  const season: SeasonFile = JSON.parse(fs.readFileSync('public/data/season.json', 'utf8'));
  const prev: PalmaresFile | null = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  let clubs = prev?.clubs ?? {};
  try { clubs = await clubTitles(); log('palmarès des 18 clubs : Wikidata'); }
  catch (e) { log(`clubs : ${(e as Error).message} (palmarès précédent conservé)`); }
  const players = await playerHonours(season, prev);
  const file: PalmaresFile = { updatedAt: new Date().toISOString(), clubs, players };
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(file));
  fs.renameSync(OUT + '.tmp', OUT);
  log('OK');
}

main().catch(e => { console.error('[palmarès] ✗', e); process.exit(1); });
