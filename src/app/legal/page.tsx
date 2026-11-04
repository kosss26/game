import Link from "next/link";

export const metadata = { title: "Условия и конфиденциальность — Полночь" };

const UPDATED = "4 ноября 2026";

export default function LegalPage() {
  return (
    <main className="min-h-[100dvh] bg-ink px-5 pb-16 pt-safe">
      <div className="mx-auto max-w-2xl pt-6">
        <Link href="/" className="text-[14px] text-accent">
          ← Назад
        </Link>
        <h1 className="mt-4 font-display text-[28px] font-bold text-fg">Условия и конфиденциальность</h1>
        <p className="mt-1 text-[13px] text-faint">Редакция от {UPDATED}. Шаблон — согласуйте с юристом перед запуском.</p>

        <Section title="1. О сервисе">
          «Полночь» — развлекательное приложение с интерактивными художественными историями внутри Telegram. Все персонажи и события вымышлены; любые совпадения случайны.
        </Section>

        <Section title="2. Возрастные ограничения">
          Возрастная маркировка указана на обложке каждой истории. Истории с маркировкой 16+ и 18+ содержат сцены, неподходящие для детей.
        </Section>

        <Section title="3. Какие данные мы обрабатываем">
          Идентификатор Telegram, имя, username и язык интерфейса (передаются Telegram при открытии приложения); прогресс в историях, сделанные выборы и введённое в историях имя; сведения о покупках (без платёжных данных — оплата проходит внутри Telegram). Данные используются только для работы приложения: сохранения прогресса, статистики выборов в обезличенном виде и уведомлений о новых главах.
        </Section>

        <Section title="4. Уведомления">
          Бот присылает сообщение, когда открывается новый день истории. Отключить уведомления можно, остановив или заблокировав бота.
        </Section>

        <Section title="5. Покупки">
          Цифровые товары (досрочное открытие дня, сезонный пропуск) оплачиваются Telegram Stars и предоставляются сразу после оплаты. Возврат возможен по запросу в течение 14 дней, если открытый контент не был прочитан: команда /paysupport в боте.
        </Section>

        <Section title="6. Удаление данных">
          Чтобы удалить аккаунт и прогресс, напишите в поддержку через бота. Удаление выполняется в течение 30 дней.
        </Section>

        <Section title="7. Контакты">Поддержка: команда /paysupport в боте приложения.</Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{children}</p>
    </section>
  );
}
