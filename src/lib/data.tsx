import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { buildData, type Data } from './model.ts';
import type { HistoryFile, MetaFile, SeasonFile } from './types.ts';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Data };

const Ctx = createContext<Data | null>(null);

async function load<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!res.ok) throw new Error(`${name}.json : HTTP ${res.status}`);
  return res.json();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    Promise.all([load<MetaFile>('meta'), load<SeasonFile>('season'), load<HistoryFile>('history')])
      .then(([meta, season, history]) => setState({ status: 'ready', data: buildData(meta, season, history) }))
      .catch(e => setState({ status: 'error', message: (e as Error).message }));
  }, []);

  if (state.status === 'loading') return <div className="boot">Chargement du championnat…</div>;
  if (state.status === 'error')
    return (
      <div className="boot">
        <p>Données indisponibles.</p>
        <p className="muted small">{state.message}. Hors ligne, l'app réaffiche les dernières données dès qu'elles ont été chargées une fois.</p>
      </div>
    );
  return <Ctx.Provider value={state.data}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData hors de DataProvider');
  return d;
}
