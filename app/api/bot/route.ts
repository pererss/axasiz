import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/logic";
import { botApi, sendMessage } from "@/lib/tg";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret)
      return NextResponse.json({ ok: false }, { status: 403 });
    const update = await req.json().catch(() => null);
    if (!update?.message) return NextResponse.json({ ok: true });
    const msg = update.message;
    const chatId = msg.chat?.id;
    const text: string = msg.text || "";
    const from = msg.from || {};
    if (!chatId || !from.id) return NextResponse.json({ ok: true });

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const payload = (parts[1] || "").trim();
      const u = await ensureUser(Number(from.id), { firstName: from.first_name, username: from.username, lang: from.language_code });
      if (payload.startsWith("ref_")) {
        const inviter = Number(payload.replace("ref_", ""));
        if (inviter && inviter !== u.tgId && !u.invitedBy) {
          const added = await db.addReferral(inviter, u.tgId);
          if (added) {
            u.invitedBy = inviter;
            await db.saveUser(u);
            try { await sendMessage(inviter, `🎉 Новый друг присоединился по твоей ссылке!`); } catch {}
          }
        }
      }
      const settings = await db.settings();
      const miniApp = process.env.MINI_APP_URL || "";
      // Exact greeting text (never append task/star/condition mentions here)
      const welcome = settings.welcomeText || "🎁 Твой подарок уже ждёт!\n\nВыбирай свой 👇";
      const photo = (settings.welcomePhoto || "").trim();
      const kb = { inline_keyboard: [[{ text: "🎁 Выбрать подарок", web_app: { url: miniApp } }]] };
      try {
        if (miniApp && photo) {
          // Photo with caption (caption limit 4096/1024 — our text is tiny, fits safely)
          await botApi("sendPhoto", { chat_id: chatId, photo, caption: welcome, reply_markup: kb });
        } else if (miniApp) {
          await sendMessage(chatId, `${welcome}`, { reply_markup: kb });
        } else {
          await sendMessage(chatId, `${welcome}\n\n<i>Mini App URL пока не настроен (MINI_APP_URL).</i>`);
        }
      } catch { /* Telegram send failed — referral already recorded, still ack 200 */ }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "Telegram webhook endpoint. POST updates here." });
}
