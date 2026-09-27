const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** 1234 → "1.23K", 5.6e15 → "5.60Qa", beyond suffixes → "aa", "ab"… */
export function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n, decimals);
  if (n < 1000) {
    if (n < 10 && n % 1 !== 0) return n.toFixed(1);
    return Math.floor(n).toString();
  }
  const tier = Math.floor(Math.log10(n) / 3);
  const scaled = n / 10 ** (tier * 3);
  let suffix: string;
  if (tier < SUFFIXES.length) suffix = SUFFIXES[tier];
  else {
    const i = tier - SUFFIXES.length;
    suffix = String.fromCharCode(97 + Math.floor(i / 26) % 26) + String.fromCharCode(97 + (i % 26));
  }
  const d = scaled >= 100 ? Math.max(0, decimals - 2) : scaled >= 10 ? Math.max(0, decimals - 1) : decimals;
  return scaled.toFixed(d) + suffix;
}

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
