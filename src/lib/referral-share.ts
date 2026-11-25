export type ReferralShareSettings = {
  message: string;
  url: string;
};

export const DEFAULT_REFERRAL_SHARE: ReferralShareSettings = {
  message: "انضم إلى نوابغ 🚀 تطبيقك للمذاكرة ومراجعة المناهج السودانية! استخدم كود الدعوة الخاص بي: {code}\nواستمتع برحلتك التعليمية مع نوابغ 📚\n\nرابط التطبيق: {link}",
  url: "https://bunny-learn-sudan.lovable.app",
};

export function cleanReferralShare(value: unknown): ReferralShareSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_REFERRAL_SHARE;
  const source = value as Record<string, unknown>;
  return {
    message: typeof source["message"] === "string" && source["message"].trim()
      ? source["message"].trim()
      : DEFAULT_REFERRAL_SHARE.message,
    url: typeof source["url"] === "string" && validAppUrl(source["url"])
      ? source["url"].trim()
      : DEFAULT_REFERRAL_SHARE.url,
  };
}

export function validAppUrl(value: string) {
  if (!value.trim() || value.length > 1000) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** A plain HTTPS URL in the shared text is automatically clickable in WhatsApp and other share targets. */
export function buildReferralMessage(settings: ReferralShareSettings, code: string) {
  let text = settings.message.trim();
  if (!text.includes("{code}")) text += `\n\nكود الدعوة: {code}`;
  if (!text.includes("{link}")) text += `\n\nرابط التطبيق: {link}`;
  return text.replaceAll("{code}", code).replaceAll("{link}", settings.url.trim());
}
