"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCatalog, type CatalogItem } from "@/lib/actions/player";
import { useApp } from "@/lib/telegram/TelegramProvider";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { Brand, ErrorState } from "@/components/ui/States";
import { Countdown } from "@/components/ui/Countdown";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export function HomeScreen() {
  const { ready, token, session, authError, retryAuth } = useApp();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    getCatalog(token)
      .then(setItems)
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  const name = session?.user && !session.user.is_guest ? session.user.first_name : null;
  const featured = items?.[0];
  const rest = items?.slice(1) || [];

  return (
    <main className="min-h-[100dvh] bg-ink pb-safe">
      <header className="px-5 pb-2 pt-safe">
        <div className="flex items-center justify-between pt-4">
          <Brand size="sm" />
          {session?.isAdmin && (
            <Link href="/admin" className="chip bg-white/[0.07] text-fg/80">
              <Icon name="settings" size={13} /> Студия
            </Link>
          )}
        </div>
        <h1 className="mt-6 font-display text-[28px] font-bold leading-tight tracking-tight text-fg">
          {greeting()}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-1 text-[15px] text-muted">Кто-то уже набирает вам сообщение.</p>
      </header>

      <div className="px-4 pt-4">
        {authError ? (
          <ErrorState title="Не удалось войти" text="Проверьте соединение." action={retryAuth} />
        ) : failed ? (
          <ErrorState title="Нет соединения" text="Не получилось загрузить истории." action={load} />
        ) : !items ? (
          <div className="space-y-4">
            <div className="skeleton h-[430px] rounded-[32px]" />
            <div className="skeleton h-28 rounded-3xl" />
          </div>
        ) : items.length === 0 ? (
          <ErrorState icon="moon" title="Историй пока нет" text="Первая глава готовится к выходу. Загляните позже." />
        ) : (
          <>
            {featured && <FeaturedCard item={featured} />}
            {rest.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">Ещё истории</h2>
                <div className="space-y-3">
                  {rest.map(it => (
                    <RowCard key={it.id} item={it} />
                  ))}
                </div>
              </section>
            )}
            <section className="mt-8 rounded-3xl border border-dashed border-white/10 p-5 text-center">
              <Icon name="sparkle" className="mx-auto text-accent" />
              <p className="mt-2 text-[15px] font-medium text-fg">Новые истории каждый месяц</p>
              <p className="mt-1 text-[13.5px] text-muted">Включите уведомления бота, чтобы не пропустить.</p>
            </section>
          </>
        )}
      </div>

      <footer className="mt-10 px-5 pb-8 text-center text-[12px] text-faint">
        <Link href="/legal" className="underline-offset-2 hover:underline">
          Условия и конфиденциальность
        </Link>
        <span className="mx-2">·</span>
        <span>18+ контент отмечен на обложке</span>
      </footer>
    </main>
  );
}

function ctaFor(it: CatalogItem): { label: string; icon: "play" | "clock" | "check" } {
  switch (it.status) {
    case "new":
      return { label: "Начать историю", icon: "play" };
    case "in_progress":
      return { label: `Продолжить · День ${it.nextDay ?? ""}`, icon: "play" };
    case "waiting":
      return { label: it.nextDay ? `День ${it.nextDay} скоро` : "Продолжение скоро", icon: "clock" };
    case "finished":
      return { label: "Пройдено — открыть", icon: "check" };
    default:
      return { label: "Скоро", icon: "clock" };
  }
}

function Progress({ it }: { it: CatalogItem }) {
  if (it.totalDays === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: it.totalDays }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full ${i < it.completedDays ? "bg-white" : "bg-white/20"}`} />
      ))}
    </div>
  );
}

function FeaturedCard({ item }: { item: CatalogItem }) {
  const cta = ctaFor(item);
  return (
    <Link href={`/story/${item.id}`} className="grain relative block overflow-hidden rounded-[32px] shadow-card ring-1 ring-white/[0.06] active:scale-[0.99] transition">
      <div className="relative h-[430px]">
        <CoverArt style={item.cover_style} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-1.5">
          {item.meta.genre && <span className="chip bg-black/40 text-white/90 backdrop-blur">{item.meta.genre}</span>}
          <span className="chip bg-black/40 text-white/90 backdrop-blur">{item.totalDays} дней</span>
          {item.meta.age_rating && <span className="chip bg-black/40 text-white/90 backdrop-blur">{item.meta.age_rating}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="font-display text-[30px] font-bold leading-[1.1] tracking-tight text-white">{item.title}</h2>
          {item.meta.tagline && <p className="mt-2 text-[15px] leading-snug text-white/75">{item.meta.tagline}</p>}
          <div className="mt-4">
            <Progress it={item} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="btn-primary min-h-[46px] flex-1">
              <Icon name={cta.icon} size={16} />
              {cta.label}
            </span>
          </div>
          {item.status === "waiting" && item.unlocksAt && (
            <p className="mt-2 text-center text-[13px] text-white/60">
              Откроется через <Countdown until={item.unlocksAt} compact />
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function RowCard({ item }: { item: CatalogItem }) {
  const cta = ctaFor(item);
  return (
    <Link href={`/story/${item.id}`} className="card flex items-center gap-4 p-3 active:scale-[0.99] transition">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
        <CoverArt style={item.cover_style} className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-fg">{item.title}</p>
        <p className="line-clamp-2 text-[13px] text-muted">{item.meta.tagline || item.description}</p>
        <p className="mt-1 text-[12px] font-medium text-accent">{cta.label}</p>
      </div>
      <Icon name="chevron" className="shrink-0 text-faint" />
    </Link>
  );
}
