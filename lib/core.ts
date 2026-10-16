import crypto from "crypto";

// ---------- Types ----------
export interface Gift {
  id: string;
  name: string;
  stars: number;
  description: string;
  theme: string; // mint | lilac | peach | sky
  image?: string; // custom photo: /gifts/file.png or https://… (empty = default)
  frame?: { scale: number; x: number; y: number }; // photo framing (crop) from admin
  order: number;
  enabled: boolean;
}

export type TaskKind = "channel" | "group" | "invite" | "external_bot" | "link";
export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  description: string;
  url: string;
  chatId: string; // @channel or numeric id for getChatMember
  requiredCount: number; // for invite
  giftIds: string[]; // empty = all gifts
  order: number;
  enabled: boolean;
  manual: boolean; // true => needs manual moderation / click-confirm
}

export interface UserState {
  tgId: number;
  firstName: string;
  username: string;
  lang: string;
  selectedGiftId: string | null;
  done: Record<string, number>; // taskId -> completed at ms
  clicked: Record<string, number>;
  invitedBy: number | null;
  waitingStartedAt: number | null;
  waitingEndsAt: number | null;
  waitingStatus: "idle" | "waiting" | "violated" | "ready";
  violationNote: string;
  createdAt: number;
}

export interface ContentBlock {
  id: string;
  icon: string;
  title: string;
  text: string;
  style: string; // neon-blue | neon-pink | neon-green | neon-gold
  enabled: boolean;
  order: number;
}

export interface Settings {
  claimUsername: string; // without @
  waitingDays: number;
  welcomeText: string;
  welcomePhoto: string; // photo URL or Telegram file_id for /start greeting (empty = text only)
  rulesText: string;
  supportText: string;
  blocks: ContentBlock[];
}

// ---------- Defaults ----------
export function defaultGifts(): Gift[] {
  return [
    { id: "g15", name: "Мишка", stars: 15, description: "", theme: "mint", order: 1, enabled: true },
    { id: "g25", name: "Подарок", stars: 25, description: "", theme: "sky", order: 2, enabled: true },
    { id: "g50", name: "Торт", stars: 50, description: "", theme: "lilac", order: 3, enabled: true },
    { id: "g100", name: "Кольцо", stars: 100, description: "", theme: "peach", order: 4, enabled: true },
  ];
}

export function defaultTasks(): Task[] {
  return [
    { id: "t_channel", kind: "channel", title: "Подпишись на канал", description: "Перейди в канал и нажми «Подписаться». Затем вернись сюда — мы проверим выполнение.", url: "https://t.me/telegram", chatId: "@telegram", order: 1, enabled: true, manual: false, requiredCount: 0, giftIds: [] },
    { id: "t_group", kind: "group", title: "Вступи в чат", description: "Зайди в наш уютный чат и останься его участником до получения награды.", url: "https://t.me/telegram", chatId: "@telegram", order: 2, enabled: true, manual: false, requiredCount: 0, giftIds: [] },
    { id: "t_invite", kind: "invite", title: "Пригласи друзей", description: "Поделись своей ссылкой. Учитываются только новые пользователи, впервые запустившие бота.", url: "", chatId: "", order: 3, enabled: true, manual: false, requiredCount: 3, giftIds: [] },
    { id: "t_bot", kind: "external_bot", title: "Запусти партнёрский бот", description: "Открой бота-партнёра и нажми Start. Проверка — ручная модерация.", url: "https://t.me/BotFather", chatId: "", order: 4, enabled: true, manual: true, requiredCount: 0, giftIds: [] },
    { id: "t_link", kind: "link", title: "Открой ресурс", description: "Перейди по ссылке и вернись для подтверждения.", url: "https://telegram.org", chatId: "", order: 5, enabled: true, manual: true, requiredCount: 0, giftIds: [] },
  ];
}

export function defaultSettings(): Settings {
  return {
    claimUsername: "",
    waitingDays: 7,
    welcomeText: "🎁 Твой подарок уже ждёт!\n\nВыбирай свой 👇",
    welcomePhoto: "",
    rulesText: "Чтобы сохранить право на получение награды:\n• Не покидай каналы и группы, на которые подписался для участия.\n• Не блокируй бота и сохраняй возможность получать сообщения от него.\n• Соблюдай все условия участия до подачи заявки.",
    supportText: "Остались вопросы? Напиши нам — поможем на каждом этапе.",
    blocks: [],
  };
}

// ---------- initData validation (per Telegram docs) ----------
export function validateInitData(initData: string, botToken: string): { ok: boolean; user?: any; reason?: string } {
  try {
    if (!initData || !botToken) return { ok: false, reason: "missing" };
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { ok: false, reason: "no-hash" };
    params.delete("hash");
    const pairs: string[] = [];
    Array.from(params.keys()).sort().forEach((k) => pairs.push(`${k}=${params.get(k)}`));
    const dataCheckString = pairs.join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calc = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
    if (calc !== hash) return { ok: false, reason: "bad-hash" };
    // optional auth_date freshness (24h)
    const authDate = Number(params.get("auth_date") || 0);
    if (authDate && Date.now() / 1000 - authDate > 86400 * 2) return { ok: false, reason: "stale" };
    const user = JSON.parse(params.get("user") || "{}");
    return { ok: true, user };
  } catch (e: any) {
    return { ok: false, reason: "exception" };
  }
}

export function adminIds(): number[] {
  return (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}

export function isAdmin(tgId: number): boolean {
  return adminIds().includes(tgId);
}
