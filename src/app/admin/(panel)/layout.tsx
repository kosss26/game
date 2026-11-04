import { redirect } from "next/navigation";
import { hasAdminAccess } from "@/lib/auth/session";
import { isLocalDb } from "@/lib/config";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAdminAccess())) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-tg-bg">
      <AdminNav />
      {isLocalDb() && (
        <div className="bg-yellow-500/10 px-4 py-2 text-center text-xs text-yellow-300">
          Демо-режим: локальная база .data/local-db.json (Supabase не настроен)
        </div>
      )}
      <main className="mx-auto max-w-3xl pb-20">{children}</main>
    </div>
  );
}
