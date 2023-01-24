import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

// A real DB round-trip, not just "the process is up" - a healthy Node
// process with an unreachable database is exactly the failure mode this
// needs to catch before a load balancer routes traffic to it.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
