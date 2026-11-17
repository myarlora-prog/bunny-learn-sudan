export const COUNTRY_KEY = "nawabig-country";
export const COUNTRIES = ["السودان", "السعودية", "مصر", "الإمارات", "قطر", "عُمان", "الكويت", "البحرين", "ليبيا", "أخرى"];

const CALLING_CODES: [string, string][] = [
  ["249", "السودان"], ["966", "السعودية"], ["20", "مصر"], ["971", "الإمارات"],
  ["974", "قطر"], ["968", "عُمان"], ["965", "الكويت"], ["973", "البحرين"], ["218", "ليبيا"],
];

export function countrySupportUrl(settings: string | null | undefined, country: string, message: string): string | null {
  if (!settings || !country) return null;
  try {
    const parsed = JSON.parse(settings) as unknown;
    let entry: unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      entry = (parsed as Record<string, unknown>)[country];
    } else if ((typeof parsed === "number" && Number.isSafeInteger(parsed)) || (typeof parsed === "string" && /^\d{7,15}$/.test(parsed))) {
      // Backward compatibility for the owner's original single-number setting.
      const number = String(parsed);
      if (CALLING_CODES.find(([code, name]) => name === country && number.startsWith(code))) entry = number;
    }
    if (typeof entry !== "string" && typeof entry !== "number") return null;
    const raw = String(entry);
    const number = raw.startsWith("https://wa.me/") ? new URL(raw).pathname.slice(1) : raw.replace(/[\s+()-]/g, "");
    if (!/^\d{7,15}$/.test(number)) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  } catch { return null; }
}
