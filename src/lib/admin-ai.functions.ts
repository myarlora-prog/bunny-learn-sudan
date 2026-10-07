import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "@/lib/gemini.server";

export type DraftFlashcard = { front: string; back: string };
export type DraftQuiz = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};
export type DraftLesson = {
  title: string;
  duration_minutes: number;
  explanation: string;
  key_points: string[];
  summary: string;
  key_terms: { term: string; meaning: string }[];
  review_material: string;
  flashcards: DraftFlashcard[];
  quiz: DraftQuiz[];
};
export type DraftUnit = { title: string; description: string; lessons: DraftLesson[] };
export type DraftContent = { units: DraftUnit[]; flags: string[] };

type Input = {
  text: string;
  subjectName: string;
  gradeName: string;
};

const SCHEMA = `{
  "units": [
    {
      "title": "string",
      "description": "string",
      "lessons": [
        {
          "title": "string",
          "duration_minutes": number,
          "explanation": "string (شرح مفصل بالعربية من الكتاب)",
          "key_points": ["string"],
          "summary": "string",
          "key_terms": [{"term": "string", "meaning": "string"}],
          "review_material": "string",
          "flashcards": [{"front": "string", "back": "string"}],
          "quiz": [{"question": "string", "options": ["أ","ب","ج","د"], "correct_index": 0, "explanation": "string"}]
        }
      ]
    }
  ],
  "flags": ["string (ملاحظة لكل جزء ناقص أو غير واضح في الكتاب)"]
}`;

export const processBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.text || input.text.trim().length < 50) {
      throw new Error("نص الكتاب قصير جدًا أو غير قابل للقراءة");
    }
    return {
      text: input.text.slice(0, 120000),
      subjectName: String(input.subjectName ?? "").slice(0, 120),
      gradeName: String(input.gradeName ?? "").slice(0, 120),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const system = [
      "أنت محلل مناهج دراسية سوداني. مصدرك الوحيد هو نص الكتاب المدرسي المرفق.",
      "استخرج الوحدات والدروس كما وردت في الكتاب بالترتيب نفسه ولا تخترع محتوى غير موجود.",
      "إذا كان جزء ناقصًا أو غير واضح أو غير مقروء، أضف ملاحظة في flags بدل تخمين المحتوى.",
      "لكل درس: شرح مبسّط بالعربية، نقاط مهمة، ملخص، مصطلحات، مادة مراجعة، بطاقات مراجعة، وأسئلة اختيار من متعدد بأربعة خيارات مع موضع الإجابة الصحيحة عشوائيًا وشرح للإجابة.",
      `أعد JSON فقط بهذا الشكل: ${SCHEMA}`,
    ].join("\n");

    const result = await aiComplete({
      json: true,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `المادة: ${data.subjectName}\nالصف: ${data.gradeName}\n\nنص الكتاب:\n${data.text}`,
        },
      ],
    });

    if (!result.ok) {
      if (result.status === 429) throw new Error("الخدمة مزدحمة الآن، حاول بعد قليل");
      if (result.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ");
      if (result.status === 400 || result.status === 401 || result.status === 403)
        throw new Error("مفتاح Gemini غير صالح، راجع إعدادات المفتاح");
      throw new Error("تعذّرت معالجة الكتاب، حاول مرة أخرى");
    }

    const raw = result.content || "{}";
    let parsed: DraftContent;
    try {
      parsed = JSON.parse(raw.replace(/^```json/i, "").replace(/```$/, "")) as DraftContent;
    } catch {
      throw new Error("تعذّر قراءة نتيجة المعالجة، أعد المحاولة");
    }

    const units = Array.isArray(parsed.units) ? parsed.units : [];
    const flags = Array.isArray(parsed.flags) ? parsed.flags : [];
    if (units.length === 0) flags.push("لم يتمكن الذكاء الاصطناعي من استخراج وحدات واضحة من هذا الملف.");

    return { units, flags } satisfies DraftContent;
  });
