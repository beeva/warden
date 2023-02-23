import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getUserById, updateUserPassword } from "@/lib/db/queries";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60_000;

export const PATCH = withErrorHandling(async (request: Request) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limitResult = rateLimit(`change-password:${session.userId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limitResult.allowed) return NextResponse.json({ error: "too many attempts, try again later" }, { status: 429 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  }

  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "account not found" }, { status: 404 });

  const currentOk = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!currentOk) return NextResponse.json({ error: "current password is incorrect" }, { status: 401 });

  const newHash = await hashPassword(parsed.data.newPassword);
  await updateUserPassword(user.id, newHash);

  return NextResponse.json({ ok: true });
});
