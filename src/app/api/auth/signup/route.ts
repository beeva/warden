import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { orgs, users } from "@/lib/db/schema";
import { like } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { addOrgMember, createOrg, getUserByEmail } from "@/lib/db/queries";
import { slugify } from "@/lib/slug";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  orgName: z.string().trim().min(1).max(100),
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60_000;

/** Appends -2, -3, ... until the slug is free - an org named the same as an existing one shouldn't fail to create, just get a distinguishable URL. */
async function uniqueSlug(baseName: string): Promise<string> {
  const base = slugify(baseName) || "org";
  const existing = await db.select({ slug: orgs.slug }).from(orgs).where(like(orgs.slug, `${base}%`));
  const taken = new Set(existing.map((row) => row.slug));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

// Public and unauthenticated - anyone can sign up for a new account and
// org. Rate-limited per IP against automated account creation.
export const POST = withErrorHandling(async (request: Request) => {
  const ip = clientIpFrom(request.headers);
  const limitResult = rateLimit(`signup:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limitResult.allowed) {
    return NextResponse.json({ error: "too many signups from this address, try again later" }, { status: 429 });
  }

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

  const email = parsed.data.email.toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) return NextResponse.json({ error: "an account with this email already exists" }, { status: 409 });

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  if (!user) throw new Error("failed to create user");

  const slug = await uniqueSlug(parsed.data.orgName);
  const org = await createOrg(slug, parsed.data.orgName);
  await addOrgMember(org.id, user.id, "owner");

  await createSession({ userId: user.id, email: user.email });
  return NextResponse.json({ org }, { status: 201 });
});
