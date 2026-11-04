import "server-only";
import { db } from "@/lib/supabase/server";
import type { PurchaseProduct } from "@/lib/types/database";

export interface InvoicePayload {
  product: PurchaseProduct;
  storyId: string;
  dayNumber: number | null;
  userId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/** payload ≤ 128 байт: "skip_day|<story>|<day>|<user>" */
export function encodePayload(p: InvoicePayload): string {
  return [p.product, p.storyId, p.dayNumber ?? 0, p.userId].join("|");
}

export function decodePayload(raw: string): InvoicePayload | null {
  const [product, storyId, day, userId] = (raw || "").split("|");
  if ((product !== "skip_day" && product !== "season_pass") || !isUuid(storyId) || !isUuid(userId)) return null;
  const dayNumber = parseInt(day, 10);
  if (product === "skip_day" && !(dayNumber > 0)) return null;
  return { product, storyId, dayNumber: product === "skip_day" ? dayNumber : null, userId };
}

/** Идемпотентная выдача покупки (повторный webhook не создаст дубль) */
export async function grantPurchase(
  p: InvoicePayload,
  opts: { stars: number; chargeId: string | null; source: "stars" | "credit" | "gift" }
): Promise<boolean> {
  const supabase = await db();
  const row = {
    user_id: p.userId,
    story_id: p.storyId,
    product: p.product,
    day_number: p.dayNumber,
    stars: opts.stars,
    source: opts.source,
    telegram_charge_id: opts.chargeId,
  };
  if (opts.chargeId) {
    const { error } = await supabase.from("purchases").upsert(row, { onConflict: "telegram_charge_id", ignoreDuplicates: true });
    return !error;
  }
  const { error } = await supabase.from("purchases").insert(row);
  return !error;
}
