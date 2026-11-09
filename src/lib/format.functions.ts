import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "@/lib/gemini.server";

/** Owner-only: reformat one lesson explanation as textbook-style HTML without changing its content. */
export const formatLessonExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; text: string }) => {
    if (!input || typeof input.text !== "string" || input.text.trim().length < 5) throw new Error("لا يوجد شرح لتنسيقه");
    return { title: String(input.title ?? "").slice(0, 200), text: input.text.slice(0, 60000) };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const result = await aiComplete({
      messages: [
        {
          role: "system",
          content: [
            "أنت منسق كتب مدرسية عربية. مهمتك تنسيق الشرح المرفق فقط، وليس تأليفه أو تلخيصه.",
            "قواعد صارمة: لا تحذف أي جملة أو معلومة أو مثال أو قانون أو تعداد، ولا تختصر، ولا تغيّر المعنى، ولا تضف معلومات جديدة. احتفظ بنفس الكلمات قدر الإمكان.",
            "أعد HTML فقط دون ``` ودون وسوم html/body، واستخدم هذه الوسوم فقط:",
            "<h2> للعنوان الرئيسي، <h3> للعناوين الفرعية، <p> للفقرات، <ul>/<ol>/<li> للتعدادات، <strong> للكلمات المهمة،",
            '<div class="lesson-def"> للتعريفات والمعلومات المهمة، <div class="lesson-law"> للقوانين والقواعد، <div class="lesson-example"> للأمثلة.',
            "الإيموجي باعتدال شديد: إيموجي واحد مناسب بجانب العنوان الرئيسي أو عنوان كبير عند الحاجة فقط، ولا تضع إيموجي في الفقرات أو أمام النقاط.",
          ].join("\n"),
        },
        { role: "user", content: `عنوان الدرس: ${data.title}\n\nالشرح الأصلي:\n${data.text}` },
      ],
    });
    if (!result.ok) return { ok: false as const, html: "" };
    const html = result.content.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
    return { ok: html.length > 0, html };
  });
