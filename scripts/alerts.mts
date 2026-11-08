// Alertes « compo » : lancé par la tâche du Mac toutes les 10 minutes. Pour chaque alerte dont le match commence
// dans moins de 75 minutes, on regarde la composition sur Sofascore ; dès qu'elle est officielle, on envoie la
// notification (titulaire, remplaçant, absent, pas dans le groupe) et on retire l'alerte.
// Réglages (hors dépôt) : ~/Library/Application Support/SearchL1/alertes.json
//   { "api": "https://….workers.dev", "secret": "…", "vapidPublic": "…", "vapidPrivate": "…" }
// Sans ce fichier, ou sans alerte proche, le script s'arrête aussitôt (et ne dit rien).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import webpush, { type PushSubscription } from 'web-push';
import { compoStatus, type Alert } from './lib/compo.ts';
import { Sofascore, type SfLineups } from './lib/sofascore.ts';

interface Device { id: string; sub: PushSubscription; alerts: Alert[] }

const CONF = path.join(os.homedir(), 'Library/Application Support/SearchL1/alertes.json');
const BEFORE = 75 * 6e4; // on commence à regarder 75 min avant le coup d'envoi
const GIVE_UP = 20 * 6e4; // 20 min après, plus de compo à attendre
const log = (...a: unknown[]) => console.log('[alertes]', ...a);

if (!fs.existsSync(CONF)) process.exit(0);
const conf: { api: string; secret: string; vapidPublic: string; vapidPrivate: string } = JSON.parse(fs.readFileSync(CONF, 'utf8'));
webpush.setVapidDetails('https://raphaelgaudin.github.io/SearchL1/', conf.vapidPublic, conf.vapidPrivate);
const auth = { Authorization: `Bearer ${conf.secret}` };

const res = await fetch(`${conf.api}/devices`, { headers: auth });
if (!res.ok) { log(`serveur d'alertes : HTTP ${res.status}`); process.exit(1); }
const { devices } = await res.json() as { devices: Device[] };
const now = Date.now();
const due = devices.flatMap(d => (d.alerts ?? []).filter(a => now >= Date.parse(a.kickoff) - BEFORE).map(a => ({ d, a })));
if (!due.length) process.exit(0);

const sf = new Sofascore();
let opened = false;
// null : pas de réponse de Sofascore (blocage passager) ; sinon la composition, officielle ou non.
const lineups = new Map<number, SfLineups | null>();
const done = new Map<string, { id: number; match: number }[]>();
const gone = new Set<string>();
try {
  for (const { d, a } of due) {
    let msg: { title: string; body: string } | null = null;
    if (!lineups.has(a.match)) {
      if (!opened) { await sf.open(); opened = true; }
      lineups.set(a.match, await sf.get<SfLineups>(`/api/v1/event/${a.match}/lineups`, { fresh: true }).catch(() => null));
    }
    const L = lineups.get(a.match) ?? null;
    msg = compoStatus(L, a);
    if (!msg && now > Date.parse(a.kickoff) + GIVE_UP) msg = L
      ? { title: `Pas de compo pour ${a.name}`, body: `La composition officielle de ${a.club} – ${a.opp} n'est pas sortie à temps.` }
      : { title: `Compo de ${a.name} non récupérée`, body: `Sofascore n'a pas répondu avant ${a.club} – ${a.opp}.` };
    if (!msg) continue;
    try {
      await webpush.sendNotification(d.sub, JSON.stringify({ ...msg, url: `./#/match/${a.match}`, tag: `compo-${a.match}-${a.id}` }), { TTL: 3600 });
      log(`${msg.title} (${msg.body})`);
    } catch (e) {
      // Abonnement expiré (app désinstallée, notifications coupées) : on oublie ce téléphone.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.add(d.id); else { log(`envoi impossible (${msg.title}) : ${(e as Error).message}`); continue; }
    }
    done.set(d.id, [...(done.get(d.id) ?? []), { id: a.id, match: a.match }]);
  }
} finally {
  await sf.close();
}
for (const id of gone) await fetch(`${conf.api}/device/${id}`, { method: 'DELETE' });
for (const [id, remove] of done) {
  if (gone.has(id)) continue;
  await fetch(`${conf.api}/device/${id}/done`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ remove }) });
}
