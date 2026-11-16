export type SocialPlatform = "instagram" | "tiktok" | "facebook";
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
];

/** Accepts only HTTPS pages on the selected platform's own domain. */
export function validSocialUrl(platform: SocialPlatform, value: string) {
  const clean = value.trim();
  if (!clean) return true;
  if (clean.length > 500) return false;
  try {
    const url = new URL(clean);
    const domain = `${platform}.com`;
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && (url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function cleanSocialLinks(value: unknown): SocialLinks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: SocialLinks = {};
  for (const { id } of SOCIAL_PLATFORMS) {
    const url = source[id];
    if (typeof url === "string" && url.trim() && validSocialUrl(id, url)) result[id] = url.trim();
  }
  return result;
}
