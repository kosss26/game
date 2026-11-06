import { redirect } from "next/navigation";
import { hasAdminAccess } from "@/lib/auth/session";
import { isLocalDb } from "@/lib/config";
import { AdminNav } from "@/components/admin/AdminNav";
import "../studio.css";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasAdminAccess())) redirect("/admin/login");

  return (
    <div className="studio">
      <AdminNav />
      <div className="studio-workspace">
        {isLocalDb() && (
          <div className="studio-demo">
            Тестовая студия · изменения сохраняются только в локальной базе
          </div>
        )}
        <main id="studio-content" className="studio-main">
          {children}
        </main>
      </div>
    </div>
  );
}
