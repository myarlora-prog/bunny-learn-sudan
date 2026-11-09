import DOMPurify from "dompurify";

export const looksLikeHtml = (s: string) => /<\/?(p|br|b|strong|i|em|u|h[2-4]|ul|ol|li|span|font|div|blockquote|hr|mark)\b/i.test(s);

/** Browser-only whitelist sanitizer for owner-authored lesson explanations. */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "u", "h2", "h3", "h4", "ul", "ol", "li", "span", "div", "blockquote", "hr", "mark"],
    ALLOWED_ATTR: ["style", "class"],
  });
}

export function explanationHtml(text: string): string {
  if (looksLikeHtml(text)) return sanitizeHtml(text);
  return text.split(/\n+/).filter(Boolean).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("");
}
