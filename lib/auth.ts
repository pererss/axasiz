import { NextRequest } from "next/server";
import { validateInitData } from "@/lib/core";

export interface AuthedUser { tgId: number; firstName: string; username: string; lang: string; }

export async function auth(req: NextRequest): Promise<{ user: AuthedUser | null; error?: string }> {
  const initData =
    req.headers.get("x-telegram-init-data") ||
    req.nextUrl.searchParams.get("initData") ||
    "";
  const token = process.env.BOT_TOKEN || "";
  if (initData && token) {
    const v = validateInitData(initData, token);
    if (v.ok && v.user?.id) {
      return { user: { tgId: Number(v.user.id), firstName: v.user.first_name || "", username: v.user.username || "", lang: v.user.language_code || "ru" } };
    }
    // fallthrough to dev only if validation failed AND dev allowed? No — reject to prevent spoofing.
    return { user: null, error: `auth-failed:${v.reason}` };
  }
  // Dev fallback (local testing only)
  if (process.env.ALLOW_DEV_AUTH === "true") {
    const q = req.nextUrl.searchParams;
    const tgId = Number(q.get("tg_id") || req.headers.get("x-dev-tg-id") || 0);
    if (tgId > 0) return { user: { tgId, firstName: "Dev", username: "dev", lang: "ru" } };
  }
  return { user: null, error: "no-auth" };
}
