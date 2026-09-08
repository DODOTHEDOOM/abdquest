// Gregorian -> Hijri conversion, extracted verbatim from legacy/AbdQuest.html.
// This is a tabular arithmetic conversion and can be a day off around month
// boundaries; that matches the legacy app's behaviour and is not changed here.

const HIJRI_MONTHS = [
  "Muharram",
  "Safar",
  "Rabi' I",
  "Rabi' II",
  "Jumada I",
  "Jumada II",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qi'dah",
  "Dhu al-Hijjah",
];

export function toHijri(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const jd = Math.floor((14 - m) / 12);
  const ya = y + 4800 - jd;
  const ma = m + 12 * jd - 3;
  const J =
    d +
    Math.floor((153 * ma + 2) / 5) +
    365 * ya +
    Math.floor(ya / 4) -
    Math.floor(ya / 100) +
    Math.floor(ya / 400) -
    32045;
  let l = J - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const hm = Math.floor((24 * l) / 709);
  const hd = l - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;
  return hd + " " + HIJRI_MONTHS[hm - 1] + " " + hy + " AH";
}
