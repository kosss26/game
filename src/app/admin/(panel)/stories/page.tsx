import Link from "next/link";
import { getStudioCatalog } from "@/lib/actions/admin";
import { StudioCatalog } from "@/components/admin/StudioCatalog";
import { StudioHeading } from "@/components/admin/StudioUI";
export default async function StoriesListPage() {
  const stories = await getStudioCatalog();
  return (
    <div className="studio-page">
      <StudioHeading
        eyebrow="Библиотека"
        title="Ваши истории"
        description="От первого сообщения до последней развилки."
        action={
          <Link href="/admin/stories/new" className="studio-button">
            <span aria-hidden="true">＋</span>Новая история
          </Link>
        }
      />
      <StudioCatalog stories={stories} />
    </div>
  );
}
