import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getUserByEmail } from "@/lib/db/queries";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60_000;

// A fixed dummy scrypt hash (of an arbitrary password, not a real
// credential) so the "email not found" path pays the same scrypt cost as
// the "email found, wrong password" path - otherwise the two are
// distinguishable by response time alone, letting an attacker enumerate
// registered emails.
const DUMMY_PASSWORD_HASH =
  "ab6cea6a853c654a476f913b2aed83cb:e440658cf1c89190373ae7e7f52dffbee6a7001513fed62fc804d5d2ee30db9a14d67164bcbd11cbd6c64cd6a6b50083991b06ea02d47f6753c73ccd9f9beed0";

export const POST = withErrorHandling(async (request: Request) => {
  const ip = clientIpFrom(request.headers);
  const limitResult = rateLimit(`login:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limitResult.allowed) {
    return NextResponse.json({ error: "too many attempts, try again later" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 400 });
  }

  const user = await getUserByEmail(parsed.data.email.toLowerCase());
  const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    return NextResponse.json({ error: "invalid email or password" }, { status: 401 });
  }

  await createSession({ userId: user.id, email: user.email });
  return NextResponse.json({ ok: true });
});
