/** Âge révolu à une date donnée (aujourd'hui par défaut), depuis une date de naissance AAAA-MM-JJ. */
export function ageOf(dob: string, now = new Date()): number {
  const [y, m, d] = dob.split('-').map(Number);
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}
