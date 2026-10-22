import { useId, useState } from 'react';
import { clubByName } from '../lib/clubs.ts';

const SHIELD = 'M20 1.6 37.4 6.2v14.6c0 11.3-7.4 19.6-17.4 23.6C10 40.4 2.6 32.1 2.6 20.8V6.2z';

const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

// Logos qui n'ont pas pu se charger : on ne réessaie pas à chaque affichage.
const failed = new Set<string>();

/**
 * Logo officiel du club (public/logos, téléchargé par le script de données). S'il manque ou ne se charge pas,
 * on affiche l'écusson stylisé aux couleurs du club. Même encombrement dans les deux cas.
 */
export function Crest({ club, size = 24 }: { club: string; size?: number }) {
  const c = clubByName.get(club);
  const [ko, setKo] = useState(() => !c || failed.has(club));
  if (ko) return <StyledCrest club={club} size={size} />;
  return (
    <span className="crest crest-logo" style={{ width: size, height: Math.round(size * 1.15) }}>
      <img src={`${import.meta.env.BASE_URL}logos/${c!.sofascoreId}.png`} alt={club} width={size} height={size}
        loading="lazy" decoding="async" draggable={false} onError={() => { failed.add(club); setKo(true); }} />
    </span>
  );
}

/** Écusson stylisé aux couleurs du club (motif + sigle). Le sigle n'apparaît qu'à partir de 30 px. */
export function StyledCrest({ club, size = 24 }: { club: string; size?: number }) {
  const id = useId();
  const c = clubByName.get(club);
  const [a, b] = c?.colors ?? ['#8A94A8', '#D5DAE3'];
  const pattern = c?.pattern ?? 'split';
  const abbr = c?.abbr ?? club.slice(0, 3).toUpperCase();
  const fill = {
    split: <><rect width="20" height="46" fill={a} /><rect x="20" width="20" height="46" fill={b} /></>,
    band: <><rect width="40" height="46" fill={a} /><rect y="27" width="40" height="7" fill={b} /></>,
    diag: <><rect width="40" height="46" fill={a} /><path d="M40 6v14L0 46V32z" fill={b} /></>,
    chevron: <><rect width="40" height="46" fill={a} /><path d="M0 26l20 9 20-9v7l-20 9-20-9z" fill={b} /></>,
    stripes: <><rect width="40" height="46" fill={a} /><rect x="8" width="6" height="46" fill={b} /><rect x="26" width="6" height="46" fill={b} /></>,
  }[pattern];
  const light = pattern !== 'split' && lum(a) > 0.5;
  const fs = abbr.length <= 3 ? 12.5 : 10;
  return (
    <svg className="crest" width={size} height={Math.round(size * 1.15)} viewBox="0 0 40 46" role="img" aria-label={club}>
      <defs><clipPath id={id}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>{fill}</g>
      <path d={SHIELD} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.2" />
      {size >= 30 && (
        <text x="20" y={pattern === 'band' || pattern === 'chevron' ? 21 : 25} textAnchor="middle" fontWeight="800" fontSize={fs}
          style={{ fontStretch: '75%' }} fill={light ? '#141a16' : '#fff'}
          stroke={light ? undefined : 'rgba(0,0,0,.45)'} strokeWidth={light ? undefined : 2.2} paintOrder="stroke" strokeLinejoin="round">
          {abbr}
        </text>
      )}
    </svg>
  );
}
