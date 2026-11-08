// Palmarès : titres des clubs (Wikidata) et des joueurs, dans public/data/palmares.json.
// Joueurs : TheSportsDB, complété par les titres des clubs où ils étaient (clubs successifs et titres sur Wikidata,
// champions de L1 recalculés depuis nos résultats). Wikidata donne aussi le club actuel : départs en cours de saison.
// Usage : npm run palmares   (lent la première fois : ~2 s par requête pour respecter la limite gratuite de TheSportsDB)
// Les palmarès des joueurs sont gardés en cache 30 jours dans .cache/palmares.
import fs from 'node:fs';
import path from 'node:path';
import { CLUBS } from '../src/lib/clubs.ts';
import { buildTable } from '../src/lib/standings.ts';
import type { ClubTitle, HistoryFile, Honour, Move, PalmaresFile, SeasonFile } from '../src/lib/types.ts';

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

type Row = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Row[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', headers: { ...UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }),
    });
    if (res.status === 429 || res.status >= 500) { await sleep(10_000); continue; }
    if (!res.ok) throw new Error(`Wikidata : HTTP ${res.status}`);
    return (await res.json()).results.bindings;
  }
  throw new Error('Wikidata indisponible');
}
const qid = (uri?: string) => uri?.split('/').pop() ?? '';

async function clubTitles(): Promise<Record<string, ClubTitle[]>> {
  const values = CLUBS.map(c => `wd:${c.wikidata}`).join(' ');
  const rows = await sparql(`SELECT ?club ?compLabel ?seasonLabel WHERE {
    VALUES ?club { ${values} }
    ?season wdt:P1346 ?club ; wdt:P3450 ?comp .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
  }`) as { club: { value: string }; compLabel: { value: string }; seasonLabel: { value: string } }[];
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
  'French Coupe de France': 'Coupe de France', 'French Trophée des Champions': 'Trophée des champions', 'French Coupe de la Ligue': 'Coupe de la Ligue',
  'French Ligue 1 Young Player of the Year': 'Meilleur espoir de Ligue 1', 'Austrian Bundesliga': 'Bundesliga (Autriche)', 'Dutch KNVB Cup': 'Coupe des Pays-Bas',
  'German DFB-Pokal': "Coupe d'Allemagne", 'Spanish Copa del Rey': 'Coupe du Roi', 'FIFA FIFPro World XI': 'Équipe type FIFPro', 'Johan Cruijff Schaal': 'Supercoupe des Pays-Bas',
  'Slovak Cup': 'Coupe de Slovaquie', 'Swiss Super League': 'Super League (Suisse)', 'German DFL-Supercup': "Supercoupe d'Allemagne",
  'English FA Community Shield': 'Community Shield', 'English FA Cup': 'FA Cup', 'Swedish Allsvenskan': 'Allsvenskan (Suède)',
  'English PFA Championship Team of the Year': 'Équipe type de Championship', 'Scottish Premier League': 'Premiership (Écosse)',
  'American MLS Supporters Shield': 'Supporters Shield (MLS)', 'Polish Ekstraklasa': 'Ekstraklasa (Pologne)', 'FIFA Confederations Cup': 'Coupe des confédérations',
  'Australian A-League Champions': 'A-League (Australie)', 'English Championship': 'Championship (Angleterre)', 'English EFL Trophy': 'EFL Trophy',
  'FIFA Ballon d Or': "Ballon d'Or", 'FIFA The Best': 'The Best FIFA', 'Greek Football Cup': 'Coupe de Grèce', 'Greek Superleague': 'Super League (Grèce)',
  'CONMEBOL Sudamericana': 'Copa Sudamericana', 'CONMEBOL-UEFA Cup of Champions': 'Finalissima', 'Ecuadorian Serie A': 'Serie A (Équateur)',
  'Russian Cup': 'Coupe de Russie', 'Slovak Super Liga': 'Super Liga (Slovaquie)', 'Brazilian Copa Do Brasil': 'Coupe du Brésil', 'Saudi Pro League': 'Saudi Pro League',
  'Russian Premier League': 'Premier League (Russie)', 'Spanish Supercopa de Espana': "Supercoupe d'Espagne", 'German Bundesliga Rookie of the Season': 'Révélation de Bundesliga',
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
    // Traduction réappliquée à la lecture : un intitulé ajouté au dictionnaire profite aussi au cache.
    if (c.honours.length) { out[p.id] = c.honours.map(h => ({ ...h, title: HONOUR_FR[h.title] ?? h.title })); found++; } else delete out[p.id];
  }
  log(`${todo.length} joueurs, ${fetched} interrogés, ${found} avec un palmarès`);
  return out;
}

// ---------- joueurs : clubs successifs et titres de ces clubs (Wikidata) ----------
interface Stint { team: string; label: string; start: number; end: number | null }
// Sélections, équipes de jeunes et réserves : leurs titres ne sont pas déduits (être appelé ≠ être du tournoi).
const NOT_CLUB = /^équipe (de|du|d'|des)\b|moins de|espoirs|olympique de football|\bU-?\d{2}\b|^Jong |\bB$|\bII$|réserve|Primavera|jeunes/i;
const DAY = 864e5;
// Un départ d'avant l'été ne concerne pas cette saison : Wikidata n'a simplement pas vu l'arrivée en L1.
const SEASON_START = Date.UTC(2026, 5, 1);

/** Date Wikidata selon sa précision : une année seule vaut le 1er juillet (arrivée) ou le 30 juin (départ). */
function wdTime(v: string | undefined, precision: string | undefined, edge: 'start' | 'end'): number | null {
  if (!v) return null;
  const t = Date.parse(v), y = new Date(t).getUTCFullYear(), p = Number(precision ?? 11);
  if (p <= 9) return edge === 'start' ? Date.UTC(y, 6, 1) : Date.UTC(y, 5, 30);
  if (p === 10) { const m = new Date(t).getUTCMonth(); return edge === 'start' ? Date.UTC(y, m, 1) : Date.UTC(y, m + 1, 0); }
  return t;
}

// Noms des compétitions alignés sur ceux de TheSportsDB (pour fusionner sans doublon).
const COMP_FR: [RegExp, string][] = [
  [/^championnat de France de football$/i, 'Ligue 1'], [/deuxième division|^Ligue 2/i, 'Ligue 2'],
  [/^Coupe de France de football$/i, 'Coupe de France'], [/^Coupe de la Ligue/i, 'Coupe de la Ligue'], [/^Trophée des champions/i, 'Trophée des champions'],
  [/Ligue des champions de l'UEFA|Coupe des clubs champions/i, 'Ligue des champions'], [/Conférence/i, 'Ligue Conférence'],
  [/Ligue Europa|Coupe UEFA/i, 'Ligue Europa'], [/Supercoupe de l'UEFA/i, "Supercoupe de l'UEFA"],
  [/Coupe du monde des clubs/i, 'Coupe du monde des clubs'], [/Coupe intercontinentale/i, 'Coupe intercontinentale'],
  [/^championnat d'Angleterre/i, 'Premier League (Angleterre)'], [/^championnat d'Espagne/i, 'Liga (Espagne)'],
  [/^championnat d'Italie/i, 'Serie A (Italie)'], [/^championnat d'Allemagne/i, 'Bundesliga (Allemagne)'],
  [/^championnat du Portugal/i, 'Liga Portugal'], [/^championnat des Pays-Bas/i, 'Eredivisie (Pays-Bas)'],
  [/^championnat de Belgique/i, 'Pro League (Belgique)'], [/^championnat d'Écosse/i, 'Premiership (Écosse)'],
  [/^Coupe d'Angleterre/i, 'FA Cup'], [/^Coupe d'Espagne|Coupe du Roi/i, 'Coupe du Roi'], [/^Coupe d'Italie/i, "Coupe d'Italie"], [/^Coupe d'Allemagne/i, "Coupe d'Allemagne"],
];
const compName = (label: string) => COMP_FR.find(([re]) => re.test(label))?.[1] ?? label.replace(/ de football$/i, '').replace(/^./, c => c.toUpperCase());
const YOUTH_COMP = /jeunes|U-?\d{2}|Gambardella|Youth|moins de|espoirs|réserve/i;

async function inBatches<T, R>(items: T[], size: number, run: (b: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) { out.push(...await run(items.slice(i, i + size))); await sleep(1000); }
  return out;
}

const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Joueurs sans identifiant Sofascore sur Wikidata : retrouvés par date de naissance, puis nom de famille. */
async function byBirth(players: SeasonFile['players']): Promise<[string, number][]> {
  const withDob = players.filter(p => p.dob && p.full);
  const rows = await inBatches([...new Set(withDob.map(p => p.dob!))], 60, b => sparql(`SELECT ?p ?dob ?l WHERE {
    VALUES ?dob { ${b.map(d => `"${d}T00:00:00Z"^^xsd:dateTime`).join(' ')} }
    ?p wdt:P569 ?dob ; wdt:P106 wd:Q937857 ; rdfs:label ?l . FILTER(LANG(?l) IN ("fr", "en"))
  }`));
  const out: [string, number][] = [];
  for (const p of withDob) {
    const last = fold(p.full!.split(' ').at(-1)!);
    const hits = new Set(rows.filter(r => r.dob?.value.startsWith(p.dob!) && fold(r.l?.value ?? '').split(/[\s-]+/).includes(last)).map(r => qid(r.p?.value)));
    if (hits.size === 1) out.push([[...hits][0], p.id]); // homonyme né le même jour : on s'abstient
  }
  return out;
}

/** Clubs successifs des joueurs : par identifiant Sofascore (P12302), sinon par l'élément Wikidata retrouvé. */
async function stints(ids: number[], items: [string, number][]): Promise<Map<number, Stint[]>> {
  const query = (match: string) => sparql(`SELECT ?sid ?team ?teamLabel ?start ?sp ?end ?ep WHERE {
    ${match}
    ?p p:P54 ?st . ?st ps:P54 ?team .
    OPTIONAL { ?st pqv:P580 [ wikibase:timeValue ?start ; wikibase:timePrecision ?sp ] }
    OPTIONAL { ?st pqv:P582 [ wikibase:timeValue ?end ; wikibase:timePrecision ?ep ] }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
  }`);
  const rows = [
    ...await inBatches(ids, 120, b => query(`VALUES ?sid { ${b.map(i => `"${i}"`).join(' ')} } ?p wdt:P12302 ?sid .`)),
    ...await inBatches(items, 120, b => query(`VALUES (?p ?sid) { ${b.map(([q, i]) => `(wd:${q} "${i}")`).join(' ')} }`)),
  ];
  const out = new Map<number, Stint[]>();
  for (const r of rows) {
    const label = r.teamLabel?.value ?? '', start = wdTime(r.start?.value, r.sp?.value, 'start');
    if (NOT_CLUB.test(label) || start == null) continue;
    const id = Number(r.sid!.value);
    out.set(id, [...(out.get(id) ?? []), { team: qid(r.team?.value), label, start, end: wdTime(r.end?.value, r.ep?.value, 'end') }]);
  }
  return out;
}

interface Win { team: string; title: string; season: string; at: number }
/** Titres gagnés par ces clubs, datés (fin de la saison ou date de la finale). */
async function wins(teams: string[]): Promise<Win[]> {
  const rows = await inBatches(teams, 80, b => sparql(`SELECT ?team ?compLabel ?seasonLabel ?end ?pit WHERE {
    VALUES ?team { ${b.map(t => `wd:${t}`).join(' ')} }
    ?season wdt:P1346 ?team ; wdt:P3450 ?comp .
    OPTIONAL { ?season wdt:P582 ?end } OPTIONAL { ?season wdt:P585 ?pit }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
  }`));
  const out: Win[] = [];
  for (const r of rows) {
    const comp = r.compLabel?.value ?? '', label = r.seasonLabel?.value ?? '';
    if (YOUTH_COMP.test(comp)) continue;
    const season = seasonOf(label);
    const two = label.match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
    const at = Date.parse(r.end?.value ?? r.pit?.value ?? '') || (two ? Date.UTC(+two[1] + 1, 4, 31) : NaN);
    if (!season || !isFinite(at)) continue;
    out.push({ team: qid(r.team?.value), title: compName(comp), season, at });
  }
  return out;
}

/** Champions de L1 depuis 2014-15, recalculés depuis nos résultats (Wikidata en oublie). */
function l1Champions(history: HistoryFile): Win[] {
  return history.seasons.flatMap(S => {
    const champ = buildTable(S.m.map(r => ({ j: r[0], d: r[1], h: r[2], a: r[3], hg: r[4], ag: r[5] })))[0]?.club;
    const club = CLUBS.find(c => c.name === champ);
    const y = Number(S.s.slice(0, 4));
    return club ? [{ team: club.wikidata, title: 'Ligue 1', season: `${y}-${String(y + 1).slice(-2)}`, at: Date.UTC(y + 1, 4, 15) }] : [];
  });
}

const normSeason = (s: string) => s.replace(/^(\d{4})\s*[-–/]\s*(\d{2})?(\d{2})$/, (_, a, _b, c) => `${a}-${c}`);
const honourKey = (h: Honour) => `${HONOUR_FR[h.title] ?? h.title}|${normSeason(h.season).slice(0, 4)}`;

async function fromClubs(season: SeasonFile, history: HistoryFile): Promise<{ honours: Map<number, Honour[]>; moves: Record<string, Move> }> {
  const ids = season.players.map(p => p.id);
  const first = await stints(ids, []);
  const st = new Map([...first, ...await stints([], await byBirth(season.players.filter(p => !first.has(p.id))))]);
  const teams = [...new Set([...st.values()].flat().map(s => s.team))];
  const all = [...await wins(teams), ...l1Champions(history)];
  const byTeam = new Map<string, Win[]>();
  for (const w of all) byTeam.set(w.team, [...(byTeam.get(w.team) ?? []), w]);
  const ourName = new Map(CLUBS.map(c => [c.wikidata, c.name]));
  const dateOf = new Map(season.matches.map(m => [m.id, m.d]));
  const honours = new Map<number, Honour[]>();
  const moves: Record<string, Move> = {};
  for (const p of season.players) {
    const list = st.get(p.id) ?? [];
    const got = new Map<string, Honour>();
    for (const s of list) {
      // Titre compté si le joueur était au club à la fin de la saison (ou à la finale), à 30 jours près.
      for (const w of byTeam.get(s.team) ?? []) {
        if (s.start <= w.at && (s.end == null || s.end >= w.at - 30 * DAY)) {
          const h = { title: w.title, season: w.season, team: ourName.get(s.team) ?? s.label };
          got.set(honourKey(h), h);
        }
      }
    }
    if (got.size) honours.set(p.id, [...got.values()]);
    // Club actuel : le dernier arrivé parmi les passages sans date de fin (un prêt passe devant le club prêteur).
    const now = list.filter(s => s.end == null || s.end > Date.now()).sort((a, b) => b.start - a.start)[0];
    const team = now ? ourName.get(now.team) ?? now.label : null;
    // Départ retenu seulement s'il date d'après son dernier match de L1 (sinon Wikidata n'est pas à jour).
    const last = Math.max(0, ...p.logs.map(L => Date.parse(dateOf.get(L.match) ?? '') || 0));
    if (now && team !== p.club && now.start > Math.max(last, SEASON_START)) moves[p.id] = { team, since: new Date(now.start).toISOString().slice(0, 10) };
  }
  log(`Wikidata : ${st.size} joueurs retrouvés, ${honours.size} avec des titres de club, ${Object.keys(moves).length} partis de leur club de L1`);
  return { honours, moves };
}

async function main() {
  const season: SeasonFile = JSON.parse(fs.readFileSync('public/data/season.json', 'utf8'));
  const prev: PalmaresFile | null = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  let clubs = prev?.clubs ?? {};
  try { clubs = await clubTitles(); log('palmarès des 18 clubs : Wikidata'); }
  catch (e) { log(`clubs : ${(e as Error).message} (palmarès précédent conservé)`); }
  const players = await playerHonours(season, prev);
  let moves = prev?.moves ?? {};
  try {
    const history: HistoryFile = JSON.parse(fs.readFileSync('public/data/history.json', 'utf8'));
    const derived = await fromClubs(season, history);
    moves = derived.moves;
    // Fusion : TheSportsDB d'abord, puis les titres de club qui y manquent (même compétition, même saison = doublon).
    for (const [id, list] of derived.honours) {
      const mine = (players[id] ?? []).map(h => ({ ...h, season: normSeason(h.season) }));
      const seen = new Set(mine.map(honourKey));
      players[id] = [...mine, ...list.filter(h => !seen.has(honourKey(h)))];
    }
  } catch (e) { log(`clubs successifs : ${(e as Error).message} (titres de club et départs précédents conservés)`); }
  const file: PalmaresFile = { updatedAt: new Date().toISOString(), clubs, players, moves };
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(file));
  fs.renameSync(OUT + '.tmp', OUT);
  log('OK');
}

main().catch(e => { console.error('[palmarès] ✗', e); process.exit(1); });
