/**
 * Hijri (Umm al-Qura) calendar display helpers. No date library dependency —
 * `Intl.DateTimeFormat` supports the `islamic-umalqura` calendar natively in
 * every evergreen browser, and Umm al-Qura is the Saudi civil calendar (more
 * correct here than most npm Hijri packages, which implement tabular Hijri
 * and can drift a day). The stored/transmitted value can still stay
 * Gregorian ISO `YYYY-MM-DD` where the API expects it.
 */

export interface HijriParts {
  year: number;
  month: number; // 1-12
  day: number;
}

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qidah',
  'Dhu al-Hijjah',
];

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

let hijriSupported: boolean | null = null;

/** Feature-detects `islamic-umalqura` support once and caches the result. */
export function isHijriSupported(): boolean {
  if (hijriSupported !== null) return hijriSupported;
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' });
    hijriSupported = fmt.resolvedOptions().calendar === 'islamic-umalqura';
  } catch {
    hijriSupported = false;
  }
  return hijriSupported;
}

/** Returns null when the runtime lacks Umm al-Qura support — callers should fall back to Gregorian. */
export function toHijriParts(date: Date): HijriParts | null {
  if (!isHijriSupported() || Number.isNaN(date.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/**
 * Machine-readable Hijri date string `"YYYY/MM/DD"` (zero-padded) for API
 * payloads that store the Hijri value verbatim alongside the Gregorian one
 * (e.g. `Customer.birthDateHijri`). Null when Umm al-Qura support or the
 * input date is unavailable — callers should omit the field in that case.
 */
export function toHijriIsoString(date: Date): string | null {
  const parts = toHijriParts(date);
  if (!parts) return null;
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}/${mm}/${dd}`;
}

export function getHijriMonthName(month: number, lang: 'ar' | 'en'): string {
  const monthName = lang === 'ar' ? HIJRI_MONTHS_AR[month - 1] : HIJRI_MONTHS_EN[month - 1];
  return monthName ?? String(month);
}

function formatIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts a Hijri (Umm al-Qura) day back to the Gregorian ISO date the API
 * already accepts. Intl only formats Gregorian -> Hijri, so this performs a
 * bounded lookup around the expected Gregorian year.
 */
export function hijriToGregorianIso(parts: HijriParts): string | null {
  if (!isHijriSupported()) return null;

  const { year, month, day } = parts;
  if (!year || month < 1 || month > 12 || day < 1 || day > 30) return null;

  const center = new Date(year + 579, month - 1, day, 12, 0, 0, 0);
  for (let offset = -370; offset <= 370; offset += 1) {
    const candidate = new Date(center);
    candidate.setDate(center.getDate() + offset);
    const candidateParts = toHijriParts(candidate);
    if (
      candidateParts?.year === year &&
      candidateParts.month === month &&
      candidateParts.day === day
    ) {
      return formatIsoDate(candidate);
    }
  }

  return null;
}

export function getHijriMonthLength(year: number, month: number): number {
  return hijriToGregorianIso({ year, month, day: 30 }) ? 30 : 29;
}

/** e.g. "١٢ جمادى الأولى ١٤٤٦ هـ" (ar) / "12 Jumada al-Awwal 1446 AH" (en). Falls back to a Gregorian string if unsupported. */
export function formatHijri(date: Date, lang: 'ar' | 'en'): string {
  const parts = toHijriParts(date);
  if (!parts) {
    return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');
  }
  const monthName = getHijriMonthName(parts.month, lang);
  if (lang === 'ar') {
    return `${toArabicDigits(parts.day)} ${monthName} ${toArabicDigits(parts.year)} هـ`;
  }
  return `${parts.day} ${monthName} ${parts.year} AH`;
}
