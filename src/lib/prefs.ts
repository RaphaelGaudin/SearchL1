// Préférences d'affichage gardées sur le téléphone (niveau de détail du classement, onglet choisi…).
import { useState } from 'react';

export function usePref<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const k = `searchl1-${key}`;
  const [v, setV] = useState<T>(() => {
    try { return (localStorage.getItem(k) as T | null) ?? initial; } catch { return initial; }
  });
  const set = (x: T) => {
    setV(x);
    try { localStorage.setItem(k, x); } catch { /* stockage indisponible */ }
  };
  return [v, set];
}
