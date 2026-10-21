// Met à jour public/data/*.json : historique (openfootball), saison en cours, joueurs, absents et coupes (Sofascore).
// Usage : npm run data            (tout)
//         npm run data -- --no-history
// Si une vérification échoue, rien n'est écrit : les anciennes données restent en place.
import fs from 'node:fs';
import path from 'node:path';
import { CLUB_NAMES, clubBySofascoreId } from '../src/lib/clubs.ts';
import type { Absence, CupCode, CupMatch, GoalEvent, HistoryFile, Match, MetaFile, Player, PlayerLog, Position, SeasonFile } from '../src/lib/types.ts';
import { fetchSeason, type OfMatch } from './lib/openfootball.ts';
import { Sofascore, type SfEvent, type SfIncident, type SfLineups, type SfMissing } from './lib/sofascore.ts';
import { checkGoals, checkStandings, type PublishedRow } from './lib/validate.ts';

const OUT = path.resolve('public/data');
const SEASON = '2026-27';
const TOURNAMENT = 34;
const SEASON_ID = 96127;
const ROUNDS = 34;
const HISTORY_FROM = 2014;
const CUPS: Record<number, CupCode> = { 7: 'LDC', 679: 'LE', 17015: 'LC', 335: 'CDF' };
// Calendrier général FFF : entrée des clubs de L1 en 32es.
const CDF_ROUNDS = [
  { stage: '32es de finale', d: '2026-12-20T15:00:00Z' },
  { stage: '16es de finale', d: '2027-01-09T15:00:00Z' },
  { stage: '8es de finale', d: '2027-02-03T19:00:00Z' },
  { stage: 'Quarts de finale', d: '2027-03-03T19:00:00Z' },
  { stage: 'Demi-finales', d: '2027-04-21T19:00:00Z' },
  { stage: 'Finale', d: '2027-05-15T19:00:00Z' },
];

const args = new Set(process.argv.slice(2));
const warnings: string[] = [];
const log = (...a: unknown[]) => console.log('[data]', ...a);
const warn = (s: string) => { warnings.push(s); console.warn('[data] ⚠', s); };
const readJson = <T>(file: string): T | null => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

// ---------- historique ----------
async function buildHistory(): Promise<HistoryFile> {
  const seasons: HistoryFile['seasons'] = [];
  const startYear = Number(SEASON.slice(0, 4));
  for (let y = HISTORY_FROM; y < startYear; y++) {
    const s = `${y}-${String(y + 1).slice(2)}`;
    const ms = (await fetchSeason(s)).filter(m => m.hg != null);
    // 2019-20 s'est arrêtée à 279 matchs (Covid).
    if (ms.length < 279) warn(`historique ${s} : seulement ${ms.length} matchs`);
    seasons.push({ s, m: ms.map(m => [m.j, m.date, m.h, m.a, m.hg!, m.ag!]) });
  }
  return { seasons };
}

// ---------- saison en cours (Sofascore) ----------
const POS: Record<string, Position> = { G: 'G', D: 'D', M: 'M', F: 'A' };
const STATUS: Record<string, Match['status']> = { finished: 'finished', notstarted: 'notstarted', postponed: 'postponed', inprogress: 'live', canceled: 'canceled' };
const INJURY_FR: [RegExp, string][] = [
  [/yellow_card/i, 'cumul de cartons'], [/red_card/i, 'carton rouge'], [/suspen/i, 'suspension'],
  [/broken ankle/i, 'fracture de la cheville'], [/ankle/i, 'cheville'], [/knee/i, 'genou'], [/cruciate|acl/i, 'ligaments croisés'],
  [/hamstring/i, 'ischio-jambiers'], [/thigh/i, 'cuisse'], [/calf/i, 'mollet'], [/groin|adductor/i, 'adducteurs'],
  [/muscle/i, 'blessure musculaire'], [/foot/i, 'pied'], [/back/i, 'dos'], [/shoulder/i, 'épaule'], [/hip/i, 'hanche'],
  [/achilles/i, "tendon d'Achille"], [/head|concussion/i, 'commotion'], [/ill|virus|sick/i, 'malade'], [/personal/i, 'raisons personnelles'],
];
const frWhy = (d?: string) => (d ? (INJURY_FR.find(([re]) => re.test(d))?.[1] ?? d) : 'motif non précisé');

function absenceOf(m: SfMissing, club: string): Absence {
  const d = m.description ?? '';
  const type: Absence['type'] = m.type === 'doubtful' ? 'D' : m.reason === 11 || /suspen|card/i.test(d) ? 'S' : m.reason === 1 || /injur|broken|strain|tear/i.test(d) ? 'B' : 'C';
  return { club, player: m.player.name, playerId: m.player.id, type, why: frWhy(d), source: 'Sofascore' };
}

const clubOf = (t: { id: number; shortName: string }) => clubBySofascoreId.get(t.id)?.name ?? t.shortName;

async function buildSeason(sf: Sofascore): Promise<{ file: SeasonFile; published: PublishedRow[] }> {
  const now = Date.now();
  const events: SfEvent[] = [];
  for (let j = 1; j <= ROUNDS; j++) {
    const r = await sf.get<{ events: SfEvent[] }>(`/api/v1/unique-tournament/${TOURNAMENT}/season/${SEASON_ID}/events/round/${j}`, { cache: 'fallback' });
    for (const e of r?.events ?? []) events.push({ ...e, roundInfo: { round: j } });
  }
  log(`${events.length} matchs au calendrier`);

  const matches: Match[] = [];
  const players = new Map<number, Player>();
  const incompleteIncidents: { m: Match; inc: SfIncident[] }[] = [];

  for (const e of events) {
    const h = clubOf(e.homeTeam), a = clubOf(e.awayTeam);
    const status = STATUS[e.status.type] ?? 'notstarted';
    const m: Match = {
      id: e.id, j: e.roundInfo!.round!, d: new Date(e.startTimestamp * 1000).toISOString(), h, a,
      hg: status === 'finished' ? e.homeScore?.current ?? null : null,
      ag: status === 'finished' ? e.awayScore?.current ?? null : null,
      status,
    };
    matches.push(m);
    if (status !== 'finished') continue;

    // Les stats d'un match se stabilisent dans les heures qui suivent : on ne fige le cache qu'après 36 h.
    const cache = now - e.startTimestamp * 1000 > 36 * 3600e3 ? 'forever' : 'fallback';
    const inc = (await sf.get<{ incidents: SfIncident[] }>(`/api/v1/event/${e.id}/incidents`, { cache }))?.incidents ?? [];
    const goals: GoalEvent[] = inc.filter(i => i.incidentType === 'goal').reverse().map(i => ({
      min: (i.time ?? 0) + (i.addedTime ?? 0), home: !!i.isHome,
      scorer: i.player?.shortName ?? i.player?.name ?? '?', assist: i.assist1?.shortName ?? i.assist1?.name,
      kind: i.incidentClass === 'penalty' ? 'penalty' : i.incidentClass === 'ownGoal' ? 'own' : 'regular',
    }));
    m.goals = goals;
    const lineups = e.hasEventPlayerStatistics === false ? null : await sf.get<SfLineups>(`/api/v1/event/${e.id}/lineups`, { cache });
    if (!lineups || !lineups.home?.players?.length) {
      m.incomplete = true;
      incompleteIncidents.push({ m, inc });
      warn(`feuille de match manquante : ${h}-${a} (J${m.j})`);
      continue;
    }

    const byPlayer = (pred: (i: SfIncident) => boolean) => {
      const c = new Map<number, number>();
      inc.filter(pred).forEach(i => i.player && c.set(i.player.id, (c.get(i.player.id) ?? 0) + 1));
      return c;
    };
    const pens = byPlayer(i => i.incidentType === 'goal' && i.incidentClass === 'penalty');
    const ogs = byPlayer(i => i.incidentType === 'goal' && i.incidentClass === 'ownGoal');
    const yel = byPlayer(i => i.incidentType === 'card' && i.incidentClass === 'yellow');
    const red = byPlayer(i => i.incidentType === 'card' && (i.incidentClass === 'red' || i.incidentClass === 'yellowRed'));

    for (const [side, home] of [['home', true], ['away', false]] as const) {
      const club = home ? h : a;
      for (const lp of lineups[side].players) {
        const id = lp.player.id;
        const s = lp.statistics ?? {};
        const pos = POS[lp.player.position ?? lp.position ?? 'M'] ?? 'M';
        let p = players.get(id);
        if (!p) players.set(id, (p = { id, n: lp.player.shortName ?? lp.player.name, club, pos, logs: [] }));
        p.club = club; // dernier club connu (transferts en cours de saison)
        const min = s.minutesPlayed ?? 0;
        if (!min && lp.substitute) continue; // remplaçant non entré
        const L: PlayerLog = {
          j: m.j, match: m.id, home, gf: home ? m.hg! : m.ag!, ga: home ? m.ag! : m.hg!, lu: true, sub: lp.substitute, min,
          r: s.rating ?? null, g: s.goals ?? 0, pen: pens.get(id) ?? 0, a: s.goalAssist ?? 0, og: ogs.get(id) ?? 0,
          y: yel.get(id) ?? 0, rc: red.get(id) ?? 0, tk: s.wonTackle ?? 0, int: s.interceptionWon ?? 0, kp: s.keyPass ?? 0,
          xg: round(s.expectedGoals ?? 0), xa: round(s.expectedAssists ?? 0), sav: s.saves ?? 0, gp: round(s.goalsPrevented ?? 0),
        };
        p.logs.push(L);
      }
    }
  }

  // Feuilles manquantes : on garde seulement ce que les incidents disent (buts, passes, cartons), marqué lu = false.
  for (const { m, inc } of incompleteIncidents) {
    const touched = new Map<number, PlayerLog>();
    const logFor = (id: number, home: boolean) => {
      let L = touched.get(id);
      if (!L) {
        const p = players.get(id);
        if (!p) return null;
        L = { j: m.j, match: m.id, home, gf: home ? m.hg! : m.ag!, ga: home ? m.ag! : m.hg!, lu: false, sub: false, min: 0, r: null,
          g: 0, pen: 0, a: 0, og: 0, y: 0, rc: 0, tk: 0, int: 0, kp: 0, xg: 0, xa: 0, sav: 0, gp: 0 };
        touched.set(id, L);
        p.logs.push(L);
      }
      return L;
    };
    for (const i of inc) {
      const home = !!i.isHome;
      if (i.incidentType === 'goal' && i.player) {
        // Un csc est inscrit côté bénéficiaire : le joueur fautif est dans l'autre équipe.
        const L = logFor(i.player.id, i.incidentClass === 'ownGoal' ? !home : home);
        if (L) { if (i.incidentClass === 'ownGoal') L.og++; else { L.g++; if (i.incidentClass === 'penalty') L.pen++; } }
        if (i.assist1) { const A = logFor(i.assist1.id, home); if (A) A.a++; }
      } else if (i.incidentType === 'card' && i.player) {
        const L = logFor(i.player.id, home);
        if (L) { if (i.incidentClass === 'yellow') L.y++; else L.rc++; }
      }
    }
  }

  const finished = matches.filter(m => m.status === 'finished');
  const nextRound = matches.filter(m => m.status === 'notstarted').reduce((n, m) => Math.min(n, m.j), Infinity);

  // Absents de la prochaine journée : liste « missingPlayers » publiée avant le match.
  const absences: Absence[] = [];
  if (isFinite(nextRound)) {
    for (const m of matches.filter(x => x.j === nextRound && x.status === 'notstarted')) {
      const L = await sf.get<SfLineups>(`/api/v1/event/${m.id}/lineups`, { cache: 'fallback' }).catch(() => null);
      if (!L) continue;
      (L.home.missingPlayers ?? []).forEach(x => absences.push(absenceOf(x, m.h)));
      (L.away.missingPlayers ?? []).forEach(x => absences.push(absenceOf(x, m.a)));
    }
  }

  const cups = await buildCups(sf);

  const st = await sf.get<{ standings: { rows: { team: { id: number; shortName: string }; matches: number; points: number; scoresFor: number; scoresAgainst: number }[] }[] }>(
    `/api/v1/unique-tournament/${TOURNAMENT}/season/${SEASON_ID}/standings/total`, { cache: 'fallback' });
  const published: PublishedRow[] = (st?.standings[0]?.rows ?? []).map(r => ({ club: clubOf(r.team), mp: r.matches, pts: r.points, gf: r.scoresFor, ga: r.scoresAgainst }));

  log(`${finished.length} matchs joués, ${players.size} joueurs, ${absences.length} absents, ${cups.length} matchs de coupe`);
  return {
    file: { season: SEASON, matches: matches.sort((x, y) => x.j - y.j || x.d.localeCompare(y.d)), players: [...players.values()], absences, cups },
    published,
  };
}

const round = (x: number) => Math.round(x * 100) / 100;

async function buildCups(sf: Sofascore): Promise<CupMatch[]> {
  const out: CupMatch[] = [];
  const seasonStart = Date.parse(`${SEASON.slice(0, 4)}-07-01`) / 1000;
  for (const name of CLUB_NAMES) {
    const id = [...clubBySofascoreId.entries()].find(([, c]) => c.name === name)![0];
    const evs: SfEvent[] = [];
    for (const k of ['last', 'next']) {
      const r = await sf.get<{ events: SfEvent[] }>(`/api/v1/team/${id}/events/${k}/0`, { cache: 'fallback' });
      evs.push(...(r?.events ?? []));
    }
    const mine = evs
      .filter(e => e.startTimestamp >= seasonStart && CUPS[e.tournament.uniqueTournament?.id ?? 0])
      .map((e): CupMatch => {
        const home = e.homeTeam.id === id;
        const done = e.status.type === 'finished';
        const comp = CUPS[e.tournament.uniqueTournament!.id];
        const gf = done ? (home ? e.homeScore?.current : e.awayScore?.current) ?? null : null;
        const ga = done ? (home ? e.awayScore?.current : e.homeScore?.current) ?? null : null;
        return {
          club: name, comp, d: new Date(e.startTimestamp * 1000).toISOString(),
          stage: e.roundInfo?.name ?? (e.roundInfo?.round ? `J${e.roundInfo.round}` : ''),
          opp: home ? e.awayTeam.shortName : e.homeTeam.shortName, home, gf, ga,
          // Coupe de France : match sec, la défaite (y compris aux tirs au but) élimine.
          out: comp === 'CDF' && done ? e.winnerCode !== (home ? 1 : 2) : undefined,
        };
      });
    const seen = new Set<string>();
    const uniq = mine.filter(c => !seen.has(c.d + c.opp) && (seen.add(c.d + c.opp), true)).sort((x, y) => x.d.localeCompare(y.d));
    // Coupe de France : tant que le tirage n'est pas fait, on affiche le prochain tour avec « adversaire à tirer au sort ».
    const cdf = uniq.filter(c => c.comp === 'CDF');
    if (!cdf.some(c => c.out) && !cdf.some(c => c.gf == null)) {
      const lastDate = cdf.at(-1)?.d ?? '';
      const next = CDF_ROUNDS.find(r => r.d > lastDate);
      if (next) uniq.push({ club: name, comp: 'CDF', d: next.d, stage: next.stage, opp: null, home: null, gf: null, ga: null, tbd: true });
    }
    out.push(...uniq);
  }
  return out;
}

// ---------- secours : openfootball pour les résultats ----------
function fallbackSeason(prev: SeasonFile | null, of: OfMatch[]): SeasonFile {
  const key = (j: number, h: string, a: string) => `${j}|${h}|${a}`;
  const ofBy = new Map(of.map(m => [key(m.j, m.h, m.a), m]));
  if (prev) {
    for (const m of prev.matches) {
      const o = ofBy.get(key(m.j, m.h, m.a));
      if (o && o.hg != null && m.status !== 'finished') {
        Object.assign(m, { hg: o.hg, ag: o.ag, status: 'finished', incomplete: true });
      }
    }
    return prev;
  }
  return {
    season: SEASON, players: [], absences: [], cups: [],
    matches: of.map((m, i) => ({
      id: -(i + 1), j: m.j, d: new Date(`${m.date}T${m.time ?? '20:00'}:00+02:00`).toISOString(), h: m.h, a: m.a,
      hg: m.hg, ag: m.ag, status: m.hg != null ? 'finished' : 'notstarted', incomplete: m.hg != null || undefined,
    })),
  };
}

// ---------- main ----------
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const sources: Record<string, string> = {};
  const history = args.has('--no-history') ? readJson<HistoryFile>(path.join(OUT, 'history.json')) : await buildHistory();
  if (!history) throw new Error('history.json absent : relance sans --no-history');
  sources.history = 'openfootball';

  const prev = readJson<SeasonFile>(path.join(OUT, 'season.json'));
  let season: SeasonFile;
  let published: PublishedRow[] = [];
  const sf = new Sofascore();
  try {
    await sf.open();
    ({ file: season, published } = await buildSeason(sf));
    sources.season = 'Sofascore';
  } catch (e) {
    warn(`Sofascore indisponible (${(e as Error).message}) : résultats repris d'openfootball, stats joueurs inchangées`);
    season = fallbackSeason(prev, await fetchSeason(SEASON));
    sources.season = 'openfootball (secours)';
  } finally {
    await sf.close();
    log(`Sofascore : ${sf.requests} requêtes, ${sf.cacheHits} lectures du cache`);
  }

  // ---------- vérifications ----------
  const errors = published.length ? checkStandings(season.matches, published) : [];
  if (!published.length && sources.season === 'Sofascore') errors.push('classement publié introuvable');
  const g = checkGoals(season.matches, season.players);
  for (const id of g.bad) season.matches.find(m => m.id === id)!.incomplete = true;
  g.errors.forEach(e => warn(e + ' → match marqué incomplet'));
  if (errors.length) {
    errors.forEach(e => console.error('[data] ✗', e));
    console.error('[data] Vérification échouée : anciennes données conservées.');
    process.exit(1);
  }

  const finished = season.matches.filter(m => m.status === 'finished');
  const next = season.matches.filter(m => m.status === 'notstarted');
  const meta: MetaFile = {
    updatedAt: new Date().toISOString(), season: SEASON,
    lastRound: finished.reduce((n, m) => Math.max(n, m.j), 0),
    nextRound: next.length ? Math.min(...next.map(m => m.j)) : null,
    sources, warnings,
  };
  const write = (name: string, data: unknown) => {
    const tmp = path.join(OUT, `.${name}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, path.join(OUT, name));
  };
  write('history.json', history);
  write('season.json', season);
  write('meta.json', meta);
  log(`OK : J${meta.lastRound} jouée, prochaine J${meta.nextRound}, ${warnings.length} avertissement(s)`);
}

main().catch(e => { console.error('[data] ✗', e); process.exit(1); });
