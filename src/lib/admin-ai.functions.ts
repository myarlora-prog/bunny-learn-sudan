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
  /** Part index (1-based) and total, when a long book is processed in parts. */
  part?: number;
  parts?: number;
  /** Title of the last unit from the previous part, so continuing lessons stay in it. */
  previousUnit?: string;
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
      part: Number(input.part) || 1,
      parts: Number(input.parts) || 1,
      previousUnit: String(input.previousUnit ?? "").slice(0, 200),
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
      "لا تضع حدًا أقصى لعدد البطاقات أو الأسئلة: غطِّ كل مفهوم وتفصيل مهم في الدرس. عادةً من 15 إلى 30 بطاقة ومن 8 إلى 15 سؤالًا لكل درس حسب طوله وغناه، وكلما كان الدرس أطول زاد العدد.",
      data.parts > 1
        ? `هذا الجزء ${data.part} من ${data.parts} من الكتاب. استخرج فقط الدروس الموجودة في هذا الجزء. إذا بدأ الجزء بتكملة درس أو وحدة سابقة${data.previousUnit ? ` (آخر وحدة: «${data.previousUnit}»)` : ""} فاستخدم عنوان الوحدة نفسه حرفيًا.`
        : "",
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
      const why = (result.error ?? "").slice(0, 220);
      if (result.status === 429)
        throw new Error(/per.?day|daily|PerDay/i.test(why) ? `نفدت الحصة اليومية لمفاتيح Gemini (${why})` : `تم تجاوز حد الطلبات مؤقتًا، أعد المحاولة بعد دقيقة (${why})`);
      if (result.status === 402) throw new Error(`رصيد الخدمة غير كافٍ (${why})`);
      if (result.status === 401 || result.status === 403) throw new Error(`مفتاح الذكاء الاصطناعي غير صالح (${why})`);
      throw new Error(`تعذّرت معالجة الجزء ${data.part}: ${why || result.status}`);
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
