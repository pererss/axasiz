import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/logic";

export async function POST(req: NextRequest) {
  const { user, error } = await auth(req);
  if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });
  const { giftId } = await req.json().catch(() => ({}));
  const gifts = await db.gifts();
  const g = gifts.find((x) => x.id === giftId && x.enabled);
  if (!g) return NextResponse.json({ ok: false, error: "gift-not-found" }, { status: 400 });
  const u = await ensureUser(user.tgId, user);
  if (u.selectedGiftId !== giftId) {
    // switching gift resets waiting (tasks progress kept)
    u.selectedGiftId = giftId;
    u.waitingStartedAt = null; u.waitingEndsAt = null;
    if (u.waitingStatus !== "idle") u.waitingStatus = "idle";
    u.violationNote = "";
    await db.saveUser(u);
  }
  return NextResponse.json({ ok: true, selectedGiftId: giftId });
}
