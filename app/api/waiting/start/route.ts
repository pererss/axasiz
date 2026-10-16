import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureUser, tasksForGift } from "@/lib/logic";

export async function POST(req: NextRequest) {
  const { user, error } = await auth(req);
  if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
  const u = await ensureUser(user.tgId, user);
  if (!u.selectedGiftId) return NextResponse.json({ ok: false, error: "no-gift" }, { status: 400 });
  const all = await db.tasks();
  const settings = await db.settings();
  const tasks = tasksForGift(all, u.selectedGiftId);
  const allDone = tasks.length > 0 && tasks.every((t) => u.done[t.id]);
  if (!allDone) return NextResponse.json({ ok: false, error: "tasks-incomplete" }, { status: 400 });
  if (!u.waitingStartedAt || u.waitingStatus === "idle" || u.waitingStatus === "violated") {
    const days = settings.waitingDays || 7;
    u.waitingStartedAt = Date.now();
    u.waitingEndsAt = Date.now() + days * 86400000;
    u.waitingStatus = "waiting";
    u.violationNote = "";
    await db.saveUser(u);
  }
  return NextResponse.json({ ok: true, waitingStartedAt: u.waitingStartedAt, waitingEndsAt: u.waitingEndsAt });
}
