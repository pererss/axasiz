import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public diagnostics (no user data): is the DB reachable and seeded?
export async function GET() {
  try {
    const [gifts, tasks] = await Promise.all([db.gifts(), db.tasks()]);
    return NextResponse.json({
      ok: true,
      db: db.usePg() ? "pg" : "file",
      gifts: gifts.length,
      tasks: tasks.length,
      serverNow: Date.now(),
    });
  } catch (e) {
    console.error("health failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, db: db.usePg() ? "pg" : "file" }, { status: 500 });
  }
}
