import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";

export function StudentFeedback() {
  const { session } = useApp();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const clean = content.trim();
    if (!clean) {
      setError("اكتب ملاحظتك أولًا");
      return;
    }
    setBusy(true);
    setError("");
    const { error: failure } = await supabase.rpc("submit_feedback", { _content: clean });
    setBusy(false);
    if (failure) {
      setError("تعذّر إرسال الملاحظة، حاول مرة أخرى");
      return;
    }
    setContent("");
    setSent(true);
    toast.success("وصلتنا ملاحظتك، شكرًا لك");
  }

  return (
    <Card className="mt-3">
      <button type="button" className="flex w-full items-center gap-3 text-right" onClick={() => { setOpen((v) => !v); setSent(false); }} aria-expanded={open}>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft"><MessageSquare className="size-5 text-primary" /></span>
        <span className="flex-1"><span className="block text-sm font-bold">إرسال ملاحظة</span><span className="block text-[11px] text-muted-foreground">شاركنا اقتراحك أو المشكلة التي واجهتك</span></span>
      </button>
      {open && (
        <div className="mt-4">
          <label htmlFor="student-feedback" className="mb-2 block text-xs font-bold">ملاحظتك</label>
          <textarea id="student-feedback" value={content} onChange={(e) => { setContent(e.target.value); setError(""); setSent(false); }} maxLength={4000} rows={5} placeholder="اكتب ملاحظتك هنا…" className="w-full resize-y rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
          {error && <p role="alert" className="mt-2 text-xs font-bold text-destructive">{error}</p>}
          {sent && <p role="status" className="mt-2 text-xs font-bold text-success">تم إرسال ملاحظتك بنجاح.</p>}
          <Button type="button" onClick={() => void submit()} disabled={busy || !session} className="mt-3 w-full rounded-2xl">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} إرسال
          </Button>
        </div>
      )}
    </Card>
  );
}

type FeedbackRow = { id: string; student_name: string; student_email: string; content: string; status: string; created_at: string };

export function AdminFeedback() {
  const { isAdmin } = useApp();
  const feedback = useQuery({
    queryKey: ["admin", "feedback"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("feedback").select("id,student_name,student_email,content,status,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  if (feedback.isLoading) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />;
  if (feedback.isError) return <p className="text-sm text-destructive">تعذّر تحميل الملاحظات.</p>;
  if (!feedback.data?.length) return <Card className="text-center text-sm text-muted-foreground">لا توجد ملاحظات مرسلة بعد.</Card>;

  return (
    <div className="flex flex-col gap-3">
      {feedback.data.map((item) => (
        <Card key={item.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate text-sm font-bold">{item.student_name || "طالب نوابغ"}</h3><p className="truncate text-xs text-muted-foreground" dir="ltr">{item.student_email}</p></div>
            <span className="shrink-0 rounded-xl bg-secondary px-2 py-1 text-[10px]">{item.status}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("ar-EG")}</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-primary">فتح الملاحظة وقراءتها</summary>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-secondary p-3 text-sm leading-relaxed">{item.content}</p>
          </details>
        </Card>
      ))}
    </div>
  );
}
