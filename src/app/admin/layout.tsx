import { redirect } from "next/navigation";
import { getCurrentUser, isUserAdmin, getUserAdminRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

// Telegram IDs которые имеют доступ к админке (hardcoded для надёжности)
const HARDCODED_ADMIN_IDS = [1763619724];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  // В dev режиме разрешаем доступ
  const isDev = process.env.NODE_ENV === "development";
  
  if (!user && !isDev) {
    redirect("/");
  }

  // Проверяем по hardcoded ID или по БД
  const isHardcodedAdmin = user && HARDCODED_ADMIN_IDS.includes(user.telegram_id);
  const isDbAdmin = user ? await isUserAdmin(user.id) : false;
  
  if (!isHardcodedAdmin && !isDbAdmin && !isDev) {
    redirect("/");
  }

  const role = user ? await getUserAdminRole(user.id) : null;
  const displayRole = isHardcodedAdmin ? "admin" : role;

  return (
    <div className="min-h-screen bg-tg-bg">
      <AdminNav userName={user?.first_name || "Dev"} role={displayRole} />
      <main className="pb-20">
        {children}
      </main>
    </div>
  );
}
