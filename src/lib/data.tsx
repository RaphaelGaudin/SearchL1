import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { buildData, type Data } from './model.ts';
import { slot } from './schedule.ts';
import type { HistoryFile, MetaFile, SeasonFile } from './types.ts';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Data };
export interface Freshness { refreshing: boolean; checkedAt: number; refresh: () => void }

const Ctx = createContext<Data | null>(null);
const FreshCtx = createContext<Freshness>({ refreshing: false, checkedAt: 0, refresh: () => {} });

async function load<T>(name: string): Promise<T> {
  // « no-cache » : on revalide auprès du serveur ; hors ligne, le service worker répond avec la dernière version.
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${name}.json : HTTP ${res.status}`);
  return res.json();
}

/**
 * Charge les données, puis les recharge toute seule quand un créneau de mise à jour (lundi 18 h 30, vendredi 8 h)
 * est passé depuis le dernier chargement : à l'ouverture de l'app, au retour au premier plan et toutes les 5 minutes.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const history = useRef<HistoryFile | null>(null);
  const updatedAt = useRef<string | null>(null);
  const busy = useRef(false);

  const fetchAll = useCallback(async (force: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const meta = await load<MetaFile>('meta');
      if (force || meta.updatedAt !== updatedAt.current) {
        const [season, hist] = await Promise.all([load<SeasonFile>('season'), history.current ? history.current : load<HistoryFile>('history')]);
        history.current = hist;
        updatedAt.current = meta.updatedAt;
        setState({ status: 'ready', data: buildData(meta, season, hist) });
      }
      setCheckedAt(Date.now());
    } catch (e) {
      setState(s => (s.status === 'ready' ? s : { status: 'error', message: (e as Error).message }));
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(true); }, [fetchAll]);

  useEffect(() => {
    const due = () => document.visibilityState === 'visible' && checkedAt > 0 && slot() > checkedAt;
    const check = () => { if (due()) fetchAll(false); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    const t = setInterval(check, 5 * 60e3);
    return () => { document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); clearInterval(t); };
  }, [checkedAt, fetchAll]);

  if (state.status === 'loading') return <div className="boot">Chargement du championnat…</div>;
  if (state.status === 'error')
    return (
      <div className="boot">
        <p>Données indisponibles.</p>
        <p className="muted small">{state.message}. Hors ligne, l'app réaffiche les dernières données dès qu'elles ont été chargées une fois.</p>
      </div>
    );
  return (
    <FreshCtx.Provider value={{ refreshing, checkedAt, refresh: () => fetchAll(true) }}>
      <Ctx.Provider value={state.data}>{children}</Ctx.Provider>
    </FreshCtx.Provider>
  );
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData hors de DataProvider');
  return d;
}

export const useFreshness = () => useContext(FreshCtx);
