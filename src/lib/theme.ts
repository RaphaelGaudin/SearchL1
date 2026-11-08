// Thème d'affichage : automatique (réglage de l'iPhone), clair ou sombre. Gardé sur le téléphone.
import { useEffect } from 'react';
import { usePref } from './prefs.ts';

export type Theme = 'auto' | 'light' | 'dark';
const BAR = { light: '#ECEFEA', dark: '#0E1411' };

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = usePref<Theme>('theme', 'auto');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
    // Couleur de la barre d'état : celle du thème forcé, sinon celle qui suit le réglage de l'iPhone.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
      const own = m.media.includes('dark') ? BAR.dark : BAR.light;
      m.content = theme === 'auto' ? own : BAR[theme];
    });
  }, [theme]);
  return [theme, setTheme];
}
