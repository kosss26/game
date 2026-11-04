"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/actions/auth";
import { Brand } from "@/components/ui/States";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-ink px-6">
      <form
        className="w-full max-w-sm"
        onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await adminLogin(password).catch(() => ({ ok: false }));
          setBusy(false);
          if (res.ok) router.push("/admin");
          else setError("Неверный пароль");
        }}
      >
        <div className="mb-8 text-center">
          <Brand />
          <p className="mt-3 text-[15px] text-muted">Студия авторов</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Пароль администратора"
          autoFocus
          className="w-full rounded-2xl bg-raised px-4 py-3.5 text-fg ring-1 ring-white/10 placeholder:text-faint focus:outline-none focus:ring-accent"
        />
        {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}
        <button className="btn-primary mt-4 w-full" disabled={busy || !password}>
          {busy ? "Проверяем…" : "Войти"}
        </button>
        <p className="mt-6 text-center text-[13px] leading-relaxed text-faint">
          Администраторы из Telegram (ADMIN_TELEGRAM_IDS) входят автоматически, открыв приложение через бота.
        </p>
      </form>
    </main>
  );
}
