import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "@/lib/gemini.server";

type In = { title: string; text: string; part?: number; parts?: number };
const validate = (input: In) => {
  if (!input || typeof input.text !== "string" || input.text.trim().length < 2) throw new Error("لا يوجد محتوى لتنسيقه");
  return { title: String(input.title ?? "").slice(0, 200), text: input.text.slice(0, 12000), part: Number(input.part) || 1, parts: Number(input.parts) || 1 };
};
const EXPLAIN = [
  "أنت منسق كتب مدرسية عربية. مهمتك تنسيق النص المرفق فقط، وليس تأليفه أو تلخيصه.",
  "قواعد صارمة: نسّق النص كله من أول جملة إلى آخر جملة. لا تحذف أي جملة أو معلومة أو مثال أو قانون أو تعداد، ولا تختصر، ولا تغيّر المعنى، ولا تضف معلومات. احتفظ بنفس الكلمات وبنفس الترتيب.",
  "أعد HTML فقط دون ``` ودون وسوم html/body، واستخدم: <h2> <h3> <p> <ul> <ol> <li> <strong> <table> <thead> <tbody> <tr> <th> <td>،",
  '<div class="lesson-def"> للتعريفات، <div class="lesson-law"> للقوانين، <div class="lesson-example"> للأمثلة. الإيموجي باعتدال شديد بجانب العناوين فقط.',
].join("\n");
const SUMMARY = [
  "أنت منسق ملخصات دراسية عربية. مهمتك تنسيق الملخص المرفق بصريًا فقط.",
  "قواعد صارمة: نسّق جميع النقاط والفقرات من البداية إلى النهاية بنفس الترتيب. لا تضف ولا تحذف ولا تدمج أي نقطة ولا تغيّر أي معلومة؛ حافظ على الكلمات الأصلية.",
  "أعد HTML فقط دون ``` ودون وسوم html/body، واستخدم: <h3> <h4> <p> <ul> <ol> <li> <strong> <mark> <table> <thead> <tbody> <tr> <th> <td>،",
  '<div class="lesson-def"> للتعريفات، <div class="lesson-law"> للقوانين. لا تستخدم style، ولا إيموجي إلا واحدًا بجانب عنوان رئيسي.',
].join("\n");

async function run(system: string, label: string, d: ReturnType<typeof validate>) {
  const result = await aiComplete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: `عنوان الدرس: ${d.title}\nهذا الجزء ${d.part} من ${d.parts}${d.parts > 1 ? " (نسّق هذا الجزء وحده كاملًا، دون مقدمة أو خاتمة)" : ""}\n\n${label}:\n${d.text}` },
    ],
  });
  if (!result.ok) return { ok: false as const, html: "", error: result.error ?? `خطأ ${result.status}` };
  const html = result.content.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
  return html ? { ok: true as const, html, error: "" } : { ok: false as const, html: "", error: "رد فارغ" };
}

/** Owner-only: format one part of a lesson explanation. Client splits long text into ordered parts. */
export const formatLessonExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");
    return run(EXPLAIN, "النص الأصلي", data);
  });

/** Owner-only: format one part of a lesson summary. */
export const formatLessonSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");
    return run(SUMMARY, "الملخص الأصلي", data);
  });
