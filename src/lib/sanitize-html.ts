const ALLOWED = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "H2", "H3", "H4", "UL", "OL", "LI", "SPAN", "FONT", "DIV", "BLOCKQUOTE", "HR", "MARK"]);

export const looksLikeHtml = (s: string) => /<\/?(p|br|b|strong|i|em|u|h[2-4]|ul|ol|li|span|font|div|blockquote|hr|mark)\b/i.test(s);

/** Browser-only whitelist sanitizer for owner-authored lesson explanations. */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      const color = (child as HTMLElement).style?.color || child.getAttribute("color") || "";
      const bg = (child as HTMLElement).style?.backgroundColor || "";
      for (const a of Array.from(child.attributes)) child.removeAttribute(a.name);
      const styles = [color && `color:${color}`, bg && `background-color:${bg}`].filter(Boolean).join(";");
      if (styles && /^[#a-z0-9(),.%\s:;-]+$/i.test(styles)) child.setAttribute("style", styles);
      walk(child);
    }
  };
  const root = doc.body.firstElementChild!;
  walk(root);
  return root.innerHTML;
}
