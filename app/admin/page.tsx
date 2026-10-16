"use client";
import { useCallback, useEffect, useState } from "react";
import GiftVisual from "@/components/GiftVisual";

function initData(): string { try { return (window as any).Telegram?.WebApp?.initData || ""; } catch { return ""; } }
function devId(): string { try { return new URLSearchParams(window.location.search).get("tg_id") || ""; } catch { return ""; } }

export default function Admin() {
  const [tab, setTab] = useState("gifts");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [notifyText, setNotifyText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [previewScreen, setPreviewScreen] = useState(0);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);

  const headers = () => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const id = initData();
    if (id) h["x-telegram-init-data"] = id;
    return h;
  };
  const q = () => { const d = devId(); return d ? `?tg_id=${d}` : ""; };

  const load = useCallback(async () => {
    setErr(""); setMsg("");
    try {
      const r = await fetch(`/api/admin${q()}`, { headers: headers() });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "forbidden");
      setData(j);
    } catch (e: any) {
      setErr("Нет доступа. Открой админ-панель из Telegram под ID из TELEGRAM_ADMIN_IDS. " + (e.message || ""));
    }
  }, []);

  useEffect(() => { load(); try { (window as any).Telegram?.WebApp?.ready(); (window as any).Telegram?.WebApp?.expand(); } catch {} }, [load]);

  async function post(body: any) {
    setMsg("");
    try {
      const r = await fetch(`/api/admin${q()}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "error");
      setMsg("Сохранено ✓");
      await load();
      setEditingBlock(null);
      if (tab === "design") setPreviewTick((t) => t + 1);
    } catch (e: any) { setErr("Ошибка: " + (e.message || "")); }
  }

  const previewSrc = (() => {
    try {
      const d = devId();
      const base = window.location.origin + "/";
      if (d) return `${base}?tg_id=${d}&preview=1&screen=${previewScreen}`;
      const id = initData();
      return id ? `${base}?initData=${encodeURIComponent(id)}&screen=${previewScreen}` : base;
    } catch { return "/"; }
  })();

  const wirePreview = (frame: HTMLIFrameElement | null) => {
    try {
      const doc = frame?.contentDocument;
      if (!doc || doc.getElementById("admin-preview-style")) return;
      const st = doc.createElement("style");
      st.id = "admin-preview-style";
      st.textContent = "[data-block-id]{cursor:pointer;} [data-block-id]:hover{outline:2px dashed rgba(34,211,238,.9);outline-offset:3px;}";
      doc.head.appendChild(st);
      doc.querySelectorAll("[data-block-id]").forEach((el) => {
        el.addEventListener("click", () => {
          const id = (el as HTMLElement).dataset.blockId;
          if (!id) return;
          setEditingBlock(id);
          setTimeout(() => {
            document.getElementById(`blockform-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 60);
        });
      });
    } catch { /* cross-origin: preview stays view-only */ }
  };

  return (
    <div className="admin-wrap">
      <div className="mesh"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /></div>
      <h2 style={{ margin: "6px 4px 2px" }}>⚙️ Админ-панель</h2>
      <a className="admin-back" href={devId() ? `/?tg_id=${devId()}` : "/"}>← В приложение</a>
      <p style={{ color: "#9aa6c8", fontSize: 13, margin: "0 4px 4px" }}>Подарки · задания · пользователи · заявки · оформление · настройки</p>
      <div style={{ fontSize: 12, color: devId() ? "#6ee7b7" : "#9aa6c8", margin: "0 4px 10px" }}>
        {devId() ? `● Вход: тестовый ID ${devId()} (локалка)` : "● Вход через Telegram"}
      </div>
      {err && <div className="msg err">{err}<br /><button className="small-btn save" onClick={load}>Повторить</button></div>}
      {msg && <div className="msg okm">{msg}</div>}
      {!data && !err && <div className="card">Загрузка…</div>}
      {data && (<>
        <div className="tabs">
          {(["gifts", "tasks", "users", "claims", "design", "settings"] as const).map((t) => (
            <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
              {t === "gifts" ? "🎁 Подарки" : t === "tasks" ? "✅ Задания" : t === "users" ? "👥 Пользователи" : t === "claims" ? "📨 Заявки" : t === "design" ? "🎨 Оформление" : "⚙️ Настройки"}
            </button>
          ))}
        </div>

        {tab === "gifts" && (data.gifts || []).map((g: any) => (
          <GiftForm key={g.id} g={g} onSave={(gift: any) => post({ action: "save-gift", gift })} onDelete={() => post({ action: "delete-gift", gift: { id: g.id } })} />
        ))}
        {tab === "gifts" && <button className="small-btn save" onClick={() => post({ action: "save-gift", gift: { id: "g" + Date.now(), name: "Новый подарок", stars: 15, description: "", theme: "mint", order: 99, enabled: true } })}>+ Добавить подарок</button>}

        {tab === "tasks" && (data.tasks || []).map((t: any) => (
          <TaskForm key={t.id} t={t} gifts={data.gifts} onSave={(task: any) => post({ action: "save-task", task })} onDelete={() => post({ action: "delete-task", task: { id: t.id } })} />
        ))}
        {tab === "tasks" && <button className="small-btn save" onClick={() => post({ action: "save-task", task: { id: "t" + Date.now(), kind: "link", title: "Новое задание", description: "", url: "https://t.me/", chatId: "", requiredCount: 1, giftIds: [], order: 99, enabled: true, manual: true } })}>+ Добавить задание</button>}

        {tab === "users" && (
          <div className="card tblwrap"><table className="tbl"><thead><tr><th>ID</th><th>Подарок</th><th>Прогресс</th><th>Ожидание</th><th>Пригл.</th></tr></thead>
            <tbody>{(data.users || []).map((u: any) => (
              <tr key={u.tgId}><td>{u.tgId}<br />@{u.username || "—"}</td><td>{u.selectedGiftId || "—"}</td>
                <td>{Object.keys(u.done || {}).length} зад.</td><td>{u.waitingStatus}{u.waitingEndsAt ? <><br />{new Date(u.waitingEndsAt).toLocaleString("ru")}</> : null}</td>
                <td>{data.counts?.[u.tgId] ?? 0}</td></tr>
            ))}</tbody></table></div>
        )}

        {tab === "claims" && (
          <div className="card tblwrap"><table className="tbl"><thead><tr><th>ID</th><th>Награда</th><th>Статус</th><th>Доступность</th></tr></thead>
            <tbody>{(data.claimants || []).map((u: any) => (
              <tr key={u.tgId}><td>{u.tgId}</td><td>{u.selectedGiftId}</td><td>{u.waitingStatus}{u.violationNote ? ` (${u.violationNote})` : ""}</td>
                <td>{u.waitingStatus === "ready" ? "можно подавать" : u.waitingEndsAt ? new Date(u.waitingEndsAt).toLocaleString("ru") : "—"}</td></tr>
            ))}</tbody></table>
            {(data.claimants || []).length === 0 && <p style={{ fontSize: 13, color: "#64748b" }}>Пока никто не дошёл до финала.</p>}</div>
        )}

        {tab === "design" && (
          <>
            <div className="card"><p style={{ fontSize: 13, color: "#9aa6c8", margin: "0 0 4px" }}>В окне — живой сайт ровно как у человека. Кликни по блоку в окне — откроется его редактор. После каждого сохранения окно обновляется само. Тяни за ☰ для порядка (на телефоне — стрелками ↑ ↓).</p></div>
            <div className="preview-bar">
              <button className="small-btn toggle" onClick={() => setPreviewTick((t) => t + 1)}>🔄</button>
              {(["Подарки", "Задания", "Ожидание"] as const).map((label, i) => (
                <button key={label} className={`small-btn ${previewScreen === i ? "save" : "toggle"}`}
                  onClick={() => setPreviewScreen(i)}> {["🎁", "✅", "⏳"][i]} {label}</button>
              ))}
            </div>
            <div className="phone">
              <iframe key={`${previewTick}-${previewScreen}`} src={previewSrc} title="Живой предпросмотр" onLoad={(e) => wirePreview(e.currentTarget)} />
            </div>
            {([...((data.settings?.blocks || []) as any[])].sort((a: any, c: any) => (a.order || 0) - (c.order || 0))).map((b: any) => (
              <div key={b.id} id={`blockform-${b.id}`} className={editingBlock === b.id ? "edit-flash" : ""}>
                <div className={`glass blk blk-${b.style || "neon-blue"}`} style={{ opacity: dragId === b.id ? 0.35 : 1 }}>
                  <div className="blk-ic">{b.icon || "✨"}</div>
                  <div style={{ flex: 1 }}><h4>{b.title}</h4><p>{b.text}</p></div>
                  <div draggable
                    onDragStart={() => setDragId(b.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!dragId || dragId === b.id) return;
                      const arr = [...((data.settings?.blocks || []) as any[])].sort((a: any, c: any) => (a.order || 0) - (c.order || 0));
                      const from = arr.findIndex((x: any) => x.id === dragId);
                      const to = arr.findIndex((x: any) => x.id === b.id);
                      if (from < 0 || to < 0) return;
                      const [mv] = arr.splice(from, 1);
                      arr.splice(to, 0, mv);
                      post({ action: "save-settings", settings: { ...data.settings, blocks: arr.map((x: any, i: number) => ({ ...x, order: i + 1 })) } });
                      setDragId(null);
                    }}
                    title="Тяни, чтобы поменять порядок"
                    style={{ cursor: "grab", fontSize: 22, padding: "10px 6px", color: "#9aa6c8" }}>☰</div>
                </div>
                {!b.enabled && <div style={{ fontSize: 11, color: "#9aa6c8", margin: "4px 2px 0" }}>скрыт — человек его не видит</div>}
                <BlockForm b={b} onSave={(blocks: any[]) => post({ action: "save-settings", settings: { ...data.settings, blocks } })} all={data.settings?.blocks || []} />
              </div>
            ))}
            <button className="small-btn save" onClick={() => post({ action: "save-settings", settings: { ...data.settings, blocks: [...(data.settings?.blocks || []), { id: "b" + Date.now(), icon: "✨", title: "Новый блок", text: "Текст блока", style: "neon-pink", enabled: true, order: 99 }] } })}>+ Добавить блок</button>
          </>
        )}

        {tab === "settings" && <SettingsForm s={data.settings} onSave={(settings: any) => post({ action: "save-settings", settings })} />}
        {tab === "settings" && (
          <div className="card"><label>Уведомления</label>
            <textarea rows={3} value={notifyText} onChange={(e) => setNotifyText(e.target.value)} placeholder="Текст рассылки…" />
            <button className="small-btn save" onClick={() => post({ action: "notify", notify: { text: notifyText } })}>📣 Отправить всем (до 100)</button>
            <p style={{ fontSize: 12, color: "#64748b" }}>ADMIN_IDS на сервере: {String(data.adminIds || "")}. Меняются только через переменную окружения.</p>
          </div>
        )}
      </>)}
    </div>
  );
}

function GiftForm({ g, onSave, onDelete }: any) {
  const [v, setV] = useState(g);
  useEffect(() => setV(g), [g]);
  const set = (k: string, val: any) => setV((o: any) => ({ ...o, [k]: val }));
  return (
    <div className="card">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div className={`gift-card ${v.theme}`} style={{ width: 148, flex: "none", animation: "none", cursor: "default", margin: 0 }}>
          <GiftVisual giftId={v.id} theme={v.theme} image={v.image} frame={v.frame} />
          <h3 style={{ fontSize: 13 }}>{v.name || "…"}</h3>
          <span className="stars">★ {v.stars}</span>
        </div>
        <div style={{ fontSize: 12, color: "#9aa6c8" }}>Так подарок видит человек —<br />карточка один в один как в приложении.</div>
      </div>
      <label>Подарок {g.id}</label>
      <input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Название" />
      <div className="row2">
        <input type="number" value={v.stars} onChange={(e) => set("stars", Number(e.target.value))} placeholder="Stars" />
        <input type="number" value={v.order} onChange={(e) => set("order", Number(e.target.value))} placeholder="Порядок" />
      </div>
      <input value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Описание (не показывается на карточке)" />
      <input value={v.image || ""} onChange={(e) => set("image", e.target.value)} placeholder="Фото: /gifts/файл.png или https://… (пусто = стандартное)" />
      <label>Кадрирование фото</label>
      <div style={{ display: "grid", gap: 2 }}>
        {(["scale", "x", "y"] as const).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#9aa6c8", width: 64 }}>
              {k === "scale" ? `Зум ${(v.frame?.scale ?? 1).toFixed(2)}` : k === "x" ? `Влево-вправо ${v.frame?.x ?? 0}` : `Вверх-вниз ${v.frame?.y ?? 0}`}
            </span>
            <input type="range" style={{ flex: 1 }}
              min={k === "scale" ? 0.5 : -30} max={k === "scale" ? 1.8 : 30} step={k === "scale" ? 0.01 : 1}
              value={k === "scale" ? v.frame?.scale ?? 1 : k === "x" ? v.frame?.x ?? 0 : v.frame?.y ?? 0}
              onChange={(e) => set("frame", { scale: v.frame?.scale ?? 1, x: v.frame?.x ?? 0, y: v.frame?.y ?? 0, [k]: Number(e.target.value) })} />
          </div>
        ))}
        <button className="small-btn toggle" onClick={() => set("frame", undefined)}>Сбросить кадрирование</button>
      </div>
      <div className="row2">
        <select value={v.theme} onChange={(e) => set("theme", e.target.value)}>
          <option value="mint">mint</option><option value="sky">sky</option><option value="lilac">lilac</option><option value="peach">peach</option>
        </select>
        <select value={v.enabled ? "1" : "0"} onChange={(e) => set("enabled", e.target.value === "1")}>
          <option value="1">включён</option><option value="0">выключен</option>
        </select>
      </div>
      <button className="small-btn save" onClick={() => onSave(v)}>Сохранить</button>
      <button className="small-btn del" onClick={onDelete}>Удалить</button>
    </div>
  );
}

function TaskForm({ t, gifts, onSave, onDelete }: any) {
  const [v, setV] = useState(t);
  useEffect(() => setV(t), [t]);
  const set = (k: string, val: any) => setV((o: any) => ({ ...o, [k]: val }));
  const howto: Record<string, string> = {
    channel: "Логика встроена: автопроверка подписки через Telegram. Бот должен быть администратором канала.",
    group: "Логика встроена: автопроверка участия через Telegram. Бот должен быть администратором группы.",
    invite: "Логика встроена: ссылка выдаётся автоматически, считаются только новые пользователи. Меняй только название, текст и число друзей.",
    external_bot: "Логика встроена: ручная модерация — засчитывается после перехода и короткой паузы.",
    link: "Логика встроена: засчитывается после открытия ссылки и короткой паузы.",
  };
  const save = () => {
    const n: any = { ...v };
    if (n.kind === "invite") { n.manual = false; n.url = ""; n.chatId = ""; }
    else if (n.kind === "channel" || n.kind === "group") { n.manual = false; n.requiredCount = 0; }
    else { n.manual = true; n.chatId = ""; n.requiredCount = 0; }
    onSave(n);
  };
  return (
    <div className="card">
      <label>Задание {t.id} · {t.kind}</label>
      <div className="msg okm" style={{ margin: "6px 0 8px", fontSize: 12 }}>⚙️ {howto[v.kind] || ""}</div>
      <input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Название" />
      <textarea rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Инструкция" />
      {(v.kind === "channel" || v.kind === "group") && (<>
        <input value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="Ссылка https://t.me/…" />
        <input value={v.chatId} onChange={(e) => set("chatId", e.target.value)} placeholder="chat_id для проверки (напр. @channel)" />
      </>)}
      {(v.kind === "external_bot" || v.kind === "link") && (
        <input value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="Ссылка https://t.me/…" />
      )}
      {v.kind === "invite" && (<>
        <label>Сколько друзей пригласить</label>
        <input type="number" min={1} value={v.requiredCount} onChange={(e) => set("requiredCount", Number(e.target.value))} placeholder="Число друзей" />
      </>)}
      <div className="row2">
        <select value={v.kind} onChange={(e) => set("kind", e.target.value)}>
          <option value="channel">channel — подписка</option><option value="group">group — чат</option>
          <option value="invite">invite — друзья</option><option value="external_bot">external_bot — бот</option>
          <option value="link">link — ссылка</option>
        </select>
        <input type="number" value={v.order} onChange={(e) => set("order", Number(e.target.value))} placeholder="Порядок" />
      </div>
      <div className="row2">
        <select value={v.enabled ? "1" : "0"} onChange={(e) => set("enabled", e.target.value === "1")}>
          <option value="1">включено</option><option value="0">выключено</option>
        </select>
        <input value={(v.giftIds || []).join(",")} onChange={(e) => set("giftIds", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="ID подарков (пусто = все)" />
      </div>
      <p style={{ fontSize: 11.5, color: "#64748b" }}>Доступные подарки: {(gifts || []).map((g: any) => g.id).join(", ")}</p>
      <button className="small-btn save" onClick={save}>Сохранить</button>
      <button className="small-btn del" onClick={onDelete}>Удалить</button>
    </div>
  );
}

function SettingsForm({ s, onSave }: any) {
  const [v, setV] = useState(s);
  useEffect(() => setV(s), [s]);
  if (!v) return null;
  const set = (k: string, val: any) => setV((o: any) => ({ ...o, [k]: val }));
  return (
    <div className="card">
      <label>claimUsername (без @)</label>
      <input value={v.claimUsername || ""} onChange={(e) => set("claimUsername", e.target.value)} placeholder="username для заявок" />
      <label>Длительность ожидания (дней)</label>
      <input type="number" value={v.waitingDays} onChange={(e) => set("waitingDays", Number(e.target.value))} />
      <label>Приветственный текст бота</label>
      <textarea rows={4} value={v.welcomeText} onChange={(e) => set("welcomeText", e.target.value)} />
      <label>Фото приветствия (необязательно)</label>
      <input value={v.welcomePhoto || ""} onChange={(e) => set("welcomePhoto", e.target.value)} placeholder="URL картинки или file_id (пусто = только текст)" />
      <label>Правила</label>
      <textarea rows={5} value={v.rulesText} onChange={(e) => set("rulesText", e.target.value)} />
      <label>Текст поддержки</label>
      <textarea rows={2} value={v.supportText} onChange={(e) => set("supportText", e.target.value)} />
      <button className="small-btn save" onClick={() => onSave(v)}>Сохранить настройки</button>
    </div>
  );
}

function BlockForm({ b, all, onSave }: any) {
  const [v, setV] = useState(b);
  useEffect(() => setV(b), [b]);
  const set = (k: string, val: any) => setV((o: any) => ({ ...o, [k]: val }));
  const commit = (next: any[]) => onSave(next);
  const save = () => commit(all.map((x: any) => (x.id === b.id ? v : x)));
  const remove = () => commit(all.filter((x: any) => x.id !== b.id));
  const move = (dir: number) => {
    const arr = [...all].sort((a: any, c: any) => (a.order || 0) - (c.order || 0));
    const i = arr.findIndex((x: any) => x.id === b.id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const cur = arr[i].order || 0, nxt = arr[j].order || 0;
    arr[i] = { ...arr[i], order: nxt }; arr[j] = { ...arr[j], order: cur };
    commit(arr);
  };
  return (
    <div className="card">
      <label>Блок {b.id}</label>
      <div className="row2">
        <input value={v.icon} onChange={(e) => set("icon", e.target.value)} placeholder="Иконка (эмодзи)" />
        <input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Заголовок" />
      </div>
      <textarea rows={3} value={v.text} onChange={(e) => set("text", e.target.value)} placeholder="Текст блока" />
      <div className="row2">
        <select value={v.style} onChange={(e) => set("style", e.target.value)}>
          <option value="neon-blue">синий неон</option><option value="neon-pink">розовый неон</option>
          <option value="neon-green">зелёный неон</option><option value="neon-gold">золотой неон</option>
        </select>
        <select value={v.enabled ? "1" : "0"} onChange={(e) => set("enabled", e.target.value === "1")}>
          <option value="1">показан</option><option value="0">скрыт</option>
        </select>
      </div>
      <div className="row2">
        <input type="number" value={v.order} onChange={(e) => set("order", Number(e.target.value))} placeholder="Порядок" />
      </div>
      <div>
        <button className="small-btn save" onClick={save}>Сохранить</button>
        <button className="small-btn toggle" onClick={() => move(-1)}>↑</button>
        <button className="small-btn toggle" onClick={() => move(1)}>↓</button>
        <button className="small-btn del" onClick={remove}>Удалить</button>
      </div>
    </div>
  );
}
