import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, UserRound } from "lucide-react";
import { Bunny } from "@/components/bunny";
import { useApp } from "@/lib/app-state";
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

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { update, state } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(state.name);
  const [email, setEmail] = useState(state.email);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update({ name: name || "طالب بَني", email });
    navigate({ to: state.gradeId ? "/home" : "/stage" });
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
            onClick={() => setMode(m)}
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
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field icon={Lock} type="password" required placeholder="كلمة المرور" />

        {mode === "login" && (
          <button type="button" className="self-start text-xs font-medium text-primary">
            نسيت كلمة المرور؟
          </button>
        )}

        <button
          type="submit"
          className="press gradient-hero mt-3 h-14 rounded-3xl text-base font-bold text-primary-foreground shadow-[var(--shadow-float)]"
        >
          {mode === "login" ? "دخول" : "إنشاء الحساب"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        بمتابعتك أنت توافق على شروط الاستخدام وسياسة الخصوصية الخاصة بتطبيق بَني.
      </p>
    </div>
  );
}
