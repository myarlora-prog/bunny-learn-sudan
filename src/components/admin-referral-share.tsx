import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { buildReferralMessage, cleanReferralShare, DEFAULT_REFERRAL_SHARE, validAppUrl, type ReferralShareSettings } from "@/lib/referral-share";

export function AdminReferralShare() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReferralShareSettings>(DEFAULT_REFERRAL_SHARE);
  const [busy, setBusy] = useState(false);
  const settings = useQuery({
    queryKey: ["referral-share-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", "referral_share").maybeSingle();
      if (error) throw error;
      return cleanReferralShare(data?.value);
    },
  });
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);

  const save = async () => {
    if (!form.message.trim()) { toast.error("اكتب نص رسالة الدعوة"); return; }
    if (!validAppUrl(form.url)) { toast.error("أدخل رابط تطبيق صحيحًا يبدأ بـ https://"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_save_referral_share", { _message: form.message, _app_url: form.url });
    setBusy(false);
    if (error) { toast.error("تعذّر حفظ رسالة الدعوة؛ تحقق من النص والرابط"); return; }
    await queryClient.invalidateQueries({ queryKey: ["referral-share-settings"] });
    toast.success("تم حفظ رسالة الدعوة وظهرت النسخة الجديدة للمستخدمين");
  };

  if (settings.isLoading) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />;
  if (settings.isError) return <p className="text-sm text-destructive">تعذّر تحميل رسالة الدعوة الحالية.</p>;
  const preview = buildReferralMessage(form, "SAQRO-ABC123");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <label htmlFor="referral-message" className="text-sm font-bold">نص رسالة الدعوة</label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">اكتب أي صيغة تريدها. استخدم {"{code}"} لمكان كود الطالب و{"{link}"} لمكان رابط التطبيق؛ يُضافان تلقائيًا إذا حُذفا.</p>
        <textarea id="referral-message" value={form.message} onChange={(event) => setForm((old) => ({ ...old, message: event.target.value }))} maxLength={4000} className="mt-3 min-h-44 w-full rounded-2xl border border-border bg-background p-3 text-sm leading-relaxed" />
        <label htmlFor="referral-app-url" className="mt-4 block text-sm font-bold">رابط التطبيق</label>
        <input id="referral-app-url" type="url" dir="ltr" inputMode="url" value={form.url} onChange={(event) => setForm((old) => ({ ...old, url: event.target.value }))} className="mt-2 w-full rounded-2xl border border-border bg-background p-3 text-left text-sm" />
        <Button type="button" disabled={busy} onClick={() => void save()} className="mt-4 w-full rounded-2xl">{busy ? <Loader2 className="animate-spin" /> : <Save />}حفظ رسالة الدعوة</Button>
      </Card>
      <Card>
        <h3 className="text-sm font-bold">معاينة الرسالة</h3>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{preview}</p>
        <a href={form.url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-bold text-primary underline" dir="ltr">{form.url}</a>
      </Card>
    </div>
  );
}
