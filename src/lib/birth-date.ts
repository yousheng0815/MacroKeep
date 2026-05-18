const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` in the Gregorian calendar; rejects impossible calendar dates. */
export function isValidIsoBirthDate(s: string): boolean {
  const m = s.trim().match(ISO_RE);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Completed calendar years since `birthDate` (local timezone), at least 1. */
export function ageYearsFromIsoBirthDate(iso: string, ref = new Date()): number {
  const s = iso.trim();
  if (!isValidIsoBirthDate(s)) return 30;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  let age = ref.getFullYear() - y;
  if (ref.getMonth() < mo - 1 || (ref.getMonth() === mo - 1 && ref.getDate() < d)) {
    age--;
  }
  return Math.max(1, age);
}
