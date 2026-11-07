export const COUNTRY_KEY = "nawabig-country";
export const COUNTRIES = ["السودان", "السعودية", "مصر", "الإمارات", "قطر", "عُمان", "الكويت", "البحرين", "ليبيا", "أخرى"];

export function countrySupportUrl(settings: string | null | undefined, country: string, message: string): string | null {
  if (!settings || !country) return null;
  try {
    const map = JSON.parse(settings);
    const entry = map?.[country];
    if (typeof entry !== "string") return null;
    const number = entry.startsWith("https://wa.me/") ? new URL(entry).pathname.slice(1) : entry.replace(/[\s+()-]/g, "");
    if (!/^\d{7,15}$/.test(number)) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  } catch { return null; }
}