import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureUser, revalidate, tasksForGift } from "@/lib/logic";

export async function GET(req: NextRequest) {
  const { user, error } = await auth(req);
  if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
  const u = await ensureUser(user.tgId, user);
  const [all, settings, gifts] = await Promise.all([db.tasks(), db.settings(), db.gifts()]);
  const tasks = tasksForGift(all, u.selectedGiftId);
  const gift = gifts.find((g) => g.id === u.selectedGiftId) || null;
  const now = Date.now();
  let eligible = false;
  let reason = "";
  let remainingMs = u.waitingEndsAt ? Math.max(0, u.waitingEndsAt - now) : 0;

  if (!u.selectedGiftId) reason = "Выбери подарок.";
  else if (!tasks.every((t) => u.done[t.id])) reason = "Выполни все задания.";
  else if (!u.waitingEndsAt || u.waitingStatus === "idle") reason = "Нажми «Перейти к ожиданию».";
  else if (u.waitingStatus === "violated") reason = u.violationNote || "Условия нарушены. Восстанови подписки — период начнётся заново.";
  else if (now < u.waitingEndsAt) reason = "Период ожидания ещё не завершён.";
  else {
    const { violation, unverifiable } = await revalidate(u, tasks);
    if (violation) {
      u.waitingStatus = "violated"; u.violationNote = violation;
      await db.saveUser(u);
      reason = violation + ". Восстанови участие — период начнётся заново.";
    } else if (unverifiable) {
      reason = "Не удалось перепроверить подписки: " + unverifiable;
    } else {
      if (u.waitingStatus !== "ready") { u.waitingStatus = "ready"; await db.saveUser(u); }
      eligible = true;
    }
  }

  let claimUrl = "";
  let claimText = "";
  if (eligible) {
    if (!settings.claimUsername) {
      eligible = false;
      reason = "Администратор пока не указал Telegram-профиль для заявок.";
    } else {
      claimText = `Здравствуйте! Я хочу получить награду «${gift?.name || ""}» стоимостью ${gift?.stars || 0} ⭐. Я выполнил(а) все задания и прошёл(ла) семидневное ожидание.`;
      claimUrl = `https://t.me/${settings.claimUsername.replace("@", "")}?text=${encodeURIComponent(claimText)}`;
    }
  }
  return NextResponse.json({ ok: true, serverNow: now, eligible, reason, remainingMs, waitingEndsAt: u.waitingEndsAt, claimUrl, claimText, status: u.waitingStatus, violationNote: u.violationNote });
}
