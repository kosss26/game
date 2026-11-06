import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { miniAppLink } from "@/lib/telegram/bot";
import {
  INVITE_TITLE,
  INVITE_DESCRIPTION,
  INVITE_IMAGE,
  INVITE_PUBLIC_IMAGE,
  isInviteCode,
  publicInvitationUrl,
} from "@/lib/invitations";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ code: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  if (!isInviteCode(code)) notFound();
  const url = publicInvitationUrl(config.appUrl, code);
  const image = INVITE_PUBLIC_IMAGE;
  return {
    title: INVITE_TITLE,
    description: INVITE_DESCRIPTION,
    robots: { index: false, follow: false },
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website",
      locale: "ru_RU",
      title: INVITE_TITLE,
      description: INVITE_DESCRIPTION,
      ...(url ? { url } : {}),
      ...(image
        ? {
            images: [
              {
                url: image,
                width: 1200,
                height: 632,
                alt: "Полночь. У каждой истории — твой финал",
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: INVITE_TITLE,
      description: INVITE_DESCRIPTION,
      ...(image ? { images: [image] } : {}),
    },
  };
}
export default async function InvitationPage({ params }: Props) {
  const { code } = await params;
  if (!isInviteCode(code)) notFound();
  return (
    <main className="library-shell invitation-page">
      <div className="invitation-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={INVITE_IMAGE}
          width={1200}
          height={632}
          alt="Полночь. У каждой истории — твой финал"
          fetchPriority="high"
        />
      </div>
      <div className="invitation-content">
        <p className="invitation-eyebrow">Приглашение от друга</p>
        <h1>
          История начинается
          <br />с сообщения
        </h1>
        <p>Персонажи напишут первыми. Ты ответишь — и изменишь ход событий.</p>
        <p>
          Выбери свой сюжет и пройди его своим путём. Потом сравните ваши
          финалы.
        </p>
        <a href={miniAppLink(code)} className="invitation-open">
          Открыть истории в Telegram <span aria-hidden="true">↗</span>
        </a>
        <span className="invitation-note">
          Сохраняй прогресс и возвращайся, когда захочешь
        </span>
      </div>
      <footer className="invitation-footer">
        <a href="/legal">Условия и конфиденциальность</a>
      </footer>
    </main>
  );
}
