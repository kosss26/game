"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHome, type CatalogItem, type HomeView } from "@/lib/actions/player";
import { useApp } from "@/lib/telegram/TelegramProvider";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { Brand, ErrorState } from "@/components/ui/States";
import { Countdown } from "@/components/ui/Countdown";
import { chaptersLabel, plural } from "@/lib/utils/plural";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

/** История, которую игрок сейчас проходит (последняя, в которую он играл) */
function pickContinue(items: CatalogItem[]): CatalogItem | null {
  const active = items.filter(i => (i.status === "in_progress" || i.status === "waiting") && i.lastPlayedAt);
  active.sort((a, b) => (b.lastPlayedAt || "").localeCompare(a.lastPlayedAt || ""));
  return active[0] || null;
}

export function HomeScreen() {
  const { ready, token, session, authError, retryAuth, share } = useApp();
  const [home, setHome] = useState<HomeView | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    getHome(token)
      .then(setHome)
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  const user = session?.user && !session.user.is_guest ? session.user : null;
  const items = home?.items || null;
  const cont = items ? pickContinue(items) : null;
  const featured = cont || items?.[0] || null;
  const rest = items?.filter(i => i.id !== featured?.id) || [];

  const onShare = () => {
    if (!home?.shareLink) return;
    const top = items?.find(i => i.isNew) || items?.[0];
    share(home.shareLink, top?.meta.share_text || "Истории, которые происходят в переписке. Попробуй — первая глава бесплатно 🌙");
  };

  return (
    <main className="min-h-[100dvh] bg-ink pb-safe">
      <header className="px-5 pb-2 pt-safe">
        <div className="flex items-center justify-between pt-4">
          <Brand size="sm" />
          <div className="flex items-center gap-2">
            {session?.isAdmin && (
              <Link href="/admin" className="chip bg-white/[0.07] text-fg/80">
                <Icon name="settings" size={13} /> Студия
              </Link>
            )}
            <Link
              href="/profile"
              aria-label="Профиль"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/[0.07] text-fg/85 ring-1 ring-white/10 active:scale-95"
            >
              {user?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
              ) : user?.first_name ? (
                <span className="text-[14px] font-semibold">{user.first_name.slice(0, 1).toUpperCase()}</span>
              ) : (
                <Icon name="user" size={18} />
              )}
            </Link>
          </div>
        </div>
        <h1 className="mt-6 font-display text-[28px] font-bold leading-tight tracking-tight text-fg">
          {greeting()}
          {user ? `, ${user.first_name}` : ""}.
        </h1>
        <p className="mt-1 text-[15px] text-muted">{cont ? "Вас ждут в переписке." : "Кто-то уже набирает вам сообщение."}</p>
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
            {featured && (
              <>
                <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
                  {cont ? "Продолжить" : featured.isNew ? "Новинка" : "Рекомендуем"}
                </h2>
                <FeaturedCard item={featured} />
              </>
            )}
            {rest.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">{cont ? "Все истории" : "Ещё истории"}</h2>
                <div className="space-y-3">
                  {rest.map(it => (
                    <RowCard key={it.id} item={it} />
                  ))}
                </div>
              </section>
            )}
            {!home?.isGuest && home?.shareLink ? (
              <section className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-accent/20 via-accent/[0.07] to-transparent p-5 ring-1 ring-accent/25">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/25 text-white">
                    <Icon name="gift" size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-fg">Играть вместе интереснее</p>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                      Отправьте другу ссылку — потом сравните, кто до какой концовки дошёл.
                    </p>
                  </div>
                </div>
                <button className="btn-primary mt-4 w-full" onClick={onShare}>
                  <Icon name="share" size={17} /> Поделиться с другом
                </button>
              </section>
            ) : null}
          </>
        )}
      </div>

      <footer className="mt-10 px-5 pb-8 text-center text-[12px] text-faint">
        <Link href="/legal" className="underline-offset-2 hover:underline">
          Условия и конфиденциальность
        </Link>
      </footer>
    </main>
  );
}

function ctaFor(it: CatalogItem): { label: string; icon: "play" | "clock" | "check" } {
  switch (it.status) {
    case "new":
      return { label: "Начать историю", icon: "play" };
    case "in_progress":
      return { label: `Продолжить · Глава ${it.nextDay ?? ""}`, icon: "play" };
    case "waiting":
      return { label: it.nextDay ? `Глава ${it.nextDay} скоро` : "Продолжение скоро", icon: "clock" };
    case "finished":
      return { label: "Пройдено — открыть", icon: "check" };
    default:
      return { label: "Скоро", icon: "clock" };
  }
}

/** Короткий статус для карточки: «Глава 2 из 5», «Пройдено · концовки 3 из 7» */
function statusLine(it: CatalogItem): string {
  if (it.status === "finished") return it.endingsTotal ? `Пройдено · концовки ${it.endingsFound} из ${it.endingsTotal}` : "Пройдено";
  if (it.status === "in_progress" && it.nextDay) return `Глава ${it.nextDay} из ${it.totalDays}`;
  if (it.status === "waiting" && it.nextDay) return `Глава ${it.nextDay} из ${it.totalDays} · скоро`;
  const parts = [chaptersLabel(it.totalDays)];
  if (it.minutesPerDay) parts.push(`по ~${it.minutesPerDay} мин`);
  if (it.endingsTotal) parts.push(`${it.endingsTotal} ${plural(it.endingsTotal, "концовка", "концовки", "концовок")}`);
  return parts.join(" · ");
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

function NewBadge() {
  return <span className="chip bg-accent text-white shadow-glow">Новая</span>;
}

function FeaturedCard({ item }: { item: CatalogItem }) {
  const cta = ctaFor(item);
  return (
    <Link href={`/story/${item.id}`} className="grain relative block overflow-hidden rounded-[32px] shadow-card ring-1 ring-white/[0.06] active:scale-[0.99] transition">
      <div className="relative h-[430px]">
        <CoverArt style={item.cover_style} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-1.5">
          {item.isNew && <NewBadge />}
          {item.meta.genre && <span className="chip bg-black/40 text-white/90 backdrop-blur">{item.meta.genre}</span>}
          <span className="chip bg-black/40 text-white/90 backdrop-blur">{chaptersLabel(item.totalDays)}</span>
          {item.meta.age_rating && <span className="chip bg-black/40 text-white/90 backdrop-blur">{item.meta.age_rating}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="font-display text-[30px] font-bold leading-[1.1] tracking-tight text-white">{item.title}</h2>
          {item.meta.tagline && <p className="mt-2 text-[15px] leading-snug text-white/75">{item.meta.tagline}</p>}
          <div className="mt-4">
            <Progress it={item} />
            {item.status !== "new" && <p className="mt-2 text-[12.5px] font-medium text-white/70">{statusLine(item)}</p>}
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
  const progress = item.status === "in_progress" || item.status === "waiting";
  const done = item.status === "finished";
  return (
    <Link href={`/story/${item.id}`} className="card flex items-center gap-4 p-3 active:scale-[0.99] transition">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
        <CoverArt style={item.cover_style} className="h-full w-full" />
        {done && (
          <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ok text-white shadow">
            <Icon name="check" size={14} strokeWidth={2.6} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[16px] font-semibold text-fg">{item.title}</p>
          {item.isNew && <span className="chip shrink-0 bg-accent/90 px-2 py-0.5 text-[11px] text-white">Новая</span>}
        </div>
        <p className="line-clamp-2 text-[13px] text-muted">{item.meta.tagline || item.description}</p>
        {progress && (
          <div className="mt-1.5 flex max-w-[160px] items-center gap-0.5">
            {Array.from({ length: item.totalDays }, (_, i) => (
              <span key={i} className={`h-[3px] flex-1 rounded-full ${i < item.completedDays ? "bg-accent" : "bg-white/15"}`} />
            ))}
          </div>
        )}
        <p className={`mt-1 text-[12px] font-medium ${done ? "text-ok" : progress ? "text-accent" : "text-faint"}`}>{statusLine(item)}</p>
      </div>
      <Icon name="chevron" className="shrink-0 text-faint" />
    </Link>
  );
}
