import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Проверка живости для Docker / мониторинга: приложение + доступ к БД */
export async function GET() {
  try {
    const supabase = await db();
    const { error } = await supabase.from("stories").select("id").limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
