// Alertes « compo » : être prévenu quand la composition du prochain match d'un joueur sort (titulaire, remplaçant,
// absent). Le téléphone s'abonne aux notifications ; abonnement et alertes sont gardés par un petit serveur
// (worker/, Cloudflare) que le Mac consulte toutes les 10 minutes avant les matchs.
import { useCallback, useState } from 'react';

export const ALERT_API = 'https://searchl1-alertes.searchl1-raphael.workers.dev';
// Clé publique des notifications (la clé privée reste sur le Mac).
const VAPID_PUBLIC = 'BK61D0J3C0Q-wL4SXcF59e84SdBPZVrVQAraDl8-G5j55pKAlt1nolOVKlZUHXqu9dNdiJF4Dzlus7OSfdfEiBE';

export interface Alert { id: number; name: string; club: string; match: number; kickoff: string; opp: string }

const KEY = 'searchl1-alertes', DEVICE = 'searchl1-appareil';
const read = (): Alert[] => {
  try {
    // Une alerte ne vaut que jusqu'au coup d'envoi de son match.
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as Alert[]).filter(a => Date.parse(a.kickoff) > Date.now());
  } catch { return []; }
};
const write = (list: Alert[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* stockage indisponible */ } };

function deviceId(): string {
  let id = '';
  try { id = localStorage.getItem(DEVICE) ?? ''; } catch { /* stockage indisponible */ }
  if (!/^[a-f0-9]{32}$/.test(id)) {
    id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(DEVICE, id); } catch { /* stockage indisponible */ }
  }
  return id;
}

const b64 = (s: string) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

/** Pourquoi les notifications ne marchent pas ici (null : elles marchent). */
export function pushUnavailable(): string | null {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return "Les notifications ne marchent que dans l'app installée : dans Safari, Partager → « Sur l'écran d'accueil », puis ouvre SearchL1 depuis l'icône.";
  }
  return null;
}

async function save(list: Alert[]): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
  const res = await fetch(`${ALERT_API}/device/${deviceId()}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), alerts: list }),
  });
  if (!res.ok) throw new Error(`serveur d'alertes : HTTP ${res.status}`);
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(read);
  const has = useCallback((id: number) => alerts.some(a => a.id === id), [alerts]);

  /** Ajoute ou retire l'alerte ; renvoie un message d'erreur à afficher, ou null. */
  const toggle = useCallback(async (a: Alert): Promise<string | null> => {
    const cur = read();
    const on = cur.some(x => x.id === a.id);
    const next = on ? cur.filter(x => x.id !== a.id) : [...cur, a];
    if (!on) {
      const why = pushUnavailable();
      if (why) return why;
      // Demandé au moment du toucher : iOS l'exige.
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') return 'Notifications refusées. Pour les autoriser : Réglages → Notifications → SearchL1.';
    }
    try {
      await save(next);
    } catch (e) {
      return `Alerte non enregistrée (${(e as Error).message}). Vérifie ta connexion et réessaie.`;
    }
    write(next);
    setAlerts(next);
    return null;
  }, []);

  return { alerts, has, toggle };
}
