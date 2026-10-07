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
