import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete, type AiResult } from "@/lib/gemini.server";

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
  /** Source parts used only for resumable generation; never published as lesson content. */
  source_text?: string;
  processing_stage?: "content" | "flashcards" | "quiz";
  processing_error?: string;
};
export type DraftUnit = { title: string; description: string; lessons: DraftLesson[] };
export type BookProcessing = {
  fileId: string | null;
  totalParts: number;
  completedParts: number;
  completedStages?: number;
  totalStages?: number;
  currentLesson?: string;
  currentStage?: "content" | "flashcards" | "quiz";
  state: "processing" | "failed" | "complete";
  lastError?: string;
};
export type DraftContent = { units: DraftUnit[]; flags: string[]; processing?: BookProcessing };

type BookInput = {
  text: string;
  subjectName: string;
  gradeName: string;
  part?: number;
  parts?: number;
  previousUnit?: string;
};

type LessonInput = BookInput & {
  unitTitle: string;
  lessonTitle: string;
  stage: "content" | "flashcards" | "quiz";
};

type OutlineUnit = { title: string; description: string; lessons: { title: string }[] };

const OUTLINE_SCHEMA = `{"units":[{"title":"string","description":"string","lessons":[{"title":"string"}]}],"flags":["string"]}`;

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

function failAi(result: Extract<AiResult, { ok: false }>, stage: string): never {
  const why = (result.error ?? "").slice(0, 300);
  if (result.status === 429) {
    if (/per.?day|daily|quota.*day|rpd/i.test(why)) throw new Error(`نفدت الحصة اليومية لمفاتيح Gemini؛ توقفت ${stage} دون إعادة محاولات يومية (${why})`);
    throw new Error(`تجاوز Gemini حد الطلبات في الدقيقة أثناء ${stage}؛ استكمل بعد قليل (${why})`);
  }
  if (result.status === 401 || result.status === 403) throw new Error(`مفتاح Gemini غير صالح أو لا يملك صلاحية أثناء ${stage} (${why})`);
  if (result.status === 402) throw new Error(`رفض مزود الخدمة الطلب لعدم كفاية الرصيد؛ لم تستخدم المعالجة أي خدمة مدفوعة (${why})`);
  if (result.status === 404) throw new Error(`موديل Gemini غير متاح لهذا المفتاح (${why})`);
  if (result.status === 200) throw new Error(`نتيجة ${stage} غير مكتملة: ${why}`);
  throw new Error(`تعذرت ${stage}: ${why || `HTTP ${result.status}`}`);
}

async function bookAi(messages: { role: "system" | "user"; content: string }[], stage: string) {
  const result = await aiComplete({ json: true, messages, allowedProviders: ["gemini"] });
  if (!result.ok) failAi(result, stage);
  return result.content;
}

async function assertOwner(context: { supabase: { from: (table: "user_roles") => unknown }; userId: string }) {
  const { supabase, userId } = context;
  const query = supabase.from("user_roles") as ReturnType<typeof import("@/integrations/supabase/client")["supabase"]["from"]>;
  const { data: role } = await query.select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!role) throw new Error("Forbidden");
}

/** Extract only the ordered structure. Lesson content is generated in separate resumable stages. */
export const processBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BookInput) => {
    if (!input?.text || input.text.trim().length < 50) throw new Error("نص الكتاب قصير جدًا أو غير قابل للقراءة");
    return {
      text: input.text.slice(0, 60000),
      subjectName: String(input.subjectName ?? "").slice(0, 120),
      gradeName: String(input.gradeName ?? "").slice(0, 120),
      part: Number(input.part) || 1,
      parts: Number(input.parts) || 1,
      previousUnit: String(input.previousUnit ?? "").slice(0, 200),
    };
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const system = [
      "أنت محلل مناهج سودانية. المصدر الوحيد هو نص الكتاب المرفق ولا يجوز إضافة معلومة خارجية.",
      "استخرج الوحدات والدروس فعلًا كما وردت وبالترتيب، مع عناوينها الأصلية، دون شرح أو بطاقات أو أسئلة في هذه المرحلة.",
      "إذا كان النص ناقصًا أو غير واضح فسجّل ذلك في flags ولا تخمّن.",
      data.parts > 1
        ? `هذا الجزء ${data.part} من ${data.parts}. إذا بدأ بتكملة وحدة سابقة${data.previousUnit ? ` بعنوان «${data.previousUnit}»` : ""} فاستخدم عنوان الوحدة نفسه حرفيًا، وأعد الدرس الممتد بعنوانه نفسه ليتم دمج مصدره دون تكرار.`
        : "",
      `أعد JSON فقط بهذا الشكل: ${OUTLINE_SCHEMA}`,
    ].join("\n");
    const raw = await bookAi([
      { role: "system", content: system },
      { role: "user", content: `المادة: ${data.subjectName}\nالصف: ${data.gradeName}\n\nنص الجزء:\n${data.text}` },
    ], `قراءة هيكل الجزء ${data.part}`);
    let parsed: { units?: OutlineUnit[]; flags?: string[] };
    try { parsed = parseJson(raw); } catch { throw new Error(`تعذر قراءة هيكل الجزء ${data.part}؛ لم يُحفظ كمكتمل`); }
    const units = (Array.isArray(parsed.units) ? parsed.units : []).flatMap((u) => {
      const title = String(u?.title ?? "").trim();
      if (!title) return [];
      return [{
        title,
        description: String(u?.description ?? ""),
        lessons: (Array.isArray(u?.lessons) ? u.lessons : []).flatMap((l) => {
          const lessonTitle = String(l?.title ?? "").trim();
          return lessonTitle ? [{ title: lessonTitle }] : [];
        }),
      }];
    });
    const flags = Array.isArray(parsed.flags) ? parsed.flags.map(String).filter(Boolean) : [];
    if (!units.length) flags.push(`الجزء ${data.part}: لم تُستخرج وحدات ودروس واضحة.`);
    return { units, flags };
  });

/** Generate one lesson stage at a time so successful stages can be saved immediately. */
export const generateBookLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LessonInput) => {
    if (!input?.text?.trim() || !input.lessonTitle?.trim() || !input.unitTitle?.trim()) throw new Error("بيانات الدرس أو مصدره غير مكتملة");
    if (!["content", "flashcards", "quiz"].includes(input.stage)) throw new Error("مرحلة غير صالحة");
    return {
      text: input.text.slice(0, 60000),
      subjectName: String(input.subjectName ?? "").slice(0, 120),
      gradeName: String(input.gradeName ?? "").slice(0, 120),
      unitTitle: input.unitTitle.trim().slice(0, 300),
      lessonTitle: input.lessonTitle.trim().slice(0, 300),
      stage: input.stage,
    };
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const source = `المادة: ${data.subjectName}\nالصف: ${data.gradeName}\nالوحدة: ${data.unitTitle}\nالدرس المطلوب فقط: ${data.lessonTitle}\n\nمصدر الكتاب:\n${data.text}`;
    const grounding = "التزم حرفيًا بمصدر الدرس المحدد، ولا تخترع تعريفات أو قوانين أو أمثلة أو معلومات خارجية. إن كان جزء غامضًا فاذكر أنه غير واضح بدل تخمينه. أعد JSON فقط دون Markdown.";

    if (data.stage === "content") {
      const schema = `{"explanation":"string","summary":"string","key_points":["string"],"key_terms":[{"term":"string","meaning":"string"}],"review_material":"string","duration_minutes":20}`;
      const raw = await bookAi([
        { role: "system", content: `${grounding}\nأنشئ شرحًا عربيًا تعليميًا شاملًا ومتدرجًا لكل موضوعات الدرس، بعناوين رئيسية وفرعية وفقرات قصيرة ونقاط وجداول Markdown عند الحاجة، مع إبراز المصطلحات والقوانين والأمثلة الموجودة في المصدر. لا تنسخ الدرس كفقرة طويلة ولا تحذف معلومة مهمة. ثم أنشئ ملخصًا شاملًا مستقلًا للمراجعة يغطي جميع الأجزاء والتعريفات والقوانين والتواريخ والأمثلة الأساسية.\nالشكل: ${schema}` },
        { role: "user", content: source },
      ], `شرح وملخص «${data.lessonTitle}»`);
      let value: { explanation?: string; summary?: string; key_points?: string[]; key_terms?: { term: string; meaning: string }[]; review_material?: string; duration_minutes?: number };
      try { value = parseJson(raw); } catch { throw new Error(`تعذر قراءة شرح وملخص «${data.lessonTitle}»`); }
      const content = {
        explanation: String(value.explanation ?? "").trim(),
        summary: String(value.summary ?? "").trim(),
        key_points: Array.isArray(value.key_points) ? value.key_points.map(String).map((s) => s.trim()).filter(Boolean) : [],
        key_terms: Array.isArray(value.key_terms) ? value.key_terms.flatMap((t) => t?.term?.trim() && t?.meaning?.trim() ? [{ term: t.term.trim(), meaning: t.meaning.trim() }] : []) : [],
        review_material: String(value.review_material ?? "").trim(),
        duration_minutes: Math.max(1, Math.round(Number(value.duration_minutes) || 20)),
      };
      if (!content.explanation || !content.summary || !content.key_points.length) throw new Error(`شرح أو ملخص «${data.lessonTitle}» ناقص؛ لم يُعتمد`);
      return { stage: "content" as const, content };
    }

    if (data.stage === "flashcards") {
      const raw = await bookAi([
        { role: "system", content: `${grounding}\nأنشئ بالضبط 15 بطاقة تعليمية مفيدة ومتنوعة تغطي جميع أجزاء الدرس. كل بطاقة تتناول مفهومًا أو هدفًا تعليميًا واحدًا؛ front سؤال عربي كامل وطبيعي وواضح وموجز دون حذف كلمات ضرورية، وback إجابة دقيقة سهلة ومختصرة بقدر ما يسمح المصدر دون فرض كلمة واحدة. إذا تضمنت الإجابة عناصر متعددة فاكتب كل عنصر في سطر مستقل داخل back بصيغة «1. ...» ثم «2. ...» ولا تدمجها في جملة غير مقروءة. افصل الحقائق المستقلة في بطاقات منفصلة، ولا تكرر السؤال أو المعلومة ولا تستخدم بطاقات شكلية لاستكمال العدد. إذا تعذر استخراج 15 بطاقة مفيدة فأعد أقل من 15 ليظهر النقص بدل اختراع محتوى.\nالشكل: {"flashcards":[{"front":"string","back":"string"}]}` },
        { role: "user", content: source },
      ], `بطاقات «${data.lessonTitle}»`);
      let value: { flashcards?: DraftFlashcard[] };
      try { value = parseJson(raw); } catch { throw new Error(`تعذر قراءة بطاقات «${data.lessonTitle}»`); }
      const flashcards = (Array.isArray(value.flashcards) ? value.flashcards : []).flatMap((f) => f?.front?.trim() && f?.back?.trim() ? [{ front: f.front.trim(), back: f.back.trim() }] : []);
      const unique = new Set(flashcards.map((f) => f.front.replace(/\s+/g, " ").toLocaleLowerCase("ar")));
      if (flashcards.length !== 15 || unique.size !== 15) throw new Error(`بطاقات «${data.lessonTitle}» غير مكتملة: وصل ${flashcards.length}، والفريد ${unique.size} من 15`);
      return { stage: "flashcards" as const, flashcards };
    }

    const raw = await bookAi([
      { role: "system", content: `${grounding}\nأنشئ بالضبط 15 سؤالًا تعليميًا غير مكرر يغطي كامل الدرس ومرقّمًا ضمن نص السؤال من 1 إلى 15. كل سؤال عربي كامل وواضح وموجز، والخيارات قصيرة ومقروءة ومتمايزة، وللسؤال إجابة صحيحة واحدة فقط بلا غموض أو التباس. نوّع بين اختيار من متعدد والصح والخطأ والتطبيق بما يناسب المصدر، ولا تختبر الحقيقة نفسها بصياغات مكررة. لكل سؤال خياران للصح والخطأ وأربعة لبقية الأنواع، correct_index صحيح يبدأ من صفر، وexplanation موجز يصحح الإجابة ويشرحها من المصدر. لا تخترع أسئلة لاستكمال العدد؛ أعد عددًا أقل إن لم يكفِ المصدر ليظهر النقص.\nالشكل: {"quiz":[{"question":"1. ...","options":["أ","ب","ج","د"],"correct_index":0,"explanation":"string"}]}` },
      { role: "user", content: source },
    ], `اختبار «${data.lessonTitle}»`);
    let value: { quiz?: DraftQuiz[] };
    try { value = parseJson(raw); } catch { throw new Error(`تعذر قراءة اختبار «${data.lessonTitle}»`); }
    const quiz = (Array.isArray(value.quiz) ? value.quiz : []).flatMap((q) => {
      const options = Array.isArray(q?.options) ? q.options.map(String).map((s) => s.trim()).filter(Boolean) : [];
      const correct = Number(q?.correct_index);
      return q?.question?.trim() && options.length >= 2 && options.length <= 4 && Number.isInteger(correct) && correct >= 0 && correct < options.length && q?.explanation?.trim()
        ? [{ question: q.question.trim(), options, correct_index: correct, explanation: q.explanation.trim() }]
        : [];
    });
    const unique = new Set(quiz.map((q) => q.question.replace(/^\s*\d+[.)\-]?\s*/, "").replace(/\s+/g, " ").toLocaleLowerCase("ar")));
    if (quiz.length !== 15 || unique.size !== 15) throw new Error(`اختبار «${data.lessonTitle}» غير مكتمل: وصل ${quiz.length}، والفريد ${unique.size} من 15`);
    return { stage: "quiz" as const, quiz };
  });
