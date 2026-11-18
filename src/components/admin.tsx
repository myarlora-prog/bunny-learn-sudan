import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2, Upload, Check, X, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { processBook, type DraftUnit } from "@/lib/admin-ai.functions";
import { countLessons, mergeUnits, splitBook } from "@/lib/book-parts";
import {
  publishDraft,
  useAdminList,
  useAdminMutation,
  useAdminStats,
  useAdminUsers,
  useDrafts,
  useSaveSetting,
  useSettingsMap,
  type AdminDraft,
} from "@/lib/admin-db";
import { extractText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";

const input =
  "w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary";
const btn = "press gradient-hero rounded-2xl px-4 py-2.5 text-sm font-bold text-primary-foreground";
const ghost = "press rounded-2xl border border-border bg-card px-3 py-2 text-xs font-bold";

function Spinner() {
  return <Loader2 className="mx-auto my-6 size-5 animate-spin text-primary" />;
}

/* ------------------------------- Dashboard ------------------------------- */

export function AdminDashboard() {
  const { data, isLoading } = useAdminStats();
  if (isLoading) return <Spinner />;
  const cards = [
    ["المراحل", data?.stages],
    ["الصفوف", data?.grades],
    ["المواد", data?.subjects],
    ["الوحدات", data?.units],
    ["الدروس", data?.lessons],
    ["الطلاب", data?.users],
    ["اشتراكات فعّالة", data?.subs],
    ["مسودات", data?.drafts],
    ["إحالات ناجحة", data?.referrals],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map(([label, value]) => (
        <div key={label} className="surface-card p-3 text-center">
          <p className="text-lg font-bold">{value ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

export const AdminStatistics = AdminDashboard;

/* --------------------------------- Users --------------------------------- */

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useAdminUsers(search);
  const [busy, setBusy] = useState<string | null>(null);

  async function setRole(userId: string, isAdmin: boolean) {
    setBusy(userId);
    const { error } = isAdmin
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success("تم تحديث الصلاحية");
      void refetch();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        className={input}
        placeholder="ابحث بالاسم أو البريد"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading ? (
        <Spinner />
      ) : (
        (data ?? []).map((u) => {
          const isAdmin = u.roles.includes("admin");
          return (
            <Card key={u.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{u.avatar_emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.display_name || "طالب"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                </div>
                <span className="rounded-xl bg-secondary px-2 py-1 text-[10px]">
                  {u.sub ? "سوبر" : "مجاني"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>النقاط: {u.stats?.points ?? 0}</span>
                <span>السلسلة: {u.stats?.streak ?? 0}</span>
                {u.sub?.expires_at && <span>ينتهي: {new Date(u.sub.expires_at).toLocaleDateString("ar")}</span>}
              </div>
              <div className="flex gap-2">
                <button className={ghost} disabled={busy === u.id} onClick={() => void setRole(u.id, isAdmin)}>
                  {isAdmin ? "إزالة صلاحية المالك" : "جعله مالكًا"}
                </button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------- Curriculum ------------------------------- */

type Row = Record<string, string | number | boolean | null>;

function CrudList({
  table,
  parentColumn,
  parentValue,
  fields,
  title,
  onOpen,
}: {
  table: "stages" | "grades" | "subjects" | "units" | "lessons";
  parentColumn?: string;
  parentValue?: string | null;
  fields: { key: string; label: string; type?: "text" | "number" | "bool" }[];
  title: string;
  onOpen?: (row: Row) => void;
}) {
  const list = useAdminList<Row>(table, parentColumn ? { column: parentColumn, value: parentValue ?? null } : undefined);
  const mut = useAdminMutation(table);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  function submit() {
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.key] ?? "";
      values[f.key] = f.type === "number" ? Number(v || 0) : f.type === "bool" ? v === "true" : v;
    }
    if (parentColumn && parentValue) values[parentColumn] = parentValue;
    mut.mutate(
      editing ? { type: "update", id: editing, values } : { type: "insert", values },
      {
        onSuccess: () => {
          setForm({});
          setEditing(null);
          toast.success("تم الحفظ");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  if (parentColumn && !parentValue) return <p className="text-xs text-muted-foreground">اختر العنصر الأعلى أولًا.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold text-muted-foreground">{title}</p>
      {list.isLoading ? (
        <Spinner />
      ) : (
        (list.data ?? []).map((row) => (
          <Card key={String(row["id"])} className="flex items-center gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-right"
              onClick={() => onOpen?.(row)}
            >
              <p className="truncate text-sm font-bold">{String(row["name"] ?? row["title"] ?? "")}</p>
              <p className="text-[10px] text-muted-foreground">
                ترتيب {String(row["sort_order"] ?? 0)}
                {"published" in row ? (row["published"] ? " · منشور" : " · مسودة") : ""}
              </p>
            </button>
            <button
              className="press rounded-xl border border-border p-2"
              onClick={() => {
                setEditing(String(row["id"]));
                const f: Record<string, string> = {};
                for (const fl of fields) f[fl.key] = String(row[fl.key] ?? "");
                setForm(f);
              }}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              className="press rounded-xl border border-border p-2 text-destructive"
              onClick={() => {
                if (confirm("حذف هذا العنصر؟"))
                  mut.mutate({ type: "delete", id: String(row["id"]) }, { onError: (e) => toast.error((e as Error).message) });
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </Card>
        ))
      )}

      <Card className="flex flex-col gap-2">
        <p className="text-xs font-bold">{editing ? "تعديل" : "إضافة جديد"}</p>
        {fields.map((f) => (
          <input
            key={f.key}
            className={input}
            placeholder={f.label}
            value={form[f.key] ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
          />
        ))}
        <div className="flex gap-2">
          <button className={btn} onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "إضافة"}
          </button>
          {editing && (
            <button
              className={ghost}
              onClick={() => {
                setEditing(null);
                setForm({});
              }}
            >
              إلغاء
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

export function AdminCurriculum({ start = "stages" }: { start?: "stages" | "grades" | "subjects" | "units" | "lessons" }) {
  const [stage, setStage] = useState<Row | null>(null);
  const [grade, setGrade] = useState<Row | null>(null);
  const [subject, setSubject] = useState<Row | null>(null);
  const [unit, setUnit] = useState<Row | null>(null);

  const crumbs = [stage, grade, subject, unit].filter(Boolean) as Row[];

  return (
    <div className="flex flex-col gap-4">
      {crumbs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={i} className="rounded-lg bg-secondary px-2 py-1">
              {String(c["name"] ?? c["title"])}
            </span>
          ))}
          <button
            className="text-primary"
            onClick={() => {
              setStage(null);
              setGrade(null);
              setSubject(null);
              setUnit(null);
            }}
          >
            إعادة تعيين
          </button>
        </div>
      )}

      {!stage && start === "stages" && (
        <CrudList
          table="stages"
          title="المراحل التعليمية"
          fields={[
            { key: "name", label: "اسم المرحلة" },
            { key: "description", label: "الوصف" },
            { key: "sort_order", label: "الترتيب", type: "number" },
          ]}
          onOpen={setStage}
        />
      )}
      {stage && !grade && (
        <CrudList
          table="grades"
          parentColumn="stage_id"
          parentValue={String(stage["id"])}
          title="الصفوف"
          fields={[
            { key: "name", label: "اسم الصف" },
            { key: "access_type", label: "نوع الوصول (free/super)" },
            { key: "sort_order", label: "الترتيب", type: "number" },
          ]}
          onOpen={setGrade}
        />
      )}
      {grade && !subject && (
        <CrudList
          table="subjects"
          parentColumn="grade_id"
          parentValue={String(grade["id"])}
          title="المواد"
          fields={[
            { key: "name", label: "اسم المادة" },
            { key: "icon", label: "الأيقونة (إيموجي)" },
            { key: "color", label: "اللون" },
            { key: "sort_order", label: "الترتيب", type: "number" },
          ]}
          onOpen={setSubject}
        />
      )}
      {subject && !unit && (
        <CrudList
          table="units"
          parentColumn="subject_id"
          parentValue={String(subject["id"])}
          title="الوحدات"
          fields={[
            { key: "title", label: "عنوان الوحدة" },
            { key: "description", label: "الوصف" },
            { key: "sort_order", label: "الترتيب", type: "number" },
          ]}
          onOpen={setUnit}
        />
      )}
      {unit && (
        <CrudList
          table="lessons"
          parentColumn="unit_id"
          parentValue={String(unit["id"])}
          title="الدروس"
          fields={[
            { key: "title", label: "عنوان الدرس" },
            { key: "duration_minutes", label: "المدة بالدقائق", type: "number" },
            { key: "sort_order", label: "الترتيب", type: "number" },
          ]}
        />
      )}
    </div>
  );
}

/* -------------------------------- Published ------------------------------- */

export function AdminPublished() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "published-lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,title,published,unit_id,units(title,subjects(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  async function toggle(id: string, published: boolean) {
    const { error } = await supabase.from("lessons").update({ published: !published }).eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["admin"] });
  }

  if (isLoading) return <Spinner />;
  return (
    <div className="flex flex-col gap-2.5">
      {(data ?? []).map((l) => (
        <Card key={l.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{l.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {l.units?.subjects?.name} · {l.units?.title}
            </p>
          </div>
          <button className={ghost} onClick={() => void toggle(l.id, l.published)}>
            {l.published ? "إلغاء النشر" : "نشر"}
          </button>
        </Card>
      ))}
      {(data ?? []).length === 0 && <p className="text-xs text-muted-foreground">لا توجد دروس بعد.</p>}
    </div>
  );
}

/* --------------------------- Upload & AI processing --------------------------- */

export function AdminUpload() {
  const stages = useAdminList<Row>("stages");
  const [stageId, setStageId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const grades = useAdminList<Row>("grades", { column: "stage_id", value: stageId || null });
  const subjects = useAdminList<Row>("subjects", { column: "grade_id", value: gradeId || null });
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [step, setStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const run = useServerFn(processBook);
  const qc = useQueryClient();

  const gradeName = useMemo(
    () => String((grades.data ?? []).find((g) => g["id"] === gradeId)?.["name"] ?? ""),
    [grades.data, gradeId],
  );
  const subjectName = useMemo(
    () => String((subjects.data ?? []).find((s) => s["id"] === subjectId)?.["name"] ?? ""),
    [subjects.data, subjectId],
  );

  const hasSource = !!file || pasted.trim().length > 0;

  type Job = { draftId: string; fileId: string | null; parts: string[]; done: number; units: DraftUnit[]; flags: string[]; sourceName: string };
  const [job, setJob] = useState<Job | null>(null);

  const runParts = async (j: Job) => {
    let cur = j;
    for (let i = cur.done; i < cur.parts.length; i++) {
      setStep(`تحليل الجزء ${i + 1} من ${cur.parts.length} بالذكاء الاصطناعي…`);
      let r: Awaited<ReturnType<typeof run>>;
      try {
        r = await run({ data: { text: cur.parts[i], subjectName, gradeName, part: i + 1, parts: cur.parts.length, previousUnit: cur.units[cur.units.length - 1]?.title ?? "" } });
      } catch (e) {
        const msg = `${(e as Error)?.message || "خطأ غير متوقع"} — تم حفظ ${i} من ${cur.parts.length} أجزاء، يمكنك الاستكمال.`;
        if (cur.fileId) await supabase.from("curriculum_files").update({ status: "failed", notes: msg.slice(0, 500) }).eq("id", cur.fileId);
        throw new Error(msg);
      }
      cur = { ...cur, done: i + 1, units: mergeUnits(cur.units, r.units), flags: [...cur.flags, ...r.flags] };
      const { error } = await supabase.from("curriculum_drafts").update({ content: { units: cur.units } as never, flags: cur.flags as never }).eq("id", cur.draftId);
      if (error) throw new Error(`تعذّر حفظ الجزء ${i + 1}: ${error.message}`);
      setJob(cur);
    }
    if (cur.fileId) await supabase.from("curriculum_files").update({ status: "processed", notes: `${countLessons(cur.units)} درسًا في ${cur.units.length} وحدة` }).eq("id", cur.fileId);
    return cur;
  };

  const process = useMutation({
    mutationFn: async (resume?: Job) => {
      setErrorMsg("");
      if (resume) return runParts(resume);
      if (!subjectId) throw new Error("اختر المادة أولًا");
      if (!hasSource) throw new Error("ارفع ملفًا أو الصق نص الكتاب");

      let text = pasted.trim();
      let sourceName = sourceTitle.trim() || "نص ملصوق";
      let fileId: string | null = null;
      if (file) {
        setStep("رفع الكتاب…");
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const path = `${subjectId}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("curriculum-books").upload(path, file);
        if (up.error) throw new Error(`فشل رفع الملف: ${up.error.message}`);
        const ins = await supabase.from("curriculum_files").insert({ grade_id: gradeId, subject_id: subjectId, file_name: file.name, file_path: path, status: "processing" }).select("id").single();
        if (ins.error) throw new Error(`تعذّر تسجيل الملف: ${ins.error.message}`);
        fileId = ins.data.id;
        setStep("قراءة محتوى الملف…");
        const fileText = await extractText(file);
        text = text ? `${text}\n\n${fileText}` : fileText;
        sourceName = sourceTitle.trim() || file.name;
      }
      if (text.trim().length < 50) {
        const msg = "لم نتمكن من قراءة نص كافٍ (قد يكون الملف صورًا ممسوحة — الصق النص يدويًا)";
        if (fileId) await supabase.from("curriculum_files").update({ status: "failed", notes: msg }).eq("id", fileId);
        throw new Error(msg);
      }
      const parts = splitBook(text);
      const d = await supabase.from("curriculum_drafts").insert({
        stage_id: stageId, grade_id: gradeId, subject_id: subjectId, source_name: sourceName,
        source_text: text.slice(0, 200000), content: { units: [] } as never, flags: [] as never, status: "draft",
      }).select("id").single();
      if (d.error) throw d.error;
      const j: Job = { draftId: d.data.id, fileId, parts, done: 0, units: [], flags: [], sourceName };
      setJob(j);
      return runParts(j);
    },
    onSuccess: (r) => {
      setStep("");
      setJob(null);
      setFile(null);
      setPasted("");
      setSourceTitle("");
      if (fileRef.current) fileRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`اكتملت المعالجة: ${r.units.length} وحدة و${countLessons(r.units)} درسًا — راجعها في المسودات`);
    },
    onError: (e) => {
      setStep("");
      const msg = (e as Error)?.message || "حدث خطأ غير متوقع";
      console.error("Book processing failed:", e);
      setErrorMsg(msg);
      toast.error(msg);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  // Start automatically once a file is chosen and the subject is set.
  useEffect(() => {
    if (file && subjectId && !process.isPending) process.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <div className="flex flex-col gap-3">
      <select className={input} value={stageId} onChange={(e) => { setStageId(e.target.value); setGradeId(""); setSubjectId(""); }}>
        <option value="">اختر المرحلة</option>
        {(stages.data ?? []).map((s) => (
          <option key={String(s["id"])} value={String(s["id"])}>{String(s["name"])}</option>
        ))}
      </select>
      <select className={input} value={gradeId} onChange={(e) => { setGradeId(e.target.value); setSubjectId(""); }} disabled={!stageId}>
        <option value="">اختر الصف</option>
        {(grades.data ?? []).map((g) => (
          <option key={String(g["id"])} value={String(g["id"])}>{String(g["name"])}</option>
        ))}
      </select>
      <select className={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!gradeId}>
        <option value="">اختر المادة</option>
        {(subjects.data ?? []).map((s) => (
          <option key={String(s["id"])} value={String(s["id"])}>{String(s["name"])}</option>
        ))}
      </select>

      <label className="surface-card flex cursor-pointer items-center gap-3 p-4">
        <Upload className="size-5 text-primary" />
        <span className="flex-1 text-sm">{file ? file.name : subjectId ? "ارفع ملف PDF أو Word أو TXT — تبدأ المعالجة تلقائيًا" : "اختر المادة ثم ارفع ملف PDF أو Word أو TXT"}</span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <p className="text-center text-[11px] text-muted-foreground">أو الصق نص الكتاب مباشرة</p>
      <input
        className={input}
        placeholder="عنوان المصدر (اختياري) — مثال: الوحدة الأولى"
        value={sourceTitle}
        onChange={(e) => setSourceTitle(e.target.value)}
      />
      <textarea
        className={`${input} min-h-40 leading-relaxed`}
        placeholder="الصق هنا نص الكتاب أو الدروس…"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
      />
      {pasted && <p className="text-[10px] text-muted-foreground">{pasted.length.toLocaleString("ar")} حرف</p>}

      <button className={btn} disabled={process.isPending || !hasSource || !subjectId} onClick={() => process.mutate(undefined)}>
        {process.isPending ? step || "جارٍ المعالجة…" : "معالجة الكتاب بالذكاء الاصطناعي"}
      </button>
      {job && (
        <div className="surface-card flex flex-col gap-2 p-3 text-xs">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((job.done / job.parts.length) * 100)}%` }} />
          </div>
          <p>التقدم: {Math.round((job.done / job.parts.length) * 100)}% — {job.done}/{job.parts.length} أجزاء · {job.units.length} وحدة · {countLessons(job.units)} درسًا محفوظًا كمسودة</p>
          {!process.isPending && job.done < job.parts.length && (
            <button className={ghost} onClick={() => process.mutate(job)}>استكمال من الجزء {job.done + 1}</button>
          )}
        </div>
      )}
      {errorMsg && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{errorMsg}</p>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        يعتمد التحليل على نص الكتاب المرفوع فقط. أي جزء ناقص أو غير واضح يُسجَّل كملاحظة للمراجعة بدل تخمينه.
      </p>
    </div>
  );
}

/* --------------------------------- Drafts --------------------------------- */

export function AdminDrafts() {
  const { data, isLoading, refetch } = useDrafts("draft");
  const [open, setOpen] = useState<AdminDraft | null>(null);

  if (isLoading) return <Spinner />;
  if (open) return <DraftReview draft={open} onDone={() => { setOpen(null); void refetch(); }} />;

  return (
    <div className="flex flex-col gap-2.5">
      {(data ?? []).map((d) => (
        <Card key={d.id} className="flex items-center gap-2" onClick={() => setOpen(d)}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{d.source_name || "مسودة"}</p>
            <p className="text-[10px] text-muted-foreground">
              {d.content?.units?.length ?? 0} وحدة · {d.flags?.length ?? 0} ملاحظة
            </p>
          </div>
          <span className="rounded-xl bg-secondary px-2 py-1 text-[10px]">مراجعة</span>
        </Card>
      ))}
      {(data ?? []).length === 0 && <p className="text-xs text-muted-foreground">لا توجد مسودات حاليًا.</p>}
    </div>
  );
}

type PublishLoc = { stageId: string; gradeId: string; subjectId: string };

function PublishLocationPicker({ value, onChange }: { value: PublishLoc; onChange: (v: PublishLoc) => void }) {
  type Row = Record<string, unknown>;
  const qc = useQueryClient();
  const stages = useAdminList<Row>("stages");
  const grades = useAdminList<Row>("grades", { column: "stage_id", value: value.stageId || null });
  const subjects = useAdminList<Row>("subjects", { column: "grade_id", value: value.gradeId || null });
  const [adding, setAdding] = useState<"stage" | "grade" | "subject" | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNew() {
    const n = name.trim();
    if (!n || !adding) return;
    setSaving(true);
    try {
      if (adding === "stage") {
        const { data, error } = await supabase
          .from("stages")
          .insert({ name: n, sort_order: (stages.data?.length ?? 0) + 1 })
          .select("id")
          .single();
        if (error) throw error;
        onChange({ stageId: data.id, gradeId: "", subjectId: "" });
      } else if (adding === "grade") {
        const { data, error } = await supabase
          .from("grades")
          .insert({ stage_id: value.stageId, name: n, access_type: "free", sort_order: (grades.data?.length ?? 0) + 1 })
          .select("id")
          .single();
        if (error) throw error;
        onChange({ ...value, gradeId: data.id, subjectId: "" });
      } else {
        const { data, error } = await supabase
          .from("subjects")
          .insert({ grade_id: value.gradeId, name: n, icon: "📚", color: "#3B82F6", sort_order: (subjects.data?.length ?? 0) + 1 })
          .select("id")
          .single();
        if (error) throw error;
        onChange({ ...value, subjectId: data.id });
      }
      setAdding(null);
      setName("");
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("تمت الإضافة");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function row(
    label: string,
    kind: "stage" | "grade" | "subject",
    items: Row[],
    selected: string,
    disabled: boolean,
    onSelect: (id: string) => void,
  ) {
    return (
      <div className="flex items-center gap-2">
        <select
          className={input}
          value={selected}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">{label}</option>
          {items.map((it) => (
            <option key={String(it["id"])} value={String(it["id"])}>
              {String(it["name"])}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={cn(ghost, "shrink-0 px-2.5")}
          disabled={disabled}
          title={`إضافة ${label} جديد`}
          onClick={() => {
            setAdding(adding === kind ? null : kind);
            setName("");
          }}
        >
          <Plus className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-2 border-primary/30 bg-primary-soft/40">
      <p className="flex items-center gap-1.5 text-xs font-bold">
        <MapPin className="size-4 text-primary" /> مكان النشر
      </p>
      {row("اختر المرحلة", "stage", stages.data ?? [], value.stageId, false, (id) =>
        onChange({ stageId: id, gradeId: "", subjectId: "" }),
      )}
      {row("اختر الصف", "grade", grades.data ?? [], value.gradeId, !value.stageId, (id) =>
        onChange({ ...value, gradeId: id, subjectId: "" }),
      )}
      {row("اختر المادة", "subject", subjects.data ?? [], value.subjectId, !value.gradeId, (id) =>
        onChange({ ...value, subjectId: id }),
      )}
      {adding && (
        <div className="flex items-center gap-2">
          <input
            className={input}
            placeholder={
              adding === "stage" ? "اسم المرحلة الجديدة" : adding === "grade" ? "اسم الصف الجديد" : "اسم المادة الجديدة"
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className={cn(btn, "shrink-0 px-3 py-2")} disabled={saving || !name.trim()} onClick={() => void addNew()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
          <button type="button" className={cn(ghost, "shrink-0 px-2.5")} onClick={() => setAdding(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}
    </Card>
  );
}

function DraftReview({ draft, onDone }: { draft: AdminDraft; onDone: () => void }) {
  const [content, setContent] = useState(draft.content ?? { units: [], flags: [] });
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState<PublishLoc>({
    stageId: draft.stage_id ?? "",
    gradeId: draft.grade_id ?? "",
    subjectId: draft.subject_id ?? "",
  });
  const [publishedSubjectId, setPublishedSubjectId] = useState<string | null>(null);

  function updateLesson(ui: number, li: number, key: string, value: string) {
    setContent((c) => {
      const units = structuredClone(c.units ?? []);
      const lesson = units[ui]?.lessons?.[li];
      if (lesson) (lesson as unknown as Record<string, unknown>)[key] = value;
      return { ...c, units };
    });
  }

  async function save(publish: boolean) {
    if (publish && !loc.subjectId) {
      toast.error("حدد مكان النشر أولًا: المرحلة والصف والمادة");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("curriculum_drafts")
        .update({
          content: content as never,
          stage_id: loc.stageId || null,
          grade_id: loc.gradeId || null,
          subject_id: loc.subjectId || null,
        })
        .eq("id", draft.id);
      if (error) throw error;
      if (publish) {
        await publishDraft({
          ...draft,
          stage_id: loc.stageId || null,
          grade_id: loc.gradeId || null,
          subject_id: loc.subjectId,
          content,
        });
        setPublishedSubjectId(loc.subjectId);
        toast.success("تم النشر في المنهج");
      } else {
        toast.success("تم حفظ المسودة");
        onDone();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (publishedSubjectId) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Check className="size-10 text-primary" />
        <p className="text-sm font-bold">تم نشر المحتوى في مكانه بنجاح</p>
        <p className="text-[11px] text-muted-foreground">ستجده الآن ضمن المادة التي اخترتها في المكتبة.</p>
        <Link
          to="/curriculum/$subjectId"
          params={{ subjectId: publishedSubjectId }}
          className={btn}
        >
          الانتقال إلى القسم المنشور
        </Link>
        <button className={ghost} onClick={onDone}>رجوع للمسودات</button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button className={ghost} onClick={onDone}>رجوع للمسودات</button>

      {(draft.flags ?? []).length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <p className="mb-1 text-xs font-bold text-destructive">ملاحظات تحتاج مراجعتك</p>
          <ul className="list-disc pr-4 text-[11px] leading-relaxed text-muted-foreground">
            {draft.flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </Card>
      )}

      {(content.units ?? []).map((u, ui) => (
        <Card key={ui} className="flex flex-col gap-2">
          <input
            className={input}
            value={u.title}
            onChange={(e) =>
              setContent((c) => {
                const units = structuredClone(c.units ?? []);
                units[ui]!.title = e.target.value;
                return { ...c, units };
              })
            }
          />
          {(u.lessons ?? []).map((l, li) => (
            <details key={li} className="rounded-2xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-bold">{l.title}</summary>
              <div className="mt-2 flex flex-col gap-2">
                <input className={input} value={l.title} onChange={(e) => updateLesson(ui, li, "title", e.target.value)} />
                <textarea
                  className={cn(input, "min-h-28")}
                  value={l.explanation}
                  onChange={(e) => updateLesson(ui, li, "explanation", e.target.value)}
                />
                <textarea
                  className={cn(input, "min-h-20")}
                  value={l.summary}
                  onChange={(e) => updateLesson(ui, li, "summary", e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  {l.flashcards?.length ?? 0} بطاقة · {l.quiz?.length ?? 0} سؤال · {l.key_points?.length ?? 0} نقطة مهمة
                </p>
              </div>
            </details>
          ))}
        </Card>
      ))}

      <PublishLocationPicker value={loc} onChange={setLoc} />

      <div className="flex gap-2">
        <button className={btn} disabled={busy} onClick={() => void save(false)}>
          <Check className="ml-1 inline size-4" /> حفظ المسودة
        </button>
        <button className={ghost} disabled={busy || !loc.subjectId} onClick={() => void save(true)}>
          نشر في المنهج
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Subscriptions ------------------------------ */

export function AdminSubscriptions() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useAdminUsers(search);
  const ownerId = useApp().session?.user.id;
  const [months, setMonths] = useState("1");
  const [customDays, setCustomDays] = useState("");
  const { data: names } = useQuery({
    queryKey: ["admin", "stage-grade-names"],
    queryFn: async () => {
      const [{ data: st }, { data: gr }] = await Promise.all([
        supabase.from("stages").select("id,name"),
        supabase.from("grades").select("id,name"),
      ]);
      return {
        stage: Object.fromEntries((st ?? []).map((x) => [x.id, x.name])) as Record<string, string>,
        grade: Object.fromEntries((gr ?? []).map((x) => [x.id, x.name])) as Record<string, string>,
      };
    },
  });

  const [target, setTarget] = useState<{ id: string; display_name: string; email: string; grade_id: string | null; sub: { expires_at: string } | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reqKey, setReqKey] = useState(() => crypto.randomUUID());

  function addPeriod(from: Date) {
    const d = new Date(from);
    if (months === "custom") d.setDate(d.getDate() + Math.max(1, Number(customDays) || 0));
    else d.setMonth(d.getMonth() + Number(months));
    return d;
  }
  const durationLabel = months === "custom" ? `${customDays || 0} يومًا` : months === "1" ? "شهر واحد" : months === "2" ? "شهرين" : "3 أشهر";

  async function confirmGrant() {
    if (!target || busy) return;
    if (months === "custom" && !(Number(customDays) > 0 && Number.isInteger(Number(customDays)))) {
      toast.error("أدخل عدد أيام صحيح للمدة المخصصة");
      return;
    }
    setBusy(true);
    const { data: res, error } = await supabase.rpc("admin_grant_super", {
      _user_id: target.id,
      _months: months === "custom" ? 0 : Number(months),
      _days: months === "custom" ? Number(customDays) : 0,
      _request_key: reqKey,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    const r = res as { extended?: boolean; duplicate?: boolean };
    toast.success(r.duplicate ? "تم تنفيذ هذا الطلب مسبقًا" : r.extended ? "تم تمديد السوبر" : "تم تفعيل السوبر");
    setTarget(null);
    setReqKey(crypto.randomUUID());
    void refetch();
  }

  async function cancel(userId: string) {
    if (!window.confirm("إلغاء السوبر وإرجاع الطالب إلى Free؟ سيبقى السجل محفوظًا.")) return;
    const { error } = await supabase.rpc("admin_cancel_super", { _user_id: userId });
    if (error) toast.error(error.message);
    else {
      toast.success("تم الإلغاء — الطالب الآن على Free");
      void refetch();
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-3">
      <input className={input} placeholder="ابحث بالاسم أو البريد الإلكتروني" value={search} onChange={(e) => setSearch(e.target.value)} />
      {target && (
        <Card className="flex flex-col gap-2 border-primary/50">
          <p className="text-sm font-bold">{target.sub ? "تمديد السوبر" : "تفعيل السوبر"}</p>
          <p className="text-[11px]">الطالب: <b>{target.display_name || "بدون اسم"}</b></p>
          <p className="text-[11px]" dir="ltr">{target.email}</p>
          <p className="text-[11px]">المدة: {durationLabel}</p>
          <p className="text-[11px]">تاريخ البدء: {fmt((target.sub ? new Date(target.sub.expires_at) : new Date()).toISOString())}</p>
          <p className="text-[11px]">تاريخ الانتهاء المتوقع: <b>{fmt(addPeriod(target.sub ? new Date(target.sub.expires_at) : new Date()).toISOString())}</b></p>
          <div className="flex gap-2">
            <button className={btn} disabled={busy} onClick={() => void confirmGrant()}>
              {busy ? <Loader2 className="inline size-4 animate-spin" /> : "تأكيد"}
            </button>
            <button className={ghost} disabled={busy} onClick={() => setTarget(null)}>إلغاء</button>
          </div>
        </Card>
      )}
      <div className="flex gap-2">
        <select className={input} value={months} onChange={(e) => setMonths(e.target.value)}>
          <option value="1">شهر واحد</option>
          <option value="2">شهرين</option>
          <option value="3">3 أشهر</option>
          <option value="custom">مدة مخصصة (بالأيام)</option>
        </select>
        {months === "custom" && (
          <input className={input} inputMode="numeric" placeholder="عدد الأيام" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
        )}
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        (data ?? []).filter((u) => u.id !== ownerId).map((u) => {
          const incomplete = !u.stage_id || !u.grade_id;
          return (
            <Card key={u.id} className={cn("flex flex-col gap-1.5", incomplete && "border-warning/60")}>
              <p className="text-sm font-bold">{u.display_name || "بدون اسم"}</p>
              <p className="text-[11px] text-muted-foreground" dir="ltr">{u.email}</p>
              <p className="text-[11px]">
                {u.stage_id ? names?.stage[u.stage_id] ?? "—" : <span className="text-destructive">المرحلة غير محددة</span>}
                {" · "}
                {u.grade_id ? names?.grade[u.grade_id] ?? "—" : <span className="text-destructive">الصف غير محدد</span>}
              </p>
              {incomplete && <p className="text-[11px] text-destructive">ملف غير مكتمل — لا يمكن تفعيل السوبر حتى يختار الطالب مرحلته وصفه</p>}
              <p className="text-[11px] text-muted-foreground">
                {u.sub ? `سوبر من ${fmt(u.sub.starts_at)} حتى ${fmt(u.sub.expires_at)}` : "الخطة المجانية (Free)"}
              </p>
              <div className="flex gap-2">
                <button className={ghost} disabled={incomplete} onClick={() => { setTarget(u); setReqKey(crypto.randomUUID()); }}>
                  {u.sub ? "تمديد السوبر" : "تفعيل السوبر"}
                </button>
                {u.sub && (
                  <button className={cn(ghost, "text-destructive")} onClick={() => void cancel(u.id)}>
                    إلغاء / إرجاع إلى Free
                  </button>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------ Announcements ------------------------------ */

export function AdminAnnouncements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (!title.trim()) return;
    const { error } = await supabase.from("announcements").insert({ title, body, active: true });
    if (error) toast.error(error.message);
    else {
      setTitle("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2">
        <input className={input} placeholder="عنوان الإعلان" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={cn(input, "min-h-24")} placeholder="نص الإعلان" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className={btn} onClick={() => void add()}>
          <Plus className="ml-1 inline size-4" /> إرسال إعلان
        </button>
      </Card>
      {isLoading ? (
        <Spinner />
      ) : (
        (data ?? []).map((a) => (
          <Card key={a.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-[11px] text-muted-foreground">{a.body}</p>
            </div>
            <button
              className={ghost}
              onClick={async () => {
                await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
                void qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
              }}
            >
              {a.active ? <X className="size-3.5" /> : <Check className="size-3.5" />}
            </button>
          </Card>
        ))
      )}
    </div>
  );
}

/* -------------------------------- Referrals -------------------------------- */

export function AdminReferrals() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id,code_used,status,created_at,activated_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
  if (isLoading) return <Spinner />;
  return (
    <div className="flex flex-col gap-2">
      {(data ?? []).map((r) => (
        <Card key={r.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold">{r.code_used}</span>
          <span className="text-muted-foreground">{r.status === "active" ? "مفعّلة" : "قيد الانتظار"}</span>
          <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</span>
        </Card>
      ))}
      {(data ?? []).length === 0 && <p className="text-xs text-muted-foreground">لا توجد إحالات بعد.</p>}
    </div>
  );
}

/* -------------------------------- Settings -------------------------------- */

export function AdminSettings({ keys }: { keys: { key: string; label: string; hint?: string }[] }) {
  const { data, isLoading } = useSettingsMap();
  const save = useSaveSetting();
  const [local, setLocal] = useState<Record<string, string>>({});

  if (isLoading) return <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      {keys.map(({ key, label, hint }) => {
        const value = local[key] ?? (data?.[key] ?? "").replace(/^"|"$/g, "");
        return (
          <Card key={key} className="flex flex-col gap-2">
            <p className="text-xs font-bold">{label}</p>
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
            <input className={input} value={value} onChange={(e) => setLocal((s) => ({ ...s, [key]: e.target.value }))} />
            <button
              className={ghost}
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  { key, value: /^\d+$/.test(value) ? Number(value) : value },
                  { onSuccess: () => toast.success("تم الحفظ"), onError: (e) => toast.error((e as Error).message) },
                )
              }
            >
              حفظ
            </button>
          </Card>
        );
      })}
    </div>
  );
}
