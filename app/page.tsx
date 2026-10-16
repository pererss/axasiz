"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GiftVisual from "@/components/GiftVisual";

declare global { interface Window { Telegram?: any } }

interface Gift { id: string; name: string; stars: number; description: string; theme: string; image?: string; frame?: { scale: number; x: number; y: number }; order: number; enabled: boolean; }
interface Task { id: string; kind: string; title: string; description: string; url: string; chatId: string; requiredCount: number; giftIds: string[]; order: number; enabled: boolean; manual: boolean; }
interface UserState { tgId: number; selectedGiftId: string | null; done: Record<string, number>; clicked: Record<string, number>; waitingStartedAt: number | null; waitingEndsAt: number | null; waitingStatus: string; violationNote: string; }

function tg() { return typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null; }
function initData(): string {
  try {
    const w = tg();
    if (w?.initData) return w.initData;
  } catch {}
  return "";
}
function devId(): string {
  try { return new URLSearchParams(window.location.search).get("tg_id") || ""; } catch { return ""; }
}
function fmt(n: number) { return String(n).padStart(2, "0"); }

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [screen, setScreen] = useState(0);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<UserState | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [inviteCounts, setInviteCounts] = useState<Record<string, number>>({});
  const [refLink, setRefLink] = useState("");
  const [rules, setRules] = useState("");
  const [claimUser, setClaimUser] = useState("");
  const [waitingDays, setWaitingDays] = useState(7);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [verifying, setVerifying] = useState<string>("");
  const [taskMsg, setTaskMsg] = useState<Record<string, string>>({});
  const [celebrate, setCelebrate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [claim, setClaim] = useState<{ eligible: boolean; reason: string; claimUrl: string; remainingMs: number } | null>(null);

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const id = initData();
    if (id) h["x-telegram-init-data"] = id;
    return h;
  }, []);
  const devQuery = useCallback(() => {
    const d = devId();
    return d ? `?tg_id=${d}` : "";
  }, []);

  const load = useCallback(async (keepScreen = false) => {
    setErr("");
    try {
      const r = await fetch(`/api/state${devQuery()}`, { headers: headers() });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "auth");
      setGifts(j.gifts || []);
      setTasks(j.tasks || []);
      setUser(j.user);
      setSelected(j.user?.selectedGiftId || null);
      setDoneCount(j.doneCount || 0);
      setTotal(j.total || 0);
      setAllDone(!!j.allDone);
      setInviteCounts(j.inviteCounts || {});
      setRefLink(j.refLink || "");
      setRules(j.settings?.rulesText || "");
      setClaimUser(j.settings?.claimUsername || "");
      setWaitingDays(j.settings?.waitingDays || 7);
      setBlocks((j.settings?.blocks || []).filter((b: any) => b.enabled).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
      setServerOffset(Date.now() - (j.serverNow || Date.now()));
      // restore screen (skip when we just navigated instantly)
      if (!keepScreen) {
        if (j.user?.waitingStartedAt) setScreen(2);
        else if (j.user?.selectedGiftId) setScreen(1);
        else setScreen(0);
      }
      try {
        // forced screen for admin live preview (?screen=0|1|2)
        const f = new URLSearchParams(window.location.search).get("screen");
        if (f !== null && ["0", "1", "2"].includes(f)) setScreen(Number(f));
      } catch {}
      if (j.allDone) setCelebrate(true);
      try { tg()?.ready(); tg()?.expand(); } catch {}
    } catch (e: any) {
      setErr("Не удалось загрузить данные. Проверь интернет и открой приложение из Telegram.");
    } finally { setLoading(false); }
  }, [devQuery, headers]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const gift = useMemo(() => gifts.find((g) => g.id === (selected || user?.selectedGiftId)) || null, [gifts, selected, user]);

  const go = (s: number) => {
    try { tg()?.HapticFeedback?.impactOccurred("light"); } catch {}
    setScreen(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function chooseGift(g: Gift) {
    setSelected(g.id);
    try { tg()?.HapticFeedback?.impactOccurred("medium"); } catch {}
    go(1); // instantly — no waiting for network
    try {
      const r = await fetch(`/api/select-gift${devQuery()}`, { method: "POST", headers: headers(), body: JSON.stringify({ giftId: g.id }) });
      const j = await r.json();
      if (!j.ok) throw new Error();
      await load(true);
    } catch { setErr("Не удалось сохранить выбор. Проверь соединение — выбор может не сохраниться."); }
  }

  async function openTask(t: Task) {
    try { await fetch(`/api/tasks/verify${devQuery()}`, { method: "POST", headers: headers(), body: JSON.stringify({ taskId: t.id, action: "click" }) }); } catch {}
    await load();
    const url = t.kind === "invite" ? refLink : t.url;
    if (!url) return;
    try {
      const w = tg();
      if (t.kind === "invite") {
        const text = `🎁 Забирай подарок вместе со мной! Выполняй задания и получай до 100 ⭐`;
        if (w?.openTelegramLink) w.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
      } else if (w?.openLink || w?.openTelegramLink) {
        try { (w.openTelegramLink || w.openLink).call(w, url); } catch { window.open(url, "_blank"); }
      } else window.open(url, "_blank");
    } catch { window.open(url, "_blank"); }
  }

  async function verify(t: Task) {
    setVerifying(t.id);
    setTaskMsg((m) => ({ ...m, [t.id]: "" }));
    try {
      const r = await fetch(`/api/tasks/verify${devQuery()}`, { method: "POST", headers: headers(), body: JSON.stringify({ taskId: t.id, action: "verify" }) });
      const j = await r.json();
      if (j.ok && j.done) {
        try { tg()?.HapticFeedback?.notificationOccurred("success"); } catch {}
        setTaskMsg((m) => ({ ...m, [t.id]: "ok" }));
        await load();
      } else {
        try { tg()?.HapticFeedback?.notificationOccurred("error"); } catch {}
        setTaskMsg((m) => ({ ...m, [t.id]: j.message || "Не получилось подтвердить. Попробуй ещё раз." }));
        if (j.inviteCount !== undefined) setInviteCounts((c) => ({ ...c, [t.id]: j.inviteCount }));
      }
    } catch {
      setTaskMsg((m) => ({ ...m, [t.id]: "Ошибка сети. Попробуй ещё раз." }));
    } finally { setVerifying(""); }
  }

  async function startWaiting() {
    try {
      const r = await fetch(`/api/waiting/start${devQuery()}`, { method: "POST", headers: headers() });
      const j = await r.json();
      if (!j.ok) throw new Error();
      await load();
      go(2);
    } catch { setErr("Не удалось начать ожидание. Обнови страницу."); }
  }

  // claim status polling on screen 2
  useEffect(() => {
    if (screen !== 2) return;
    let stop = false;
    async function fetchClaim() {
      try {
        const r = await fetch(`/api/claim${devQuery()}`, { headers: headers() });
        const j = await r.json();
        if (!stop && j.ok) setClaim(j);
      } catch {}
    }
    fetchClaim();
    const t = setInterval(fetchClaim, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [screen, devQuery, headers]);

  const endsAt = user?.waitingEndsAt || null;
  const serverNow = nowTick - serverOffset;
  const remainMs = endsAt ? Math.max(0, endsAt - serverNow) : 0;
  const dd = Math.floor(remainMs / 86400000);
  const hh = Math.floor((remainMs % 86400000) / 3600000);
  const mm = Math.floor((remainMs % 3600000) / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);
  const waitTotal = (waitingDays || 7) * 86400000;
  const waitProg = endsAt ? Math.min(100, Math.max(0, ((waitTotal - remainMs) / waitTotal) * 100)) : 0;
  const taskProg = total ? Math.round((doneCount / total) * 100) : 0;
  const SNAKE_D = "M30,0 C60,80 0,160 30,240 C60,320 0,400 30,480 C60,560 0,640 30,720 C60,800 0,880 30,960 L30,1000";

  if (loading) return (
    <div className="shell"><div className="mesh"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="blob b4" /></div>
      <div className="glass loader"><div className="spinner" />Загружаем подарки…</div></div>
  );

  return (
    <div className="shell">
      <div className="mesh"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="blob b4" /></div>
      {celebrate && allDone && screen === 1 && (
        <div className="confetti">{Array.from({ length: 40 }).map((_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ["#6366f1", "#06b6d4", "#ec4899", "#fbbf24", "#34d399"][i % 5], animationDelay: `${(i % 20) / 20}s` }} />
        ))}</div>
      )}
      {err && <div className="msg err" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="slides">
          {/* SCREEN 1 */}
          <section className={`slide ${screen === 0 ? "on" : ""}`}>
            <div className="hero-new">
              <h1 className="title-anim">Выбери свою награду</h1>
            </div>
            {blocks.map((b: any, i: number) => (
              <div key={b.id} data-block-id={b.id} className={`glass blk blk-${b.style || "neon-blue"}`} style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
                <div className="blk-ic">{b.icon || "✨"}</div>
                <div><h4>{b.title}</h4><p>{b.text}</p></div>
              </div>
            ))}
            <div className="gift-grid">
              {gifts.map((g) => (
                <div key={g.id} onClick={() => chooseGift(g)}
                  className={`gift-card ${g.theme} ${selected === g.id ? "sel" : ""}`}>
                  <div className="shine" />
                  <GiftVisual giftId={g.id} theme={g.theme} image={g.image} frame={g.frame} />
                  <h3>{g.name}</h3>
                  <span className="stars">★ {g.stars}</span>
                </div>
              ))}
              {gifts.length === 0 && <div className="glass" style={{ padding: 20, gridColumn: "1/-1" }}>Подарки скоро появятся.</div>}
            </div>
          </section>

          {/* SCREEN 2 */}
          <section className={`slide ${screen === 1 ? "on" : ""}`}>
            <div className="topbar">
              <button className="back" onClick={() => go(0)} aria-label="Назад">←</button>
              <div className="mini-gift">
                {gift && <GiftVisual giftId={gift.id} theme={gift.theme} image={gift.image} frame={gift.frame} thumb />}
                <div><b>{gift?.name || "Выбери подарок"}</b><span>★ {gift?.stars || 0} · награда закреплена</span></div>
              </div>
            </div>
            <div className="glass hero" style={{ paddingTop: 20 }}>
              <h1>Выполни задания ✧</h1>
              <p>Осталось совсем немного. Выполни все условия, а мы автоматически проверим результат.</p>
            </div>
            <div className="glass progress-wrap">
              <div className="row"><span>Выполнено {doneCount} из {total} заданий</span><span>{taskProg}%</span></div>
              <div className="bar"><i style={{ width: `${taskProg}%` }} /></div>
            </div>
            <div className="steps">
              <svg className="snake" viewBox="0 0 60 1000" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="snakeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#22d3ee" /><stop offset=".5" stopColor="#818cf8" /><stop offset="1" stopColor="#e879f9" />
                  </linearGradient>
                </defs>
                <path className="base" d={SNAKE_D} />
                <path className="flow" d={SNAKE_D} />
                <circle className="comet" r="6"><animateMotion dur="5s" repeatCount="indefinite" path={SNAKE_D} /></circle>
              </svg>
            {tasks.map((t, i) => {
              const done = !!user?.done?.[t.id];
              const msg = taskMsg[t.id];
              const kindName = t.kind === "invite" ? "Друзья" : t.kind === "channel" ? "Подписка" : t.kind === "group" ? "Чат" : t.kind === "external_bot" ? "Бот" : "Ссылка";
              const need = t.requiredCount || 0;
              const have = inviteCounts[t.id] ?? 0;
              return (
                <div key={t.id} className={`glass tstep ${done ? "done" : ""}`} style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="tstep-num">{done ? "✓" : `0${i + 1}`}</div>
                  <div className="tstep-body">
                    <div className="kind-tag">{kindName}</div>
                    <div className="tstep-top">
                      <h4>{t.title}</h4>
                      <span>{done ? "выполнено" : `шаг ${i + 1} из ${total}`}</span>
                    </div>
                    <p>{t.description}
                      {t.manual && !done && <><br /><i>Проверка: ручная модерация после перехода.</i></>}
                    </p>
                    {t.kind === "invite" && !done && (
                      <div className="seg">{Array.from({ length: need }).map((_, k) => (
                        <i key={k} className={k < have ? "hit" : ""} />
                      ))}</div>
                    )}
                    {t.kind === "invite" && !done && <p><b>{have} из {need} друзей</b></p>}
                    {!done && (
                      <div className="btn-row">
                        <button className="btn soft" onClick={() => openTask(t)}>
                          {t.kind === "invite" ? "Пригласить" : t.kind === "channel" ? "Открыть канал" : t.kind === "group" ? "Открыть чат" : "Открыть"}
                        </button>
                        <button className={`btn primary ${verifying === t.id ? "busy" : ""}`} disabled={verifying === t.id} onClick={() => verify(t)}>
                          {verifying === t.id ? "Проверяем…" : "Проверить"}
                        </button>
                      </div>
                    )}
                    {msg && msg !== "ok" && <div className="msg err">{msg}</div>}
                    {msg === "ok" && <div className="msg okm">Подтверждено сервером ✓</div>}
                  </div>
                </div>
              );
            })}
            </div>
            {allDone && (
              <div className="glass" style={{ textAlign: "center", padding: 24, marginTop: 12 }}>
                <div style={{ fontSize: 44 }}>🎆</div>
                <h4 style={{ fontSize: 18, margin: "0 0 6px" }}>Все условия выполнены!</h4>
                <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 14px" }}>Остался финальный этап ожидания. Прогресс сохранён.</p>
                <button className="btn primary big glow" onClick={startWaiting}>Перейти к ожиданию →</button>
              </div>
            )}
          </section>

          {/* SCREEN 3 */}
          <section className={`slide ${screen === 2 ? "on" : ""}`}>
            <div className="topbar">
              <button className="back" onClick={() => go(1)} aria-label="Назад">←</button>
              <div className="mini-gift">
                {gift && <GiftVisual giftId={gift.id} theme={gift.theme} image={gift.image} frame={gift.frame} thumb />}
                <div><b>{gift?.name || ""}</b><span>★ {gift?.stars || 0}</span></div>
              </div>
            </div>
            <div className="glass timer-panel">
              <h2>Твой подарок на финальном этапе</h2>
              <p className="sub">Мы проверили выполнение заданий. Чтобы получить награду, необходимо сохранить все условия участия в течение {waitingDays} дней.</p>
              <div className="dial">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                  <defs>
                    <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#22d3ee" /><stop offset=".55" stopColor="#818cf8" /><stop offset="1" stopColor="#e879f9" />
                    </linearGradient>
                  </defs>
                  <circle className="dial-bg" cx="100" cy="100" r="88" />
                  <circle className="dial-fg" cx="100" cy="100" r="88"
                    strokeDasharray={553} strokeDashoffset={553 * (1 - waitProg / 100)}
                    transform="rotate(-90 100 100)" />
                </svg>
                <div className="dial-center">
                  <b>{dd}</b><span>дней</span>
                  <i>{fmt(hh)}:{fmt(mm)}:{fmt(ss)}</i>
                </div>
              </div>
              <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${waitProg}%` }} /></div>
              <div className="status-list">
                <div>✦ Задания выполнены.</div>
                <div>✦ Условия участия проверены.</div>
                <div>{(claim?.eligible) ? "✦ Период ожидания завершён!" : `◇ Осталось дождаться окончания ${waitingDays}-дневного периода.`}</div>
                {user?.waitingStatus === "violated" && <div style={{ background: "rgba(127,29,29,.5)", borderColor: "rgba(248,113,113,.4)" }}>⚡ {user.violationNote || "Условия нарушены."} Восстанови подписки — период начнётся заново после проверки.</div>}
                {user?.waitingStatus === "violated" && <button className="btn primary" onClick={() => load()}>Проверить восстановление</button>}
              </div>
            </div>
            <div className="glass rules">{rules}</div>
            <div style={{ marginTop: 12 }}>
              {(claim?.eligible) ? (
                <button className="btn primary big glow" onClick={() => {
                  try { tg()?.HapticFeedback?.notificationOccurred("success"); } catch {}
                  const url = claim.claimUrl;
                  try { tg()?.openTelegramLink ? tg().openTelegramLink(url) : window.open(url, "_blank"); }
                  catch { window.open(url, "_blank"); }
                }}>🪄 Подать заявку на получение</button>
              ) : (
                <>
                  <button className="btn big disabled" disabled>Заявка будет доступна позже</button>
                </>
              )}
            </div>
          </section>
      </div>
    </div>
  );
}
