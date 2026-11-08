// Serveur d'alertes « compo » de SearchL1. Pour chaque téléphone (identifiant aléatoire créé par l'app) :
// son abonnement aux notifications et ses alertes (un joueur, son prochain match).
//   PUT    /device/:id         l'app enregistre abonnement + alertes
//   DELETE /device/:id         l'app supprime tout
//   GET    /devices            le Mac lit tout (clé secrète)
//   POST   /device/:id/done    le Mac retire les alertes envoyées (clé secrète) : { remove: [{ id, match }] }

interface Env { ALERTES: KVNamespace; MAC_SECRET: string }
interface Alert { id: number; name: string; club: string; match: number; kickoff: string; opp: string }
interface Device { sub: unknown; alerts: Alert[]; at: string }

// Seules les pages de l'app peuvent écrire depuis un navigateur.
const ORIGINS = [/^https:\/\/raphaelgaudin\.github\.io$/, /^http:\/\/localhost:\d+$/];
const ID = /^[a-f0-9]{32}$/;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('Origin') ?? '';
  return ORIGINS.some(r => r.test(o))
    ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', Vary: 'Origin' }
    : {};
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

/** Alertes valides seulement : au plus 30, champs attendus, rien d'autre. */
function cleanAlerts(x: unknown): Alert[] | null {
  if (!Array.isArray(x) || x.length > 30) return null;
  const out: Alert[] = [];
  for (const a of x) {
    if (!a || typeof a !== 'object') return null;
    const { id, name, club, match, kickoff, opp } = a as Record<string, unknown>;
    if (typeof id !== 'number' || typeof match !== 'number' || typeof name !== 'string' || typeof club !== 'string' || typeof kickoff !== 'string' || typeof opp !== 'string') return null;
    out.push({ id, name: name.slice(0, 60), club: club.slice(0, 40), match, kickoff: kickoff.slice(0, 30), opp: opp.slice(0, 40) });
  }
  return out;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const isMac = !!env.MAC_SECRET && req.headers.get('Authorization') === `Bearer ${env.MAC_SECRET}`;

    if (req.method === 'GET' && parts[0] === 'devices' && parts.length === 1) {
      if (!isMac) return json(req, { error: 'non autorisé' }, 401);
      const list = await env.ALERTES.list({ prefix: 'device:' });
      const devices = await Promise.all(list.keys.map(async k => ({ id: k.name.slice(7), ...(await env.ALERTES.get<Device>(k.name, 'json')) })));
      return json(req, { devices });
    }

    if (parts[0] !== 'device' || !ID.test(parts[1] ?? '')) return json(req, { error: 'introuvable' }, 404);
    const key = `device:${parts[1]}`;

    if (parts.length === 2 && req.method === 'PUT') {
      const text = await req.text();
      if (text.length > 8000) return json(req, { error: 'trop gros' }, 413);
      let body: { sub?: unknown; alerts?: unknown };
      try { body = JSON.parse(text); } catch { return json(req, { error: 'JSON invalide' }, 400); }
      const alerts = cleanAlerts(body.alerts ?? []);
      const sub = body.sub as { endpoint?: unknown } | undefined;
      if (!alerts || !sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return json(req, { error: 'données invalides' }, 400);
      // Sans alerte pendant 30 jours, le téléphone est oublié.
      await env.ALERTES.put(key, JSON.stringify({ sub, alerts, at: new Date().toISOString() }), { expirationTtl: 30 * 86400 });
      return json(req, { ok: true });
    }
    if (parts.length === 2 && req.method === 'DELETE') {
      await env.ALERTES.delete(key);
      return json(req, { ok: true });
    }
    if (parts.length === 3 && parts[2] === 'done' && req.method === 'POST') {
      if (!isMac) return json(req, { error: 'non autorisé' }, 401);
      const cur = await env.ALERTES.get<Device>(key, 'json');
      const body = await req.json().catch(() => null) as { remove?: { id: number; match: number }[] } | null;
      if (!cur || !Array.isArray(body?.remove)) return json(req, { error: 'données invalides' }, 400);
      // On retire seulement les alertes envoyées : une alerte ajoutée entre-temps depuis l'app est gardée.
      const done = new Set(body.remove.map(r => `${r.id}:${r.match}`));
      await env.ALERTES.put(key, JSON.stringify({ ...cur, alerts: cur.alerts.filter(a => !done.has(`${a.id}:${a.match}`)) }), { expirationTtl: 30 * 86400 });
      return json(req, { ok: true });
    }
    return json(req, { error: 'méthode non prise en charge' }, 405);
  },
};
