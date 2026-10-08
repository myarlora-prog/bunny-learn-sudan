import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2, Upload, Check, X, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { processBook } from "@/lib/admin-ai.functions";
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

  const process = useMutation({
    mutationFn: async () => {
      setErrorMsg("");
      if (!subjectId) throw new Error("اختر المادة أولًا");
      if (!hasSource) throw new Error("ارفع ملفًا أو الصق نص الكتاب");

      let text = pasted.trim();
      let sourceName = sourceTitle.trim() || "نص ملصوق";
      if (file) {
        setStep("قراءة الملف…");
        const fileText = await extractText(file);
        text = text ? `${text}\n\n${fileText}` : fileText;
        sourceName = sourceTitle.trim() || file.name;
      }
      if (text.trim().length < 50)
        throw new Error("لم نتمكن من قراءة نص كافٍ (قد يكون الملف صورًا ممسوحة — الصق النص يدويًا)");

      if (file) {
        setStep("رفع الكتاب…");
        // Storage keys must be ASCII-safe; Arabic names/spaces are rejected.
        const ext = file.name.toLowerCase().endsWith(".txt") ? "txt" : "pdf";
        const path = `${subjectId}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("curriculum-books").upload(path, file);
        if (!up.error) {
          await supabase.from("curriculum_files").insert({
            grade_id: gradeId,
            subject_id: subjectId,
            file_name: file.name,
            file_path: path,
            status: "processing",
          });
        } else {
          console.warn("Book file upload failed, continuing with text:", up.error.message);
        }
      }

      setStep("تحليل الكتاب بالذكاء الاصطناعي… (قد يستغرق دقيقة)");
      const result = await run({ data: { text, subjectName, gradeName } });

      setStep("حفظ المسودة…");
      const { error } = await supabase.from("curriculum_drafts").insert({
        stage_id: stageId,
        grade_id: gradeId,
        subject_id: subjectId,
        source_name: sourceName,
        source_text: text.slice(0, 200000),
        content: { units: result.units } as never,
        flags: result.flags as never,
        status: "draft",
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (r) => {
      setStep("");
      setFile(null);
      setPasted("");
      setSourceTitle("");
      if (fileRef.current) fileRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`تم استخراج ${r.units.length} وحدة — راجعها في المسودات`);
    },
    onError: (e) => {
      setStep("");
      const msg = (e as Error)?.message || "حدث خطأ غير متوقع";
      console.error("Book processing failed:", e);
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

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
        <span className="flex-1 text-sm">{file ? file.name : "ارفع ملف PDF أو TXT"}</span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
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

      <button className={btn} disabled={process.isPending || !hasSource || !subjectId} onClick={() => process.mutate()}>
        {process.isPending ? step || "جارٍ المعالجة…" : "معالجة الكتاب بالذكاء الاصطناعي"}
      </button>
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
        await publishDraft({ ...draft, ...loc, content });
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

      <div className="flex gap-2">
        <button className={btn} disabled={busy} onClick={() => void save(false)}>
          <Check className="ml-1 inline size-4" /> حفظ المسودة
        </button>
        <button className={ghost} disabled={busy} onClick={() => void save(true)}>
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
  const [days, setDays] = useState("30");

  async function grant(userId: string, gradeId: string | null) {
    if (!gradeId) {
      toast.error("الطالب لم يختر صفًا بعد");
      return;
    }
    const expires = new Date(Date.now() + Number(days || 30) * 86400000).toISOString();
    const { error } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, grade_id: gradeId, plan: "super", status: "active", expires_at: expires });
    if (error) toast.error(error.message);
    else {
      toast.success("تم تفعيل السوبر");
      void refetch();
    }
  }

  async function cancel(userId: string) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) toast.error(error.message);
    else {
      toast.success("تم الإلغاء");
      void refetch();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input className={input} placeholder="ابحث عن طالب" value={search} onChange={(e) => setSearch(e.target.value)} />
      <input className={input} placeholder="عدد الأيام" value={days} onChange={(e) => setDays(e.target.value)} />
      {isLoading ? (
        <Spinner />
      ) : (
        (data ?? []).map((u) => (
          <Card key={u.id} className="flex flex-col gap-2">
            <p className="text-sm font-bold">{u.display_name || u.email}</p>
            <p className="text-[11px] text-muted-foreground">
              {u.sub ? `سوبر حتى ${new Date(u.sub.expires_at).toLocaleDateString("ar")}` : "الخطة المجانية"}
            </p>
            <div className="flex gap-2">
              <button className={ghost} onClick={() => void grant(u.id, u.grade_id)}>
                تفعيل / تمديد
              </button>
              {u.sub && (
                <button className={cn(ghost, "text-destructive")} onClick={() => void cancel(u.id)}>
                  إلغاء
                </button>
              )}
            </div>
          </Card>
        ))
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
