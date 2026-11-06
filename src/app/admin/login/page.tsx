"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/actions/auth";
import { Icon } from "@/components/ui/Icon";
import "../studio.css";
export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="studio-login">
      <form
        className="studio-login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await adminLogin(password).catch(() => ({ ok: false }));
          setBusy(false);
          if (res.ok) {
            router.push("/admin");
            router.refresh();
          } else setError("Не удалось войти. Проверьте пароль и соединение.");
        }}
      >
        <div className="studio-brand">
          <span className="studio-brand-mark">
            <Icon name="moon" size={24} />
          </span>
          <span>
            <strong>Полночь</strong>
            <small>СТУДИЯ ИСТОРИЙ</small>
          </span>
        </div>
        <h1>За каждой историей — вы</h1>
        <p>
          Войдите, чтобы продолжить работу
          <br />
          над своими историями.
        </p>
        <label htmlFor="studio-password">Пароль студии</label>
        <div className="studio-password">
          <input
            id="studio-password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            disabled={busy}
          />
          <button
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? "Скрыть" : "Показать"}
          </button>
        </div>
        {error && (
          <p role="alert" className="studio-error mt-3">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="studio-button"
          disabled={busy || !password}
        >
          {busy ? "Проверяем…" : "Войти в студию"}
          <Icon name="forward" size={17} />
        </button>
        <p className="studio-login-hint">
          Если ваш Telegram-профиль имеет доступ к студии, откройте её из
          профиля в приложении.
        </p>
      </form>
    </main>
  );
}
