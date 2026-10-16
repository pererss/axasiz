import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureUser, revalidate, tasksForGift } from "@/lib/logic";

export async function GET(req: NextRequest) {
  const { user, error } = await auth(req);
  if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
  const u = await ensureUser(user.tgId, user);
  const [gifts, allTasks, settings] = await Promise.all([db.gifts(), db.tasks(), db.settings()]);
  const gift = gifts.find((g) => g.id === u.selectedGiftId) || null;
  const tasks = tasksForGift(allTasks, u.selectedGiftId);
  // periodic revalidation when waiting
  const now = Date.now();
  if (u.waitingStatus === "waiting" && u.waitingEndsAt) {
    if (now >= u.waitingEndsAt) {
      const { violation } = await revalidate(u, tasks);
      if (violation) { u.waitingStatus = "violated"; u.violationNote = violation; }
      else { u.waitingStatus = "ready"; u.violationNote = ""; }
      await db.saveUser(u);
    } else if (Math.random() < 0.35) {
      // lightweight periodic check (~each 3rd open); temp errors never punish
      const { violation } = await revalidate(u, tasks);
      if (violation) { u.waitingStatus = "violated"; u.violationNote = violation; await db.saveUser(u); }
    }
  }
  // recovery: if previously violated but all membership restored → restart period
  if (u.waitingStatus === "violated") {
    const { violation, unverifiable } = await revalidate(u, tasks);
    if (!violation && !unverifiable) {
      const settings = await db.settings();
      const days = settings.waitingDays || 7;
      u.waitingStartedAt = Date.now();
      u.waitingEndsAt = Date.now() + days * 86400000;
      u.waitingStatus = "waiting";
      u.violationNote = "";
      await db.saveUser(u);
    } else if (violation) {
      u.violationNote = violation;
      await db.saveUser(u);
    }
  }
  const inviteCounts: Record<string, number> = {};
  for (const t of tasks) if (t.kind === "invite") inviteCounts[t.id] = await db.inviteCount(u.tgId);
  const doneCount = tasks.filter((t) => u.done[t.id]).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const botUsername = process.env.BOT_USERNAME || "";
  const miniApp = process.env.MINI_APP_URL || "";
  const refLink = botUsername ? `https://t.me/${botUsername}?start=ref_${u.tgId}` : (miniApp ? `${miniApp}?startapp=ref_${u.tgId}` : "");
  return NextResponse.json({
    ok: true,
    serverNow: Date.now(),
    user: u,
    gifts: gifts.filter((g) => g.enabled),
    allGifts: gifts,
    gift,
    tasks,
    doneCount,
    total: tasks.length,
    allDone,
    inviteCounts,
    settings,
    refLink,
    isAdmin: (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => s.trim()).includes(String(u.tgId)),
  });
}
