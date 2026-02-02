import { AdminNav } from "@/components/admin/AdminNav";

// Админка открыта, но кнопка видна только админам на клиенте
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-tg-bg">
      <AdminNav userName="Admin" role="admin" />
      <main className="pb-20">
        {children}
      </main>
    </div>
  );
}
