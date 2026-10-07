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
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]!}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "أنت معد اختبارات للمنهج السوداني. أنشئ أسئلة اختيار من متعدد بالعربية اعتمادًا فقط على النص المرفق. لا تخترع معلومات خارج النص.",
          },
          { role: "user", content: `المادة: ${data.subject}\nعدد الأسئلة: ${data.count}\n\nالنص:\n${data.source}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "exam",
              description: "Subject exam",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        q: { type: "string" },
                        options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                        correct: { type: "integer", minimum: 0, maximum: 3 },
                        hint: { type: "string", description: "شرح قصير للإجابة" },
                      },
                      required: ["q", "options", "correct", "hint"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "exam" } },
      }),
    });
    if (!res.ok) return { ok: false as const, questions: [] as ExamQuestion[] };
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    try {
      const args = JSON.parse(json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
      const questions = (args.questions ?? []).filter(
        (q: ExamQuestion) => q?.q && Array.isArray(q.options) && q.options.length === 4 && q.correct >= 0 && q.correct < 4,
      ) as ExamQuestion[];
      return { ok: questions.length > 0, questions };
    } catch {
      return { ok: false as const, questions: [] as ExamQuestion[] };
    }
  });
