import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, UserRound, Loader2 } from "lucide-react";
import { Bunny } from "@/components/bunny";
import { useApp } from "@/lib/app-state";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | بَني" },
      { name: "description", content: "سجّل الدخول أو أنشئ حسابًا جديدًا في بَني وابدأ رحلتك مع المنهج السوداني." },
      { property: "og:title", content: "تسجيل الدخول | بَني" },
      { property: "og:description", content: "ادخل إلى حسابك في بَني وتابع خطتك الدراسية." },
    ],
  }),
  component: AuthPage,
});

function Field({
  icon: Icon,
  ...props
}: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-[var(--shadow-soft)] focus-within:border-primary">
      <Icon className="size-5 shrink-0 text-primary" />
      <input
        {...props}
        className="h-13 w-full bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function arabicError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "هذا البريد مسجّل بالفعل، جرّب تسجيل الدخول";
  if (m.includes("password")) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
  if (m.includes("email")) return "تأكد من صحة البريد الإلكتروني";
  return "حدث خطأ، حاول مرة أخرى";
}

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { session, state, hydrated } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && hydrated) {
      void navigate({ to: state.gradeId ? "/home" : "/stage", replace: true });
    }
  }, [session, hydrated, state.gradeId, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: name || "طالب بَني" },
          },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(arabicError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch {
      setError("تعذّر الدخول عبر Google، حاول مرة أخرى");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 pb-10 pt-10">
      <div className="page-enter flex flex-col items-center text-center">
        <Bunny size={130} float priority />
        <h1 className="mt-3 text-2xl">{mode === "login" ? "مرحبًا بعودتك!" : "أنشئ حسابك"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login" ? "بَني في انتظارك لنكمل المذاكرة" : "دقيقة واحدة وتبدأ رحلتك التعليمية"}
        </p>
      </div>

      <div className="mt-6 flex rounded-2xl bg-secondary p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all",
              mode === m ? "bg-card text-primary shadow-[var(--shadow-soft)]" : "text-muted-foreground",
            )}
          >
            {m === "login" ? "تسجيل الدخول" : "حساب جديد"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        {mode === "signup" && (
          <Field icon={UserRound} placeholder="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <Field
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          icon={Lock}
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs font-bold text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="press gradient-hero mt-3 flex h-14 items-center justify-center gap-2 rounded-3xl text-base font-bold text-primary-foreground shadow-[var(--shadow-float)] disabled:opacity-70"
        >
          {busy && <Loader2 className="size-5 animate-spin" />}
          {mode === "login" ? "دخول" : "إنشاء الحساب"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> أو <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={google}
        className="press flex h-13 items-center justify-center gap-3 rounded-3xl border border-border bg-card py-3.5 text-sm font-bold shadow-[var(--shadow-soft)]"
      >
        <span className="text-lg">🔵</span> المتابعة عبر Google
      </button>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية الخاصة بتطبيق بَني.
      </p>
    </div>
  );
}
