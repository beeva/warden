import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
