// Client Sofascore (API non officielle). L'API refuse les clients HTTP simples (« challenge ») :
// on passe par un vrai Chromium qui ouvre le site, puis on appelle l'API depuis la page.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const CACHE_DIR = path.resolve('.cache/sofascore');
const DELAY_MS = 450;

export class Sofascore {
  private browser?: Browser;
  private page?: Page;
  private last = 0;
  requests = 0;
  cacheHits = 0;

  async open() {
    this.browser = await chromium.launch({ channel: 'chromium' });
    this.page = await this.browser.newPage();
    await this.page.goto('https://www.sofascore.com/fr/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }

  async close() {
    await this.browser?.close();
  }

  /**
   * GET sur l'API. `cache: 'forever'` pour ce qui ne bouge plus (feuilles de matchs terminés),
   * sinon le cache sert seulement de secours si l'appel échoue.
   */
  async get<T>(apiPath: string, opts: { cache?: 'forever' | 'fallback' } = {}): Promise<T | null> {
    const file = path.join(CACHE_DIR, apiPath.replace(/^\/api\/v1\//, '').replace(/[^a-z0-9]+/gi, '_') + '.json');
    if (opts.cache === 'forever' && fs.existsSync(file)) {
      this.cacheHits++;
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    if (!this.page) throw new Error('Sofascore: open() non appelé');
    for (let attempt = 0; attempt < 3; attempt++) {
      const wait = this.last + DELAY_MS * (attempt + 1) - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this.last = Date.now();
      this.requests++;
      const res = await this.page.evaluate(async u => {
        const r = await fetch(u);
        return { status: r.status, body: r.ok ? await r.text() : null };
      }, apiPath);
      if (res.status === 404) return null;
      if (res.body) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(file, res.body);
        return JSON.parse(res.body);
      }
    }
    if (fs.existsSync(file)) {
      this.cacheHits++;
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    throw new Error(`Sofascore: échec sur ${apiPath}`);
  }
}

// Sous-ensemble des réponses utilisé par les scripts.
export interface SfTeam { id: number; name: string; shortName: string }
export interface SfEvent {
  id: number;
  startTimestamp: number;
  roundInfo?: { round?: number; name?: string };
  status: { type: string; description?: string };
  homeTeam: SfTeam;
  awayTeam: SfTeam;
  homeScore?: { current?: number; normaltime?: number; penalties?: number };
  awayScore?: { current?: number; normaltime?: number; penalties?: number };
  winnerCode?: number;
  hasEventPlayerStatistics?: boolean;
  tournament: { uniqueTournament?: { id: number; name: string } };
}
export interface SfLineupPlayer {
  player: { id: number; name: string; shortName?: string; position?: string; dateOfBirthTimestamp?: number; country?: { alpha2?: string }; height?: number };
  position?: string;
  substitute: boolean;
  statistics?: Record<string, number | undefined>;
}
export interface SfLineups {
  confirmed: boolean;
  home: { players: SfLineupPlayer[]; missingPlayers?: SfMissing[] };
  away: { players: SfLineupPlayer[]; missingPlayers?: SfMissing[] };
}
export interface SfMissing {
  player: { id: number; name: string; shortName?: string };
  type?: string;
  reason?: number;
  description?: string;
  expectedEndDate?: string;
}
export interface SfIncident {
  incidentType: string;
  incidentClass?: string;
  time?: number;
  addedTime?: number;
  isHome?: boolean;
  player?: { id: number; name: string; shortName?: string };
  assist1?: { id: number; name: string; shortName?: string };
}
