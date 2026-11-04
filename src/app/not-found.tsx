import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-ink px-8 text-center">
      <p className="font-display text-[64px] font-bold text-white/10">404</p>
      <h1 className="text-[19px] font-semibold text-fg">Абонент недоступен</h1>
      <p className="mt-2 text-[15px] text-muted">Такой страницы нет. Возможно, ссылка устарела.</p>
      <Link href="/" className="btn-primary mt-6">
        На главную
      </Link>
    </main>
  );
}
