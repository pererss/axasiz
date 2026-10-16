import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkTask, ensureUser, tasksForGift } from "@/lib/logic";

export async function POST(req: NextRequest) {
  const { user, error } = await auth(req);
  if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
  const { taskId, action } = await req.json().catch(() => ({}));
  if (!taskId) return NextResponse.json({ ok: false, error: "no-task" }, { status: 400 });
  const u = await ensureUser(user.tgId, user);
  const all = await db.tasks();
  const t = all.find((x) => x.id === taskId);
  if (!t || !t.enabled) return NextResponse.json({ ok: false, error: "task-off" }, { status: 400 });

  if (action === "click") {
    u.clicked[taskId] = Date.now();
    await db.saveUser(u);
    return NextResponse.json({ ok: true, clicked: true });
  }

  // verify — real server-side check
  const r = await checkTask(u, t);
  if (r.done) {
    const wasWaiting = u.waitingStatus === "violated";
    u.done[taskId] = Date.now();
    // if violated and now all membership restored → restart waiting automatically
    const tasks = tasksForGift(all, u.selectedGiftId);
    const settings = await db.settings();
    const allDone = tasks.length > 0 && tasks.every((x) => u.done[x.id]);
    if (wasWaiting && allDone) {
      // re-check everything before restart
      const { revalidate } = await import("@/lib/logic");
      const { violation } = await revalidate(u, tasks);
      if (!violation) {
        const days = settings.waitingDays || 7;
        u.waitingStartedAt = Date.now();
        u.waitingEndsAt = Date.now() + days * 86400000;
        u.waitingStatus = "waiting";
        u.violationNote = "";
      }
    }
    await db.saveUser(u);
    const inviteCount = t.kind === "invite" ? await db.inviteCount(u.tgId) : undefined;
    return NextResponse.json({ ok: true, done: true, inviteCount });
  }
  const inviteCount = t.kind === "invite" ? await db.inviteCount(u.tgId) : undefined;
  return NextResponse.json({ ok: false, done: false, message: r.message, inviteCount });
}
