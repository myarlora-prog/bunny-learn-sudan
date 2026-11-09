import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "@/lib/gemini.server";

type ExamInput = { subject: string; source: string; count: number };
export type ExamQuestion = { q: string; options: string[]; correct: number; hint: string };

export const generateSubjectExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExamInput) => {
    if (!input || typeof input.subject !== "string" || typeof input.source !== "string") throw new Error("بيانات غير صالحة");
    return {
      subject: input.subject.slice(0, 100),
      source: input.source.slice(0, 30000),
      count: Math.min(Math.max(Number(input.count) || 10, 5), 15),
    };
  })
  .handler(async ({ data }) => {
    const result = await aiComplete({
      json: true,
      messages: [
        {
          role: "system",
          content: [
            "أنت معد اختبارات للمنهج السوداني. أنشئ أسئلة اختيار من متعدد بالعربية اعتمادًا فقط على النص المرفق. لا تخترع معلومات خارج النص.",
            'أعد JSON فقط بهذا الشكل: {"questions": [{"q": "نص السؤال", "options": ["أ","ب","ج","د"], "correct": 0, "hint": "شرح قصير للإجابة"}]}',
            "كل سؤال له 4 خيارات بالضبط، وcorrect هو موضع الإجابة الصحيحة (0-3) ووزّعه عشوائيًا.",
          ].join("\n"),
        },
        { role: "user", content: `المادة: ${data.subject}\nعدد الأسئلة: ${data.count}\n\nالنص:\n${data.source}` },
      ],
    });
    if (!result.ok) return { ok: false as const, questions: [] as ExamQuestion[] };
    try {
      const args = JSON.parse(result.content.replace(/^```json/i, "").replace(/```$/, ""));
      const questions = (args.questions ?? []).filter(
        (q: ExamQuestion) => q?.q && Array.isArray(q.options) && q.options.length === 4 && q.correct >= 0 && q.correct < 4,
      ) as ExamQuestion[];
      return { ok: questions.length > 0, questions };
    } catch {
      return { ok: false as const, questions: [] as ExamQuestion[] };
    }
  });

type ChunkInput = { subject: string; chunk: string; count: number; part: number; parts: number; avoid: string[] };

/** Owner-only: generate questions for one chunk of a long source text. Client loops chunks sequentially. */
export const generateExamChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ChunkInput) => {
    if (!input || typeof input.chunk !== "string" || input.chunk.trim().length < 20) throw new Error("النص قصير جدًا");
    return {
      subject: String(input.subject ?? "").slice(0, 100),
      chunk: input.chunk.slice(0, 20000),
      count: Math.min(Math.max(Number(input.count) || 5, 1), 20),
      part: Number(input.part) || 1,
      parts: Number(input.parts) || 1,
      avoid: (Array.isArray(input.avoid) ? input.avoid : []).slice(-60).map((s) => String(s).slice(0, 200)),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const result = await aiComplete({
      json: true,
      messages: [
        {
          role: "system",
          content: [
            "أنت معد اختبارات للمنهج السوداني. اقرأ النص كاملًا واستخرج المفاهيم المهمة، ثم أنشئ أسئلة اختيار من متعدد بالعربية اعتمادًا فقط على النص.",
            "لا تخترع معلومات خارج النص. وزّع الأسئلة على جميع الدروس والوحدات في النص ولا تكرر أسئلة.",
            "نوّع الأسئلة: تعريفات، فهم، تطبيق، مقارنة، أمثلة؛ ونوّع المستويات بين السهل والمتوسط والصعب. أنشئ العدد المطلوب ما دام النص يكفي لأسئلة جيدة، وأقل منه إن لم يكف.",
            "إذا كان النص غير واضح أو ناقصًا فلا تخمّن؛ اكتب المشكلة في issues.",
            'أعد JSON فقط: {"questions": [{"q": "...", "options": ["","","",""], "correct": 0, "hint": "تفسير مختصر"}], "issues": ["..."]}',
            "لكل سؤال 4 خيارات بالضبط، وcorrect موضع الإجابة الصحيحة (0-3) موزعًا عشوائيًا.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `المادة: ${data.subject}\nالجزء ${data.part} من ${data.parts}\nعدد الأسئلة المطلوب: ${data.count}\n${
            data.avoid.length ? `لا تكرر هذه الأسئلة:\n- ${data.avoid.join("\n- ")}\n` : ""
          }\nالنص:\n${data.chunk}`,
        },
      ],
    });
    if (!result.ok) return { ok: false as const, questions: [] as ExamQuestion[], issues: ["تعذر الاتصال بالذكاء الاصطناعي"] };
    try {
      const args = JSON.parse(result.content.replace(/^```json/i, "").replace(/```$/, ""));
      const questions = (args.questions ?? []).filter(
        (q: ExamQuestion) => q?.q && Array.isArray(q.options) && q.options.length === 4 && q.correct >= 0 && q.correct < 4,
      ) as ExamQuestion[];
      const issues = (Array.isArray(args.issues) ? args.issues : []).map(String);
      return { ok: true as const, questions, issues };
    } catch {
      return { ok: false as const, questions: [] as ExamQuestion[], issues: ["رد غير صالح من الذكاء الاصطناعي"] };
    }
  });
