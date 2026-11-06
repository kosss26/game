import { HomeScreen } from "@/components/screens/HomeScreen";

// A fresh launch document must not point to a previous deployment's JS chunks.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <HomeScreen />;
}
