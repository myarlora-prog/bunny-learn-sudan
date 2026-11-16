import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Facebook, Instagram, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { SOCIAL_PLATFORMS, cleanSocialLinks, validSocialUrl, type SocialLinks, type SocialPlatform } from "@/lib/social-links";

function TikTokIcon({ className }: { className?: string | undefined }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.49c-1.39.17-2.73-.11-4.03-.61a9.07 9.07 0 0 1-3.3-1.86c-.07 2.99.01 5.98-.03 8.97a6.63 6.63 0 0 1-1.89 3.74c-1.32 1.27-3.11 1.9-4.9 1.8a6.7 6.7 0 0 1-4.62-2.36A6.58 6.58 0 0 1 1.99 15.4c.16-2.07 1.28-4.03 3.09-5.09 1.23-.72 2.64-1.04 4.06-1.03v4.65c-.5-.16-1.04-.27-1.6-.24-1.14.06-2.29.71-2.92 1.68a4.28 4.28 0 0 0 .29 4.91c.63.74 1.55 1.2 2.51 1.3 1.01.1 2.1-.25 2.84-.98.68-.67 1.04-1.6 1.06-2.51C11.4 12.07 11.43 6.04 11.4.02h1.13Z" /></svg>;
}

function PlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  if (platform === "instagram") return <Instagram className={className} aria-hidden />;
  if (platform === "facebook") return <Facebook className={className} aria-hidden />;
  return <TikTokIcon className={className} />;
}

function useSocialLinks(enabled = true) {
  return useQuery({
    queryKey: ["social-links"],
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", "social_links").maybeSingle();
      if (error) throw error;
      return cleanSocialLinks(data?.value);
    },
  });
}

export function StudentSocialLinks() {
  const { data = {} } = useSocialLinks();
  const available = SOCIAL_PLATFORMS.filter(({ id }) => Boolean(data[id]));
  if (!available.length) return null;
  return (
    <Card className="mt-3" aria-labelledby="follow-us-title">
      <h2 id="follow-us-title" className="text-center text-sm font-bold">تابعنا</h2>
      <div className="mt-3 flex items-center justify-center gap-4">
        {available.map(({ id, label }) => (
          <a key={id} href={data[id]} target="_blank" rel="noreferrer" aria-label={`نوابغ على ${label}`} className="press flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <PlatformIcon platform={id} className="size-6" />
          </a>
        ))}
      </div>
    </Card>
  );
}

export function AdminSocialSettings() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const { data = {}, isLoading, isError } = useSocialLinks(isAdmin);
  const [links, setLinks] = useState<SocialLinks>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setLinks(data), [data]);

  const save = async () => {
    for (const { id, label } of SOCIAL_PLATFORMS) {
      if (!validSocialUrl(id, links[id] ?? "")) {
        toast.error(`رابط ${label} غير صالح. استخدم رابط https الرسمي للمنصة.`);
        return;
      }
    }
    setBusy(true);
    const clean = Object.fromEntries(SOCIAL_PLATFORMS.map(({ id }) => [id, links[id]?.trim() ?? ""]));
    const { error } = await supabase.rpc("admin_save_social_links", { _links: clean });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("Invalid") ? "تحقق من روابط المنصات الرسمية" : "تعذّر حفظ الروابط");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["social-links"] });
    toast.success("تم حفظ روابط التواصل");
  };

  if (isLoading) return <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />;
  if (isError) return <p className="text-sm text-destructive">تعذّر تحميل الروابط الحالية.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">أضف روابط حسابات نوابغ الرسمية فقط. اترك الحقل فارغًا أو احذف الرابط لإخفاء المنصة عن الطلاب.</p>
      {SOCIAL_PLATFORMS.map(({ id, label }) => (
        <Card key={id}>
          <label htmlFor={`social-${id}`} className="flex items-center gap-2 text-sm font-bold"><PlatformIcon platform={id} className="size-5 text-primary" />{label}</label>
          <div className="mt-3 flex gap-2">
            <input id={`social-${id}`} dir="ltr" type="url" inputMode="url" value={links[id] ?? ""} onChange={(event) => setLinks((old) => ({ ...old, [id]: event.target.value }))} placeholder={`https://${id}.com/...`} className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 py-2.5 text-left text-sm outline-none focus:border-primary" />
            <Button type="button" size="icon" variant="outline" aria-label={`حذف رابط ${label}`} title={`حذف رابط ${label}`} disabled={!links[id]} onClick={() => setLinks((old) => ({ ...old, [id]: "" }))}><Trash2 /></Button>
          </div>
        </Card>
      ))}
      <Button type="button" disabled={busy} onClick={() => void save()} className="rounded-2xl">{busy ? <Loader2 className="animate-spin" /> : <Save />}حفظ الروابط</Button>
    </div>
  );
}
