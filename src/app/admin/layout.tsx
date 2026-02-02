import { redirect } from "next/navigation";
import { getCurrentUser, isUserAdmin, getUserAdminRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

// Hardcoded админы по Telegram ID
const HARDCODED_ADMIN_TELEGRAM_IDS = [1763619724];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/");
  }

  // Проверяем по hardcoded списку ИЛИ по БД
  const isHardcodedAdmin = HARDCODED_ADMIN_TELEGRAM_IDS.includes(user.telegram_id);
  const isDbAdmin = await isUserAdmin(user.id).catch(() => false);
  
  if (!isHardcodedAdmin && !isDbAdmin) {
    redirect("/");
  }

  const role = await getUserAdminRole(user.id).catch(() => null);

  return (
    <div className="min-h-screen bg-tg-bg">
      <AdminNav userName={user.first_name} role={isHardcodedAdmin ? "admin" : role} />
      <main className="pb-20">
        {children}
      </main>
    </div>
  );
}
