import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { stepCurriculumJob, type JobResult } from "@/lib/curriculum-ai.functions";
import type { WorkItem } from "@/lib/curriculum-ai-utils";
import { Button } from "./ui/button";

export function CurriculumAiJob({ id, onReview }: {id:string;onReview:(results:JobResult[])=>void}) {
  const step=useServerFn(stepCurriculumJob); const cache=useQueryClient();
  const stop=useRef(false); const [running,setRunning]=useState(false);
  const job=useQuery({queryKey:["curriculum-ai-job",id],refetchInterval:running?2000:false,queryFn:async()=>{const {data,error}=await supabase.from("curriculum_ai_jobs").select("*").eq("id",id).single();if(error)throw error;return data;}});
  const run=async()=>{
    if(running)return;stop.current=false;setRunning(true);
    try {
      const {error}=await supabase.from("curriculum_ai_jobs").update({status:"ready",pause_reason:null}).eq("id",id).is("lease_until",null);if(error)throw error;
      for(let n=0;n<5000&&!stop.current;n++) {
        const fresh=await job.refetch();if(!fresh.data)throw new Error("تعذر تحميل العمل");
        const items=fresh.data.items as unknown as WorkItem[];
        if(fresh.data.cursor>=items.length||fresh.data.status==="cancelled")break;
        const response=await step({data:{id}});if(response.busy)throw new Error("هناك معالجة جارية؛ انتظر اكتمالها ثم استأنف");
      }
      const final=await job.refetch();if(final.data?.status==="review")onReview(final.data.results as unknown as JobResult[]);
    }catch(e){toast.error(e instanceof Error?e.message:"توقفت المعالجة؛ النتائج محفوظة");}
    finally{setRunning(false);await cache.invalidateQueries({queryKey:["curriculum-ai-jobs"]});}
  };
  const change=async(status:"paused"|"cancelled")=>{stop.current=true;const {error}=await supabase.from("curriculum_ai_jobs").update({status}).eq("id",id);if(error)toast.error("تعذر إيقاف العمل");await job.refetch();};
  if(job.isError)return <p className="text-destructive">تعذر تحميل العملية <Button onClick={()=>void job.refetch()}>إعادة المحاولة</Button></p>;
  if(!job.data)return <Loader2 className="animate-spin"/>;
  const items=job.data.items as unknown as WorkItem[];
  const completed=items.slice(0,job.data.cursor);
  const lessons=new Set(items.map((i)=>i.lessonId??i.title)); const done=new Set(completed.filter((i)=>i.part===i.parts).map((i)=>i.lessonId??i.title));
  const units=new Set(items.map((i)=>i.unitId).filter(Boolean));const doneUnits=[...units].filter((u)=>items.filter((i)=>i.unitId===u).every((i)=>completed.includes(i))).length;
  return <section className="flex flex-col gap-2 border-y border-border py-3">
    <progress aria-label="تقدم معالجة المنهج" className="h-2 w-full accent-primary" value={job.data.cursor} max={items.length||1}/>
    <p role="status" className="text-sm">الدروس: {done.size} مكتملة · {lessons.size-done.size} متبقية · الوحدات: {doneUnits}/{units.size}</p>
    <p className="text-xs text-muted-foreground">{items[job.data.cursor]?.title??"النتائج جاهزة للمراجعة"}</p>
    {job.data.pause_reason&&<p className="text-sm text-destructive">{job.data.pause_reason}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={running||job.data.status==="cancelled"||job.data.cursor>=items.length} onClick={()=>void run()}><Play/>استكمال من آخر نقطة</Button>
      <Button variant="outline" disabled={!running} onClick={()=>void change("paused")}><Pause/>إيقاف</Button>
      <Button variant="ghost" onClick={()=>void change("cancelled")}><X/>إلغاء العملية</Button>
      <Button variant="outline" onClick={()=>onReview(job.data.results as unknown as JobResult[])}>معاينة النتائج المكتملة</Button>
    </div>
  </section>;
}