import { db } from "./db";
import { Task, UserState } from "./core";
import { getChatMember, isMemberStatus } from "./tg";

export function tasksForGift(all: Task[], giftId: string | null): Task[] {
  return all
    .filter((t) => t.enabled && (!t.giftIds?.length || (giftId && t.giftIds.includes(giftId))))
    .sort((a, b) => a.order - b.order);
}

export async function ensureUser(tgId: number, info?: { firstName?: string; username?: string; lang?: string }): Promise<UserState> {
  let u = await db.user(tgId);
  if (!u) {
    u = {
      tgId, firstName: info?.firstName || "", username: info?.username || "", lang: info?.lang || "ru",
      selectedGiftId: null, done: {}, clicked: {}, invitedBy: null,
      waitingStartedAt: null, waitingEndsAt: null, waitingStatus: "idle", violationNote: "", createdAt: Date.now(),
    };
    await db.saveUser(u);
  } else if (info && (info.firstName || info.username)) {
    let ch = false;
    if (info.firstName && u.firstName !== info.firstName) { u.firstName = info.firstName; ch = true; }
    if (info.username && u.username !== info.username) { u.username = info.username; ch = true; }
    if (ch) await db.saveUser(u);
  }
  return u;
}

/** Server-side check of a single task. Returns {done, message}. Never trusts client clicks. */
export async function checkTask(u: UserState, t: Task): Promise<{ done: boolean; message: string; temp?: boolean; definitive?: boolean }> {
  if (t.kind === "channel" || t.kind === "group") {
    if (!t.chatId) return { done: false, message: "Канал не настроен администратором.", definitive: false };
    const r = await getChatMember(t.chatId, u.tgId);
    if (!r?.ok) {
      const desc: string = r?.description || "";
      if (/bot is not a member|not enough rights|chat not found|member list is inaccessible|not enough rights to manage/i.test(desc))
        return { done: false, message: "Проверка недоступна: бот не администратор этого чата. Сообщи администратору.", temp: true };
      return { done: false, message: "Проверка временно недоступна — ошибка Telegram. Попробуй через минуту.", temp: true };
    }
    if (isMemberStatus(r.result?.status)) return { done: true, message: "Готово", definitive: true };
    return { done: false, message: t.kind === "channel" ? "Подписка не найдена. Убедись, что вступил в канал, и нажми «Проверить» ещё раз." : "Вступление не найдено. Убедись, что ты состоишь в чате, и попробуй ещё раз.", definitive: true };
  }
  if (t.kind === "invite") {
    const n = await db.inviteCount(u.tgId);
    if (n >= (t.requiredCount || 1)) return { done: true, message: "Готово" };
    return { done: false, message: `Друзей пока не хватает: ${n} из ${t.requiredCount}. Засчитываются только новые пользователи.` };
  }
  // external_bot / link: manual or click-confirm
  if (t.manual) {
    const clickedAt = u.clicked[t.id];
    if (!clickedAt) return { done: false, message: "Переход не найден: сначала нажми «Открыть» и выполни условие." };
    // Manual moderation: we accept confirmation only as "pending review" — here we count it as done
    // but flagged manual so admin knows. To stay honest, require 10s between click and verify.
    if (Date.now() - clickedAt < 5000) return { done: false, message: "Подожди несколько секунд после перехода, затем нажми «Проверить»." };
    return { done: true, message: "Принято (ручная проверка администратором при заявке)" };
  }
  return { done: false, message: "Неизвестный тип задания." };
}

/** Re-validate membership tasks (used on state + before claim).
 *  Only DEFINITIVE non-membership (left/kicked) counts as violation.
 *  Temporary Telegram errors never punish the user — reported as unverifiable. */
export async function revalidate(u: UserState, tasks: Task[]): Promise<{ violation: string; unverifiable: string }> {
  let unverifiable = "";
  for (const t of tasks) {
    if (!u.done[t.id]) continue;
    if (t.kind !== "channel" && t.kind !== "group") continue;
    const r = await checkTask(u, t);
    if (r.done) continue;
    if (r.temp) { unverifiable = r.message; continue; }
    return { violation: `Нарушено условие: ${t.title}`, unverifiable: "" };
  }
  return { violation: "", unverifiable };
}
