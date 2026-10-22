// Les 18 clubs de la saison 2026-27 : nom court affiché partout, sigle et couleurs de l'écusson stylisé.
export interface Club {
  name: string;
  full: string;
  abbr: string;
  colors: [string, string];
  pattern: 'band' | 'diag' | 'chevron' | 'split' | 'stripes';
  sofascoreId: number;
  /** Identifiant Wikidata (palmarès). */
  wikidata: string;
}

export const CLUBS: Club[] = [
  { name: 'PSG', wikidata: 'Q483020', full: 'Paris Saint-Germain', abbr: 'PSG', colors: ['#004170', '#DA291C'], pattern: 'band', sofascoreId: 1644 },
  { name: 'Lyon', wikidata: 'Q704', full: 'Olympique lyonnais', abbr: 'OL', colors: ['#1B3F8F', '#E30613'], pattern: 'diag', sofascoreId: 1649 },
  { name: 'Paris FC', wikidata: 'Q1051013', full: 'Paris FC', abbr: 'PFC', colors: ['#1A2B4C', '#8FB8DE'], pattern: 'chevron', sofascoreId: 6070 },
  { name: 'Lille', wikidata: 'Q19516', full: 'LOSC Lille', abbr: 'LOSC', colors: ['#E01E13', '#1D2C5E'], pattern: 'split', sofascoreId: 1643 },
  { name: 'Monaco', wikidata: 'Q180305', full: 'AS Monaco', abbr: 'ASM', colors: ['#E2001A', '#F2F2F2'], pattern: 'split', sofascoreId: 1653 },
  { name: 'Rennes', wikidata: 'Q19509', full: 'Stade rennais', abbr: 'SRFC', colors: ['#E13327', '#111111'], pattern: 'stripes', sofascoreId: 1658 },
  { name: 'Lorient', wikidata: 'Q48911', full: 'FC Lorient', abbr: 'FCL', colors: ['#F58220', '#111111'], pattern: 'stripes', sofascoreId: 1656 },
  { name: 'Lens', wikidata: 'Q191843', full: 'RC Lens', abbr: 'RCL', colors: ['#E2001A', '#FFD100'], pattern: 'band', sofascoreId: 1648 },
  { name: 'Marseille', wikidata: 'Q132885', full: 'Olympique de Marseille', abbr: 'OM', colors: ['#2FAEE0', '#F2F2F2'], pattern: 'chevron', sofascoreId: 1641 },
  { name: 'Brest', wikidata: 'Q218372', full: 'Stade brestois', abbr: 'SB29', colors: ['#E30613', '#F2F2F2'], pattern: 'diag', sofascoreId: 1715 },
  { name: 'Toulouse', wikidata: 'Q19518', full: 'Toulouse FC', abbr: 'TFC', colors: ['#5B2C83', '#F2F2F2'], pattern: 'band', sofascoreId: 1681 },
  { name: 'Auxerre', wikidata: 'Q182876', full: 'AJ Auxerre', abbr: 'AJA', colors: ['#0055A4', '#F2F2F2'], pattern: 'chevron', sofascoreId: 1646 },
  { name: 'Nice', wikidata: 'Q185163', full: 'OGC Nice', abbr: 'OGCN', colors: ['#C8102E', '#111111'], pattern: 'stripes', sofascoreId: 1661 },
  { name: 'Strasbourg', wikidata: 'Q126334', full: 'RC Strasbourg', abbr: 'RCSA', colors: ['#009FE3', '#F2F2F2'], pattern: 'diag', sofascoreId: 1659 },
  { name: 'Angers', wikidata: 'Q845137', full: 'Angers SCO', abbr: 'SCO', colors: ['#1A1A1A', '#F2F2F2'], pattern: 'stripes', sofascoreId: 1684 },
  { name: 'Le Mans', wikidata: 'Q210864', full: 'Le Mans FC', abbr: 'LMFC', colors: ['#C8102E', '#F7D117'], pattern: 'split', sofascoreId: 1672 },
  { name: 'Troyes', wikidata: 'Q501693', full: 'ESTAC Troyes', abbr: 'ESTAC', colors: ['#0057B8', '#F2F2F2'], pattern: 'chevron', sofascoreId: 1652 },
  { name: 'Le Havre', wikidata: 'Q328658', full: 'Le Havre AC', abbr: 'HAC', colors: ['#6CABDD', '#1D3C6E'], pattern: 'split', sofascoreId: 1662 },
];

export const CLUB_NAMES = CLUBS.map(c => c.name);
export const clubByName = new Map(CLUBS.map(c => [c.name, c]));
export const clubBySofascoreId = new Map(CLUBS.map(c => [c.sofascoreId, c]));

// Noms openfootball (y compris les clubs passés par la L1 depuis 2014) vers un nom court.
const OPENFOOTBALL: Record<string, string> = {
  'Paris Saint-Germain FC': 'PSG', 'Olympique Lyonnais': 'Lyon', 'Paris FC': 'Paris FC', 'Lille OSC': 'Lille',
  'AS Monaco FC': 'Monaco', 'Stade Rennais FC 1901': 'Rennes', 'FC Lorient': 'Lorient', 'Racing Club de Lens': 'Lens',
  'Olympique de Marseille': 'Marseille', 'Stade Brestois 29': 'Brest', 'Toulouse FC': 'Toulouse', 'AJ Auxerre': 'Auxerre',
  'OGC Nice': 'Nice', 'RC Strasbourg Alsace': 'Strasbourg', 'Angers SCO': 'Angers', 'Le Mans FC': 'Le Mans',
  'ES Troyes AC': 'Troyes', 'Le Havre AC': 'Le Havre',
  'Stade de Reims': 'Reims', 'FC Nantes': 'Nantes', 'Montpellier HSC': 'Montpellier', 'Montpellier Hérault SC': 'Montpellier',
  'AS Saint-Étienne': 'Saint-Étienne', 'FC Girondins de Bordeaux': 'Bordeaux', 'Girondins de Bordeaux': 'Bordeaux',
  'SC Bastia': 'Bastia', 'EA Guingamp': 'Guingamp', 'En Avant Guingamp': 'Guingamp', 'FC Metz': 'Metz', 'Dijon FCO': 'Dijon',
  'Nîmes Olympique': 'Nîmes', 'Amiens SC': 'Amiens', 'SM Caen': 'Caen', 'Stade Malherbe Caen': 'Caen',
  'Clermont Foot 63': 'Clermont', 'Clermont Foot': 'Clermont', 'AC Ajaccio': 'Ajaccio', 'GFC Ajaccio': 'GFC Ajaccio',
  'Gazélec Ajaccio': 'GFC Ajaccio', 'Évian Thonon Gaillard FC': 'Évian', 'Évian TG FC': 'Évian', 'FC Évian Thonon Gaillard': 'Évian',
  'AS Nancy Lorraine': 'Nancy', 'AS Nancy-Lorraine': 'Nancy', 'Valenciennes FC': 'Valenciennes', 'FC Sochaux-Montbéliard': 'Sochaux',
};

// Variantes rencontrées après nettoyage, selon les saisons.
const ALIASES: Record<string, string> = {
  'Olympique Marseille': 'Marseille', 'Paris Saint-Germain': 'PSG', 'Stade Rennais': 'Rennes', 'Olympique Lyonnais': 'Lyon',
  'Lille OSC': 'Lille', 'Girondins Bordeaux': 'Bordeaux', 'ESTAC Troyes': 'Troyes', 'Évian Thonon Gaillard': 'Évian',
  'Gazélec Ajaccio': 'GFC Ajaccio', 'Stade Brestois': 'Brest', 'Stade Brestois 29': 'Brest', 'Nîmes Olympique': 'Nîmes',
  'Stade de Reims': 'Reims', 'Le Havre AC': 'Le Havre', 'Racing Club de Lens': 'Lens', 'RC Strasbourg Alsace': 'Strasbourg',
};

export function clubFromOpenfootball(raw: string): string {
  const name = raw.trim();
  if (OPENFOOTBALL[name]) return OPENFOOTBALL[name];
  // Repli : on retire les sigles juridiques courants (« FC », « AS »…) pour garder un nom lisible.
  const clean = name.replace(/\b(FC|AS|SC|OGC|AJ|RC|ES|EA|SM|AC|HSC|FCO|SCO)\b/g, '').replace(/\s+/g, ' ').trim();
  return ALIASES[clean] ?? ALIASES[name] ?? clean;
}
