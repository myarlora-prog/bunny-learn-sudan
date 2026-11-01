import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatInput = {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
};

export const askSaqro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ChatInput) => {
    if (!input || typeof input.message !== "string" || !input.message.trim()) {
      throw new Error("سؤال غير صالح");
    }
    return {
      message: input.message.slice(0, 2000),
      history: Array.isArray(input.history) ? input.history.slice(-10) : [],
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, stage_id, grade_id")
      .eq("id", userId)
      .maybeSingle();

    let curriculum = "";
    if (profile?.grade_id) {
      const [{ data: grade }, { data: subjects }] = await Promise.all([
        supabase.from("grades").select("name").eq("id", profile.grade_id).maybeSingle(),
        supabase.from("subjects").select("name").eq("grade_id", profile.grade_id).order("sort_order"),
      ]);
      curriculum = `الصف الدراسي للطالب: ${grade?.name ?? "غير محدد"}. المواد المتاحة: ${(subjects ?? [])
        .map((s) => s.name)
        .join("، ")}.`;
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    const isSuper = !!sub;

    const system = [
      "أنت «سَقرو»، مساعد دراسي ذكي للمنهج السوداني. تتحدث العربية الفصحى المبسّطة فقط.",
      "اعتمد على المنهج الدراسي للطالب كمصدر أساسي. إذا لم تكن المعلومة موجودة في المنهج أو لست متأكدًا، قل ذلك صراحة ولا تخترع إجابة.",
      "اجعل الشرح قصيرًا ومنظمًا بنقاط، مع مثال واحد عند الحاجة.",
      curriculum,
      isSuper
        ? "هذا الطالب مشترك في سَقرو سوبر: قدّم شرحًا أعمق، وأسئلة تدريب إضافية وأصعب عند الطلب، وحلّل نقاط ضعفه."
        : "هذا الطالب في الخطة المجانية: قدّم إجابة مركزة ومختصرة.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          ...data.history,
          { role: "user", content: data.message },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { ok: false as const, reply: "الخدمة مزدحمة الآن، حاول بعد قليل." };
      if (res.status === 402) return { ok: false as const, reply: "رصيد الذكاء الاصطناعي غير كافٍ حاليًا." };
      return { ok: false as const, reply: "تعذّر الوصول إلى سَقرو الآن، حاول مرة أخرى." };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() || "لم أتمكن من صياغة إجابة، أعد صياغة سؤالك.";

    await supabase.rpc("log_ai_message", { _role: "user", _content: data.message });
    await supabase.rpc("log_ai_message", { _role: "assistant", _content: reply });

    return { ok: true as const, reply, isSuper };
  });
