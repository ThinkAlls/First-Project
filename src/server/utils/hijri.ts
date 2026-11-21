export interface HijriDateInfo {
  day: number;
  month: number;
  monthName: string;
  year: number;
  formatted: string;
}

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabiul Awal',
  'Rabiul Akhir',
  'Jumadil Awal',
  'Jumadil Akhir',
  'Rajab',
  'Syaban',
  'Ramadan',
  'Syawal',
  'Dzulkaidah',
  'Dzulhijjah',
];

export function getHijriMonthName(month: number): string {
  return HIJRI_MONTHS[(month - 1 + 12) % 12] || 'Muharram';
}

// Accurate Kuwaiti / Tabular Islamic Calendar conversion (Gregorian -> Hijri)
export function gregorianToHijri(dateInput: Date | string): HijriDateInfo {
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00Z`) : dateInput;
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();

  let m = month + 1;
  let y = year;
  if (m < 3) {
    y -= 1;
    m += 12;
  }

  let a = Math.floor(y / 100);
  let b = 2 - a + Math.floor(a / 4);
  if (y < 1583) b = 0;
  if (y === 1582) {
    if (m > 10) b = -10;
    if (m === 10) {
      b = 0;
      if (day > 4) b = -10;
    }
  }

  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524;

  b = 0;
  if (jd > 2299160) {
    a = Math.floor((jd - 1867216.25) / 36524.25);
    b = 1 + a - Math.floor(a / 4);
  }

  const bb = jd + b + 1524;
  let cc = Math.floor((bb - 122.1) / 365.25);
  const dd = Math.floor(365.25 * cc);
  const ee = Math.floor((bb - dd) / 30.6001);
  const iEpoch = 1948084;
  const shift1 = 8.01 / 60;

  let z = jd - iEpoch;
  const cyc = Math.floor(z / 10631);
  z = z - 10631 * cyc;
  const j = Math.floor((z - shift1) / 354.36667);
  const iYear = 30 * cyc + j;
  z = z - Math.floor(j * 354.36667 + shift1);
  let iMonth = Math.floor((z + 28.5001) / 29.5);
  if (iMonth === 13) iMonth = 12;
  const iDay = Math.max(1, Math.floor(z - Math.floor(29.5001 * iMonth - 29)));

  const monthName = getHijriMonthName(iMonth);
  void cc;
  void ee;

  return {
    day: iDay,
    month: iMonth,
    monthName,
    year: iYear,
    formatted: `${iDay} ${monthName} ${iYear} H`,
  };
}

export function hijriToGregorian(hDay: number, hMonth: number, hYear: number): string {
  const jd =
    Math.floor((11 * hYear + 3) / 30) +
    354 * hYear +
    30 * hMonth -
    Math.floor((hMonth - 1) / 2) +
    hDay +
    1948440 -
    385;

  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
