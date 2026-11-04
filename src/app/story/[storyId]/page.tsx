import { StoryScreen } from "@/components/screens/StoryScreen";

export default async function StoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  return <StoryScreen storyId={storyId} />;
}
