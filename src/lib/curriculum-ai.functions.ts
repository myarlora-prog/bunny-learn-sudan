import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiComplete } from "./gemini.server";
import { allocatedCount, retainsSource, toWorkItems, type CurriculumSourceLesson, type WorkItem } from "./curriculum-ai-utils";
import { uniqueQuestions, validQuestion, type ExamQuestion } from "./exam-types";
import { splitExamSource } from "./exam-utils";
import type { Json } from "@/integrations/supabase/types";

export const loadCurriculumSource = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: owner } = await context.supabase.rpc("is_admin"); if (!owner) throw new Error("Forbidden");
    const { data: units, error } = await context.supabase.from("units").select("id,title,lessons(id,title,sort_order,lesson_content(explanation,summary,key_points,key_terms,review_material),flashcards(front,back),quiz_questions(question))").eq("subject_id", data.subjectId).order("sort_order");
    if (error) throw error;
    const lessons: CurriculumSourceLesson[] = [];
    for (const unit of units ?? []) for (const lesson of [...unit.lessons].sort((a,b) => a.sort_order-b.sort_order)) {
      const c = lesson.lesson_content;
      lessons.push({ id: lesson.id, title: lesson.title, unitId: unit.id, unitTitle: unit.title, explanation: c?.explanation ?? "", original: c?.explanation ?? "", supporting: c ? `${c.summary}\n${JSON.stringify(c.key_points)}\n${JSON.stringify(c.key_terms)}\n${c.review_material}\n${lesson.flashcards.map((f) => `${f.front}: ${f.back}`).join("\n")}` : "", previous: lesson.quiz_questions.map((q) => q.question) });
    }
    // The oldest revision is the preserved original; the live row is the latest approved explanation.
    for (let i=0;i<lessons.length;i+=50) {
      const subset=lessons.slice(i,i+50);
      const { data: revisions, error: revisionError } = await context.supabase.from("lesson_content_revisions").select("lesson_id,explanation,created_at").in("lesson_id",subset.map((l)=>l.id)).order("created_at");
      if (revisionError) throw revisionError;
      for (const l of subset) l.original=revisions?.find((r)=>r.lesson_id===l.id)?.explanation ?? l.explanation;
    }
    const { data: exams, error: examError } = await context.supabase.from("subject_exams").select("questions").eq("subject_id",data.subjectId);
    if (examError) throw examError;
    const previous=(exams??[]).flatMap((e)=>Array.isArray(e.questions)?e.questions.filter(validQuestion).map((q)=>q.q):[]);
    return { lessons, previous };
  });

const jobInput=z.object({ subjectId:z.string().uuid(), kind:z.enum(["exam","format"]), scope:z.enum(["subject","units","lessons","text","file"]), selected:z.array(z.string().uuid()), text:z.string().default(""), count:z.number().int().positive().nullable(), types:z.array(z.string()).default(["choice"]) });
export const startCurriculumJob=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator((input)=>jobInput.parse(input)).handler(async({data,context})=>{
  const {data:owner}=await context.supabase.rpc("is_admin"); if(!owner) throw new Error("Forbidden");
  // Invoke the authenticated reader with the current request's bearer middleware.
  const {data:subject,error:subjectError}=await context.supabase.from("subjects").select("id,name").eq("id",data.subjectId).single();
  if(subjectError || !subject) throw new Error("المادة غير متوفرة");
  let items:WorkItem[]=[]; let previous:string[]=[];
  if(data.scope==="text" || data.scope==="file") {
    if(data.text.trim().length<20) throw new Error("أضف نصًا واضحًا وكافيًا لإنشاء الأسئلة");
    const chunks=splitExamSource(data.text,12000); items=chunks.map((text,i)=>({lessonId:null,unitId:null,title:subject.name,text,original:text,part:i+1,parts:chunks.length}));
  } else {
    const {data:units,error}=await context.supabase.from("units").select("id,title,lessons(id,title,sort_order,lesson_content(explanation,summary,key_points,key_terms,review_material),flashcards(front,back),quiz_questions(question))").eq("subject_id",data.subjectId).order("sort_order");
    if(error) throw error;
    const lessons:CurriculumSourceLesson[]=[];
    for(const u of units??[]) for(const l of [...u.lessons].sort((a,b)=>a.sort_order-b.sort_order)) {
      if(data.scope==="units"&&!data.selected.includes(u.id) || data.scope==="lessons"&&!data.selected.includes(l.id)) continue;
      const c=l.lesson_content;
      if(!c?.explanation.trim()) throw new Error(`شرح الدرس يحتاج إلى استكمال: ${l.title}`);
      lessons.push({id:l.id,title:l.title,unitId:u.id,unitTitle:u.title,explanation:c.explanation,original:c.explanation,supporting:`${c.summary}\n${JSON.stringify(c.key_points)}\n${JSON.stringify(c.key_terms)}\n${c.review_material}\n${l.flashcards.map((f)=>`${f.front}: ${f.back}`).join("\n")}`,previous:l.quiz_questions.map((q)=>q.question)});
    }
    for(let i=0;i<lessons.length;i+=50) {
      const {data:revisions,error:e}=await context.supabase.from("lesson_content_revisions").select("lesson_id,explanation").in("lesson_id",lessons.slice(i,i+50).map((l)=>l.id)).order("created_at"); if(e) throw e;
      for(const l of lessons.slice(i,i+50)) l.original=revisions?.find((r)=>r.lesson_id===l.id)?.explanation??l.explanation;
    }
    items=toWorkItems(lessons,data.kind); previous=lessons.flatMap((l)=>l.previous);
  }
  if(!items.length) throw new Error("لا يوجد محتوى تعليمي في النطاق المحدد");
  if(data.kind==="exam"&&data.count!==null&&data.count<items.length) throw new Error(`لتغطية النطاق كله اختر ${items.length} سؤالًا على الأقل أو العدد الذكي`);
  const {data:exams,error:examError}=await context.supabase.from("subject_exams").select("questions").eq("subject_id",data.subjectId); if(examError) throw examError;
  previous.push(...(exams??[]).flatMap((e)=>Array.isArray(e.questions)?e.questions.filter(validQuestion).map((q)=>q.q):[]));
  const {data:job,error}=await context.supabase.from("curriculum_ai_jobs").insert({owner_id:context.userId,subject_id:data.subjectId,kind:data.kind,items:items as unknown as Json,settings:{count:data.count,types:data.types,previous,subject:subject.name}}).select("id").single();
  if(error) throw error; return job;
 });

export type JobResult={item:number;lessonId:string|null;title:string;html?:string;questions?:ExamQuestion[];issues:string[]};
export const stepCurriculumJob=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator((input)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
  const {data:owner}=await context.supabase.rpc("is_admin"); if(!owner) throw new Error("Forbidden");
  const {data:claimed,error:claimError}=await context.supabase.rpc("claim_curriculum_ai_job",{_id:data.id});
  if(claimError) throw claimError; if(!claimed) return {busy:true};
  const {data:job,error}=await context.supabase.from("curriculum_ai_jobs").select("*").eq("id",data.id).single(); if(error) throw error;
  const items=job.items as unknown as WorkItem[]; const results=job.results as unknown as JobResult[];
  const settings=job.settings as {count:number|null;types:string[];previous:string[];subject:string};
  const item=items[job.cursor];
  if(!item){await context.supabase.from("curriculum_ai_jobs").update({status:"review",lease_until:null}).eq("id",job.id);return {busy:false};}
  try {
    const avoid=[...settings.previous,...results.flatMap((r)=>r.questions?.map((q)=>q.q)??[])];
    const count=allocatedCount(items,job.cursor,settings.count);
    const instruction=job.kind==="format" ? `أعد JSON فقط {"html":"..."}. نسق النص ككتاب عربي RTL باستخدام p,h2,h3,strong,ul,ol,li,blockquote,mark. أضف عناوين وإيموجي تعليمية فقط. حافظ على جميع كلمات المصدر بالترتيب نفسه حرفيًا، وكل الأرقام والقوانين والأمثلة والتعدادات. لا تختصر ولا تحذف ولا تعيد صياغة ولا تخترع. التصحيح الإملائي اقتراح منفصل لا تغيّر كلمات المصدر.` : `أنشئ أسئلة مستندة حصريًا للمصدر الأساسي المرفق. المصادر المساعدة لا تتجاوز الشرح. نوّع الصعوبة وغطّ كامل هذا الجزء. ${count===null?"استخرج أكبر عدد ممكن من الأسئلة الجيدة المختلفة، ثم توقف عند نفاد المعلومات دون تكرار مصطنع":`المطلوب حتى ${count} سؤالًا دون اختراع إن لم يكف المصدر`}. الأنواع المطلوبة: ${settings.types.join(",")}. أعد JSON {"questions":[{"type":"choice","q":"...","options":["..."],"correct":0,"hint":"تفسير","answer":"","acceptedAnswers":[],"difficulty":"medium"}],"issues":[]}. choice له 4 خيارات، true_false خياران صح وخطأ، الأنواع blank,direct,definition,comparison,enumeration,application,connection لها options:[] وcorrect:0 وanswer نموذج إجابة كامل وacceptedAnswers صيغ مقبولة. لا تكرر الأسئلة السابقة.`;
    const ai=await aiComplete({json:true,messages:[{role:"system",content:instruction},{role:"user",content:`المادة: ${settings.subject}\n${item.title}\nالجزء ${item.part}/${item.parts}\nأسئلة سابقة لتجنب التكرار: ${avoid.slice(-300).join("\n")}\nالمصدر:\n${item.text}`}]});
    if(!ai.ok) throw new Error(`AI_STATUS_${ai.status}`);
    const parsed:unknown=JSON.parse(ai.content.replace(/^```json\s*/i,"").replace(/```\s*$/,""));
    if(!parsed||typeof parsed!=="object") throw new Error("استجابة غير صالحة");
    const value=parsed as {html?:unknown;questions?:unknown;issues?:unknown};
    const result:JobResult={item:job.cursor,lessonId:item.lessonId,title:item.title,issues:Array.isArray(value.issues)?value.issues.map(String):[]};
    if(job.kind==="format") {
      if(typeof value.html!=="string"||!retainsSource(item.text,value.html)) throw new Error("لم يجتز التنسيق فحص المحافظة على كلمات المصدر؛ لم يتغير الشرح");
      result.html=value.html;
    } else {
      if(!Array.isArray(value.questions)) throw new Error("استجابة أسئلة غير صالحة");
      const generated=uniqueQuestions(value.questions.filter(validQuestion).map((q)=>({...q,lessonId:item.lessonId??undefined}))).filter((q)=>!avoid.some((a)=>a.trim()===q.q.trim()));
      result.questions=count===null?generated:generated.slice(0,count);
      if(!result.questions.length) result.issues.push("لم يتوفر سؤال جديد موثوق لهذا الجزء؛ يحتاج مراجعة التغطية");
    }
    const next=job.cursor+1;
    const {error:saveError}=await context.supabase.from("curriculum_ai_jobs").update({results:[...results,result] as unknown as Json,cursor:next,status:next===items.length?"review":"ready",lease_until:null,pause_reason:null,updated_at:new Date().toISOString()}).eq("id",job.id);
    if(saveError) throw saveError; return {busy:false};
  } catch(e) {
    const reason=e instanceof Error?e.message:"تعذر إكمال المعالجة";
    const {error:pauseError}=await context.supabase.from("curriculum_ai_jobs").update({status:"paused",pause_reason:reason,lease_until:null}).eq("id",job.id);
    if(pauseError) throw pauseError; throw new Error(reason.includes("AI_STATUS")?"توقفت المعالجة بسبب تعذر خدمة الذكاء الاصطناعي؛ النتائج السابقة محفوظة، استأنف بعد معالجة السبب":reason);
  }
 });