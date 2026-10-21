// Favoris (joueurs et clubs), gardés sur le téléphone. Lecture / écriture protégées : en navigation privée,
// le stockage peut être indisponible, l'app marche alors sans mémoriser.
import { useSyncExternalStore } from 'react';

interface Favs { players: number[]; clubs: string[] }
const KEY = 'searchl1-favoris';
const EMPTY: Favs = { players: [], clubs: [] };

let current: Favs = read();
const listeners = new Set<() => void>();

function read(): Favs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && Array.isArray(v.players) && Array.isArray(v.clubs) ? v : EMPTY;
  } catch { return EMPTY; }
}

function write(next: Favs) {
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { current = read(); l(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
};

export function useFavorites() {
  const favs = useSyncExternalStore(subscribe, () => current, () => EMPTY);
  const toggle = <K extends keyof Favs>(kind: K, id: Favs[K][number]) => {
    const list = current[kind] as (typeof id)[];
    write({ ...current, [kind]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] });
  };
  return {
    players: favs.players,
    clubs: favs.clubs,
    isPlayer: (id: number) => favs.players.includes(id),
    isClub: (c: string) => favs.clubs.includes(c),
    togglePlayer: (id: number) => toggle('players', id),
    toggleClub: (c: string) => toggle('clubs', c),
  };
}
