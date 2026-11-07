import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, List, ListOrdered, Undo2, Redo2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { explanationHtml, sanitizeHtml } from "@/lib/sanitize-html";
import { AdminContentPicker } from "@/components/admin-content-picker";
import { Button } from "@/components/ui/button";

export function AdminExplanationEditor() {
  return <AdminContentPicker lesson>{(s) => {
    const lesson = s[4];
    return lesson ? <ExplanationEditor key={lesson.id} lessonId={lesson.id} title={lesson.title ?? ""} /> : null;
  }}</AdminContentPicker>;
}

function ExplanationEditor({ lessonId, title }: { lessonId: string; title: string }) {
  const { session } = useApp();
  const cache = useQueryClient();
  const key = `nawabig-explanation:${session?.user.id}:${lessonId}`;
  const [html, setHtml] = useState("");
  const [raw, setRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const content = useQuery({ queryKey: ["admin-explanation", lessonId], queryFn: async () => {
    const { data, error } = await supabase.from("lesson_content").select("explanation").eq("lesson_id", lessonId).maybeSingle();
    if (error) throw error;
    return data?.explanation ?? "";
  }});
  const revisions = useQuery({ queryKey: ["explanation-revisions", lessonId], queryFn: async () => {
    const { data, error } = await supabase.from("lesson_content_revisions").select("id,explanation,created_at").eq("lesson_id", lessonId).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return data ?? [];
  }});
  const editor = useEditor({ immediatelyRender: false, extensions: [StarterKit, TextStyle, Color, Highlight],
    editorProps: { attributes: { class: "lesson-rich min-h-80 p-4 outline-none", dir: "rtl", "aria-label": "شرح الدرس المنسق" } },
    onUpdate: ({ editor: e }) => {
      const value = e.getHTML(); setHtml(value); localStorage.setItem(key, value);
    },
  });
  useEffect(() => {
    if (!editor || content.data === undefined || ready) return;
    const saved = localStorage.getItem(key);
    const value = saved ?? explanationHtml(content.data);
    editor.commands.setContent(value); setHtml(value); setReady(true);
    if (saved !== null) toast.info("تم استعادة التعديل غير المحفوظ");
  }, [editor, content.data, key, ready]);
  const save = async () => {
    setSaving(true);
    try {
      const value = sanitizeHtml(raw ? html : editor?.getHTML() ?? html);
      const { error } = await supabase.rpc("admin_save_lesson_explanation", { _lesson_id: lessonId, _explanation: value });
      if (error) throw error;
      localStorage.removeItem(key);
      await cache.invalidateQueries({ queryKey: ["lesson", lessonId] });
      await cache.invalidateQueries({ queryKey: ["explanation-revisions", lessonId] });
      toast.success("تم حفظ شرح الدرس ونسخته السابقة");
    } catch { toast.error("تعذر الحفظ؛ تعديلك محفوظ على هذا الجهاز، حاول مجددًا"); }
    finally { setSaving(false); }
  };
  if (content.isError) return <p className="text-destructive">تعذر تحميل الشرح <Button onClick={() => void content.refetch()}>إعادة المحاولة</Button></p>;
  if (!ready) return <Loader2 className="mx-auto animate-spin text-primary" />;
  return <div className="flex flex-col gap-3">
    <h3>{title}</h3>
    <div className="flex gap-2">
      <Button variant={!raw ? "default" : "outline"} onClick={() => { editor?.commands.setContent(sanitizeHtml(html)); setRaw(false); }}>منسق</Button>
      <Button variant={raw ? "default" : "outline"} onClick={() => { setHtml(editor?.getHTML() ?? html); setRaw(true); }}>النص الخام</Button>
    </div>
    {!raw && editor && <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {[
        { label: "خط عريض", Icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
        { label: "خط مائل", Icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
        { label: "قائمة نقطية", Icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
        { label: "قائمة مرقمة", Icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "تراجع", Icon: Undo2, run: () => editor.chain().focus().undo().run() },
        { label: "إعادة", Icon: Redo2, run: () => editor.chain().focus().redo().run() },
      ].map(({ label, Icon, run }) => <Button key={label} variant="ghost" size="icon" title={label} aria-label={label} onClick={run}><Icon /></Button>)}
      <select aria-label="نوع الفقرة" className="rounded-md border border-border bg-card p-2 text-xs" onChange={(e) => {
        if (e.target.value === "p") editor.chain().focus().setParagraph().run();
        else editor.chain().focus().toggleHeading({ level: e.target.value === "h2" ? 2 : 3 }).run();
      }}><option value="p">فقرة</option><option value="h2">عنوان رئيسي</option><option value="h3">عنوان فرعي</option></select>
      <Button size="icon" variant="ghost" title="لون أزرق" aria-label="لون أزرق" onClick={() => editor.chain().focus().setColor("var(--primary)").run()}><span className="size-4 rounded-full bg-primary" /></Button>
      <Button size="icon" variant="ghost" title="لون ذهبي" aria-label="لون ذهبي" onClick={() => editor.chain().focus().setColor("var(--warning)").run()}><span className="size-4 rounded-full bg-warning" /></Button>
      <Button size="icon" variant="ghost" title="إضافة إيموجي" aria-label="إضافة إيموجي" onClick={() => editor.chain().focus().insertContent("💡").run()}>💡</Button>
    </div>}
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {raw ? <textarea aria-label="شرح الدرس الخام" className="min-h-80 w-full bg-card p-4 font-mono text-sm" value={html} onChange={(e) => { setHtml(e.target.value); localStorage.setItem(key, e.target.value); }} /> : <EditorContent editor={editor} />}
    </div>
    <Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <Save />}حفظ التعديلات</Button>
    {(revisions.data?.length ?? 0) > 0 && <select aria-label="استرجاع نسخة سابقة" className="rounded-lg border border-border bg-card p-3 text-sm" value="" onChange={(e) => {
      const revision = revisions.data?.find((r) => r.id === e.target.value);
      if (!revision || !window.confirm("استرجاع النسخة إلى المحرر؟ لن تُحفظ إلا عند الضغط على حفظ التعديلات.")) return;
      const value = explanationHtml(revision.explanation); setHtml(value); editor?.commands.setContent(value); localStorage.setItem(key, value);
    }}><option value="">النسخ السابقة</option>{revisions.data?.map((r) => <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString("ar")}</option>)}</select>}
  </div>;
}