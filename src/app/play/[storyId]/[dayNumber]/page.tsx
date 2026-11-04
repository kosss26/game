import { notFound } from "next/navigation";
import { PlayScreen } from "@/components/screens/PlayScreen";

export default async function PlayPage({ params }: { params: Promise<{ storyId: string; dayNumber: string }> }) {
  const { storyId, dayNumber } = await params;
  const n = parseInt(dayNumber, 10);
  if (!Number.isInteger(n) || n < 1) notFound();
  return <PlayScreen storyId={storyId} dayNumber={n} />;
}
