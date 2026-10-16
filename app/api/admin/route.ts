import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/core";
import { db } from "@/lib/db";

async function guard(req: NextRequest) {
  const { user, error } = await auth(req);
  if (!user) return { err: NextResponse.json({ ok: false, error }, { status: 401 }) };
  if (!isAdmin(user.tgId)) return { err: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (g.err) return g.err;
  const [gifts, tasks, settings, users] = await Promise.all([db.gifts(), db.tasks(), db.settings(), db.users(200)]);
  const claimants = await db.claimants();
  const counts: Record<number, number> = {};
  for (const u of users) counts[u.tgId] = await db.inviteCount(u.tgId);
  return NextResponse.json({ ok: true, gifts, tasks, settings, users, claimants, counts, adminIds: (process.env.TELEGRAM_ADMIN_IDS || "") });
}

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (g.err) return g.err;
  const body = await req.json().catch(() => ({}));
  const { action, gift, task, settings, notify } = body;
  try {
    if (action === "save-gift" && gift) { await db.saveGift(gift); return NextResponse.json({ ok: true }); }
    if (action === "delete-gift" && gift?.id) { await db.deleteGift(gift.id); return NextResponse.json({ ok: true }); }
    if (action === "save-task" && task) { await db.saveTask(task); return NextResponse.json({ ok: true }); }
    if (action === "delete-task" && task?.id) { await db.deleteTask(task.id); return NextResponse.json({ ok: true }); }
    if (action === "save-settings" && settings) { await db.saveSettings(settings); return NextResponse.json({ ok: true }); }
    if (action === "notify" && notify) {
      const { sendMessage } = await import("@/lib/tg");
      const users = await db.users(1000);
      let sent = 0;
      const targets = notify.tgId ? users.filter((u) => u.tgId === Number(notify.tgId)) : users;
      for (const u of targets.slice(0, 100)) {
        try { await sendMessage(u.tgId, String(notify.text).slice(0, 1000)); sent++; } catch {}
        await new Promise((r) => setTimeout(r, 60));
      }
      return NextResponse.json({ ok: true, sent });
    }
    return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
