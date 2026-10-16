export async function botApi(method: string, body: any) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN missing");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getChatMember(chatId: string, userId: number) {
  const token = process.env.BOT_TOKEN;
  if (!token) return { ok: false, error: "no-token" };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`
    );
    const j = await res.json();
    return j;
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export function isMemberStatus(status?: string) {
  return status === "creator" || status === "administrator" || status === "member" || status === "restricted";
}

export async function sendMessage(chatId: number, text: string, extra: any = {}) {
  return botApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}
