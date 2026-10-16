// Test-only DB helper (dev/test users in ANY env incl. Supabase).
// Usage: node scripts/dbhelper.js mkready <tgId> | deltest
// mkready: crafts a user with all tasks done + waiting already over.
// deltest: removes known test users + their referral rows.
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const TEST_IDS = [900011, 900012, 900021, 900031, 999998, 999999];

async function mkready(tgId) {
  const now = Date.now();
  const u = {
    tgId, firstName: "T", username: "t", lang: "ru", selectedGiftId: "g15",
    done: { t_channel: now - 9e6, t_group: now - 9e6, t_invite: now - 9e6, t_bot: now - 9e6, t_link: now - 9e6 },
    clicked: {}, invitedBy: null,
    waitingStartedAt: now - 8 * 864e5, waitingEndsAt: now - 1000,
    waitingStatus: "waiting", violationNote: "", createdAt: now - 9e6,
  };
  await p.query("INSERT INTO users VALUES ($1,$2) ON CONFLICT (tg_id) DO UPDATE SET data=$2", [tgId, u]);
  console.log("ready:" + tgId);
}
async function deltest() {
  await p.query("DELETE FROM referrals WHERE inviter = ANY($1) OR invited = ANY($1)", [TEST_IDS]);
  const r = await p.query("DELETE FROM users WHERE tg_id = ANY($1)", [TEST_IDS]);
  console.log("deleted users:" + r.rowCount);
}
(async () => {
  try {
    const [cmd, arg] = process.argv.slice(2);
    if (cmd === "mkready") await mkready(Number(arg));
    else if (cmd === "deltest") await deltest();
    else console.log("usage: mkready <tgId> | deltest");
  } catch (e) { console.error("DBERR:" + e.message); process.exit(1); }
  finally { await p.end().catch(() => {}); process.exit(0); }
})();
