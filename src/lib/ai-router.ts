/**
 * Pure AI key routing and error classification (no I/O). The server helper in
 * gemini.server.ts supplies the network call and persistence.
 * Policy: keys run by priority; a daily-quota (RPD) failure puts every key of the
 * same provider project on cooldown so they are not used to bypass the limit;
 * a key on cooldown is skipped without any network request.
 */

export type ErrorKind =
  | "quota_daily" | "rate_limit" | "invalid_key" | "model_unavailable" | "credits"
  | "network" | "timeout" | "server" | "truncated" | "empty" | "bad_request" | "no_keys";

export type Classified = { kind: ErrorKind; quota?: "RPD" | "RPM" | "TPM" | "billing" | undefined; retryAfterSec?: number | undefined; message: string };

export type RawResult =
  | { ok: true; content: string }
  | { ok: false; status: number; body: string; local?: "network" | "timeout" | "truncated" | "empty" };

export type KeyRow = { id: string; label: string; provider: string; model: string; api_key: string; project_label: string; cooldown_until: string | null };

export type Attempt = { keyId: string; keyLabel: string; provider: string; kind: ErrorKind | "ok" | "skipped_cooldown" | "skipped_same_project"; status: number; message: string };

export type RouteResult =
  | { ok: true; content: string; keyLabel: string; attempts: Attempt[] }
  | { ok: false; status: number; kind: ErrorKind; error: string; retryAt?: string | undefined; attempts: Attempt[] };

export const KIND_AR: Record<ErrorKind, string> = {
  quota_daily: "نفدت الحصة اليومية لمشروع المفتاح",
  rate_limit: "تجاوز حد الطلبات أو الرموز في الدقيقة",
  invalid_key: "المفتاح غير صالح أو لا يملك صلاحية",
  model_unavailable: "الموديل غير متاح لهذا المفتاح",
  credits: "لا يوجد رصيد كافٍ لدى مزوّد الخدمة",
  network: "تعذر الاتصال بمزوّد الخدمة",
  timeout: "انتهت مهلة الطلب",
  server: "خطأ مؤقت لدى مزوّد الخدمة",
  truncated: "الرد مقطوع لأنه تجاوز حد الطول",
  empty: "رد فارغ من الذكاء الاصطناعي",
  bad_request: "طلب مرفوض من مزوّد الخدمة",
  no_keys: "لا توجد مفاتيح AI مفعّلة",
};

/** Errors that will fail again immediately: stop the whole job instead of retrying. */
export const BLOCKING: ErrorKind[] = ["quota_daily", "rate_limit", "invalid_key", "model_unavailable", "credits", "no_keys", "bad_request"];

const seconds = (s: unknown) => { const m = /^(\d+(?:\.\d+)?)s$/.exec(String(s ?? "")); return m ? Math.ceil(Number(m[1])) : undefined; };

/** Classify a provider failure from its real HTTP status and body. */
export function classify(provider: string, r: Extract<RawResult, { ok: false }>): Classified {
  if (r.local) return { kind: r.local, message: KIND_AR[r.local] };
  const { status, body } = r;
  let j: { error?: { message?: string; status?: string; code?: string | number; type?: string; details?: { "@type"?: string; violations?: { quotaId?: string; quotaValue?: string }[]; retryDelay?: string; reason?: string }[] }; type?: string; message?: string; props?: { requires?: string } } = {};
  try { j = JSON.parse(body); } catch { /* plain text body */ }
  const msg = (j.error?.message ?? j.message ?? body ?? "").toString().replace(/\s+/g, " ").slice(0, 240);
  const details = j.error?.details ?? [];
  const retryAfterSec = seconds(details.find((d) => d.retryDelay)?.retryDelay);
  if (status === 429) {
    const ids = details.flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? "");
    const quota = ids.some((q) => /PerDay/i.test(q)) ? "RPD" : ids.some((q) => /Token.*PerMinute/i.test(q)) ? "TPM" : ids.some((q) => /PerMinute/i.test(q)) ? "RPM" : /insufficient_quota|billing/i.test(body) ? "billing" : undefined;
    const limit = details.flatMap((d) => d.violations ?? []).find((v) => v.quotaValue)?.quotaValue;
    const free = ids.some((q) => /FreeTier/i.test(q)) ? " (الخطة المجانية)" : "";
    if (quota === "RPD" || quota === "billing") return { kind: "quota_daily", quota, retryAfterSec, message: `${provider}: نفدت الحصة اليومية${free}${limit ? `، الحد ${limit} طلبًا يوميًا لكل مشروع` : ""}` };
    return { kind: "rate_limit", quota, retryAfterSec, message: `${provider}: تجاوز حد ${quota ?? "الطلبات"} في الدقيقة${free}${limit ? `، الحد ${limit}` : ""}` };
  }
  if (status === 402) return { kind: "credits", message: `${provider}: ${j.type === "payment_required" || j.props?.requires === "top_up" ? "رصيد غير كافٍ (402 payment_required)" : `402 ${msg}`}` };
  const invalid = /API_KEY_INVALID|API key not valid|invalid.api.key|Incorrect API key|PERMISSION_DENIED|unauthorized/i.test(body);
  if (status === 401 || status === 403 || (status === 400 && invalid)) return { kind: "invalid_key", message: `${provider}: ${status} ${msg}` };
  if (status === 404) return { kind: "model_unavailable", message: `${provider}: ${msg || "الموديل غير موجود"}` };
  if (status === 408) return { kind: "timeout", message: KIND_AR.timeout };
  if (status >= 500) return { kind: "server", message: `${provider}: ${status} ${msg}` };
  return { kind: "bad_request", message: `${provider}: ${status} ${msg}` };
}

export const projectGroup = (k: Pick<KeyRow, "id" | "provider" | "project_label">) => `${k.provider}:${k.project_label.trim().toLowerCase() || `key:${k.id}`}`;

export type RouterDeps = {
  call: (k: KeyRow) => Promise<RawResult>;
  update: (ids: string[], patch: { last_status: string; last_kind: string; last_error: string | null; cooldown_until: string | null }) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** Try keys in order with project-aware fallback. Never retries a daily-quota failure. */
export async function routeKeys(keys: KeyRow[], deps: RouterDeps): Promise<RouteResult> {
  const now = deps.now ?? Date.now, sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const attempts: Attempt[] = [];
  if (!keys.length) return { ok: false, status: 503, kind: "no_keys", error: KIND_AR.no_keys, attempts };
  const blockedGroups = new Set<string>();
  let last: Classified | null = null, lastStatus = 503, earliest: number | null = null;
  const note = (t: number) => { earliest = earliest === null ? t : Math.min(earliest, t); };
  for (const k of keys.slice(0, 8)) {
    const g = projectGroup(k), keyLabel = k.label || k.provider;
    if (blockedGroups.has(g)) { attempts.push({ keyId: k.id, keyLabel, provider: k.provider, kind: "skipped_same_project", status: 0, message: "تخطي: نفس مشروع مفتاح نفدت حصته" }); continue; }
    const until = k.cooldown_until ? Date.parse(k.cooldown_until) : 0;
    if (until > now()) { note(until); attempts.push({ keyId: k.id, keyLabel, provider: k.provider, kind: "skipped_cooldown", status: 0, message: `تخطي دون طلب: الحصة متوقفة حتى ${new Date(until).toISOString()}` }); last ??= { kind: "quota_daily", message: `${k.provider}: الحصة متوقفة مؤقتًا` }; lastStatus = 429; continue; }
    let waited = false;
    for (;;) {
      let r: RawResult;
      try { r = await deps.call(k); } catch (e) { r = { ok: false, status: 0, body: "", local: e instanceof Error && /timeout|abort/i.test(e.name + e.message) ? "timeout" : "network" }; }
      if (r.ok) {
        await deps.update([k.id], { last_status: "ok", last_kind: "ok", last_error: null, cooldown_until: null });
        attempts.push({ keyId: k.id, keyLabel, provider: k.provider, kind: "ok", status: 200, message: "" });
        return { ok: true, content: r.content, keyLabel, attempts };
      }
      const c = classify(k.provider, r);
      if (c.kind === "rate_limit" && !waited && (c.retryAfterSec ?? 10) <= 20) { waited = true; await sleep((c.retryAfterSec ?? 10) * 1000); continue; }
      last = c; lastStatus = r.status;
      attempts.push({ keyId: k.id, keyLabel, provider: k.provider, kind: c.kind, status: r.status, message: c.message });
      let cooldown: string | null = null, ids = [k.id];
      if (c.kind === "quota_daily" || c.kind === "rate_limit") {
        const t = now() + (c.retryAfterSec ?? (c.kind === "quota_daily" ? 3600 : 60)) * 1000;
        cooldown = new Date(t).toISOString(); note(t);
        blockedGroups.add(g);
        if (c.kind === "quota_daily") ids = keys.filter((x) => projectGroup(x) === g).map((x) => x.id);
      }
      await deps.update(ids, { last_status: `error ${r.status}`, last_kind: c.kind, last_error: c.message, cooldown_until: cooldown });
      break;
    }
    // Content-size problems repeat on every key: stop instead of burning backup quota.
    if (last && (last.kind === "truncated" || last.kind === "empty" || last.kind === "bad_request")) break;
  }
  const failed = attempts.filter((a) => a.kind !== "ok").map((a) => `${a.keyLabel}: ${a.message}`).join(" | ");
  const kind = last?.kind ?? "no_keys";
  return { ok: false, status: lastStatus, kind, error: `${KIND_AR[kind]} — ${failed}`, retryAt: earliest ? new Date(earliest).toISOString() : undefined, attempts };
}
