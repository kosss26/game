import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/actions/players";
import { PlayerCard } from "@/components/admin/PlayerCard";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const detail = await getPlayer(userId).catch(() => null);
  if (!detail) notFound();
  return <PlayerCard detail={detail} />;
}
