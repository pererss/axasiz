import fs from "fs";
import path from "path";
import { defaultGifts, defaultSettings, defaultTasks, Gift, Settings, Task, UserState } from "./core";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

interface FileDB {
  gifts: Gift[];
  tasks: Task[];
  users: Record<string, UserState>;
  referrals: { inviter: number; invited: number; at: number }[];
  settings: Settings;
}

function freshDB(): FileDB {
  return { gifts: defaultGifts(), tasks: defaultTasks(), users: {}, referrals: [], settings: defaultSettings() };
}

function loadFile(): FileDB {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const d = freshDB();
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
      return d;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const d = JSON.parse(raw);
    if (!d.gifts) d.gifts = defaultGifts();
    if (!d.tasks) d.tasks = defaultTasks();
    if (!d.users) d.users = {};
    if (!d.referrals) d.referrals = [];
    if (!d.settings) d.settings = defaultSettings();
    return d as FileDB;
  } catch {
    return freshDB();
  }
}

function saveFile(d: FileDB) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
  } catch { /* ignore on read-only */ }
}

const USE_PG = () => Boolean(process.env.DATABASE_URL);

// ---- Postgres (Supabase) ----
let pgPool: any = null;
function pool() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (pgPool) return pgPool;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  pgPool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 20000,
  });
  pgPool.on("error", () => { try { pgPool.end().catch(() => {}); } catch {} pgPool = null; });
  return pgPool;
}

/** Run fn with pg pool; on failure reset pool and retry once, then give up (null). */
async function withPg<T>(fn: (p: any) => Promise<T>): Promise<T | null> {
  const p0 = pool();
  if (!p0) return null;
  try {
    return await fn(p0);
  } catch {
    try { await p0.end().catch(() => {}); } catch {}
    pgPool = null;
    const p1 = pool();
    if (!p1) return null;
    try {
      return await fn(p1);
    } catch {
      return null;
    }
  }
}

let pgReady = false;
async function ensurePg() {
  const p = pool();
  if (!p || pgReady) return p;
  await p.query(`CREATE TABLE IF NOT EXISTS gifts (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS users (tg_id BIGINT PRIMARY KEY, data JSONB NOT NULL)`);
  await p.query(`CREATE TABLE IF NOT EXISTS referrals (inviter BIGINT, invited BIGINT PRIMARY KEY, at BIGINT)`);
  await p.query(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  // RLS stays enabled (browser never connects directly; server uses privileged connection)
  for (const t of ["gifts", "tasks", "users", "referrals", "kv"]) {
    await p.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
  }
  // idempotent seed (safe under concurrent first requests)
  for (const gift of defaultGifts()) await p.query(`INSERT INTO gifts VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [gift.id, gift]);
  for (const t of defaultTasks()) await p.query(`INSERT INTO tasks VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [t.id, t]);
  await p.query(`INSERT INTO kv VALUES ('settings',$1) ON CONFLICT (key) DO NOTHING`, [defaultSettings()]);
  pgReady = true;
  return p;
}

/** PG read with one retry; throws when pg is configured but unreachable (never silently wrong data). */
async function pgRead(fn: (p: any) => Promise<any>): Promise<any> {
  const r = await withPg(async (p) => { await ensurePg(); return fn(p); });
  if (r === null || r === undefined) throw new Error("db-unavailable");
  return r;
}

/** PG write; throws when pg is configured but unreachable. */
async function pgWrite(fn: (p: any) => Promise<unknown>): Promise<boolean> {
  const r = await withPg(async (p) => { await ensurePg(); await fn(p); return true as const; });
  return r === true;
}

export const db = {
  usePg: () => USE_PG(),
  async gifts(): Promise<Gift[]> {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT data FROM gifts`));
      return r.rows.map((x: any) => x.data).sort((a: any, b: any) => a.order - b.order);
    }
    return loadFile().gifts.sort((a, b) => a.order - b.order);
  },
  async tasks(): Promise<Task[]> {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT data FROM tasks`));
      return r.rows.map((x: any) => x.data).sort((a: any, b: any) => a.order - b.order);
    }
    return loadFile().tasks.sort((a, b) => a.order - b.order);
  },
  async settings(): Promise<Settings> {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT data FROM kv WHERE key='settings'`));
      return r.rows[0]?.data || defaultSettings();
    }
    return loadFile().settings;
  },
  async saveSettings(s: Settings) {
    if (USE_PG()) {
      if (!(await pgWrite((p) => p.query(`INSERT INTO kv VALUES ('settings',$1) ON CONFLICT (key) DO UPDATE SET data=$1`, [s])))) throw new Error("db-unavailable");
      return;
    }
    const d = loadFile(); d.settings = s; saveFile(d);
  },
  async saveGift(g: Gift) {
    if (USE_PG()) {
      if (!(await pgWrite((p) => p.query(`INSERT INTO gifts VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=$2`, [g.id, g])))) throw new Error("db-unavailable");
      return;
    }
    const d = loadFile();
    const i = d.gifts.findIndex((x) => x.id === g.id);
    if (i >= 0) d.gifts[i] = g; else d.gifts.push(g);
    saveFile(d);
  },
  async deleteGift(id: string) {
    if (USE_PG()) {
      if (!(await pgWrite((p) => p.query(`DELETE FROM gifts WHERE id=$1`, [id])))) throw new Error("db-unavailable");
      return;
    }
    const d = loadFile(); d.gifts = d.gifts.filter((x) => x.id !== id); saveFile(d);
  },
  async saveTask(t: Task) {
    if (USE_PG()) {
      if (!(await pgWrite((p) => p.query(`INSERT INTO tasks VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=$2`, [t.id, t])))) throw new Error("db-unavailable");
      return;
    }
    const d = loadFile();
    const i = d.tasks.findIndex((x) => x.id === t.id);
    if (i >= 0) d.tasks[i] = t; else d.tasks.push(t);
    saveFile(d);
  },
  async deleteTask(id: string) {
    if (USE_PG()) {
      if (!(await pgWrite((p) => p.query(`DELETE FROM tasks WHERE id=$1`, [id])))) throw new Error("db-unavailable");
      return;
    }
    const d = loadFile(); d.tasks = d.tasks.filter((x) => x.id !== id); saveFile(d);
  },
  async user(tgId: number): Promise<UserState | null> {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT data FROM users WHERE tg_id=$1`, [tgId]));
      return r.rows[0]?.data || null;
    }
    return loadFile().users[String(tgId)] || null;
  },
  async saveUser(u: UserState) {
    if (USE_PG()) {
      if (!(await pgWrite((p) => p.query(`INSERT INTO users VALUES ($1,$2) ON CONFLICT (tg_id) DO UPDATE SET data=$2`, [u.tgId, u])))) throw new Error("db-unavailable");
      return;
    }
    const d = loadFile(); d.users[String(u.tgId)] = u; saveFile(d);
  },
  async users(limit = 200): Promise<UserState[]> {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT data FROM users LIMIT $1`, [limit]));
      return r.rows.map((x: any) => x.data);
    }
    return Object.values(loadFile().users).slice(0, limit);
  },
  async addReferral(inviter: number, invited: number) {
    if (inviter === invited) return false;
    if (USE_PG()) {
      const res = await withPg(async (p) => {
        await ensurePg();
        const ex = await p.query(`SELECT * FROM referrals WHERE invited=$1`, [invited]);
        if (ex.rows.length) return "dup" as const;
        await p.query(`INSERT INTO referrals VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [inviter, invited, Date.now()]);
        return "added" as const;
      });
      if (!res) throw new Error("db-unavailable");
      return res === "added";
    }
    const d = loadFile();
    if (d.referrals.some((r) => r.invited === invited)) return false;
    d.referrals.push({ inviter, invited, at: Date.now() });
    saveFile(d);
    return true;
  },
  async inviteCount(inviter: number): Promise<number> {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT COUNT(*) c FROM referrals WHERE inviter=$1`, [inviter]));
      return Number(r.rows[0].c);
    }
    return loadFile().referrals.filter((r) => r.inviter === inviter).length;
  },
  async referralsOf(inviter: number) {
    if (USE_PG()) {
      const r = await pgRead((p) => p.query(`SELECT * FROM referrals WHERE inviter=$1`, [inviter]));
      return r.rows;
    }
    return loadFile().referrals.filter((r) => r.inviter === inviter);
  },
  async claimants(): Promise<UserState[]> {
    const all = await db.users(1000);
    return all.filter((u) => u.waitingStatus === "ready" || u.waitingStatus === "waiting" || u.waitingStatus === "violated");
  },
};
