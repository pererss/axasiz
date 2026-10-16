// Supabase/Postgres connectivity + schema check (diagnostic, no secrets inside).
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const t = await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1");
    console.log("tables:" + t.rows.map((r) => r.tablename).join(","));
    for (const tb of ["gifts", "tasks", "users", "referrals", "kv"]) {
      try {
        const c = await p.query(`SELECT COUNT(*) AS c FROM ${tb}`);
        console.log(tb + ":" + c.rows[0].c);
      } catch (e) { console.log(tb + ":MISSING"); }
    }
  } catch (e) {
    console.error("PGERR:" + e.message);
    process.exit(1);
  } finally { await p.end().catch(() => {}); process.exit(0); }
})();
