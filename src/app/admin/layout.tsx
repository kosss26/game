import { redirect } from "next/navigation";
import { getCurrentUser, isUserAdmin, getUserAdminRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/");
  }

  const isAdmin = await isUserAdmin(user.id);
  
  if (!isAdmin) {
    redirect("/");
  }

  const role = await getUserAdminRole(user.id);

  return (
    <div className="min-h-screen bg-tg-bg">
      <AdminNav userName={user.first_name} role={role} />
      <main className="pb-20">
        {children}
      </main>
    </div>
  );
}
