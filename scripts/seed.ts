import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { orgMembers, orgs, users } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const DEMO_EMAIL = "demo@warden.local";
const DEMO_PASSWORD = "demo-password-1234";
const DEMO_ORG_SLUG = "demo";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Idempotent by the fields that are actually unique (users.email,
  // orgs.slug) rather than a plain insert, so re-running this script
  // against an already-seeded database is safe.
  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (!user) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    [user] = await db.insert(users).values({ email: DEMO_EMAIL, passwordHash }).returning();
  }
  if (!user) throw new Error("failed to seed demo user");

  let [org] = await db.select().from(orgs).where(eq(orgs.slug, DEMO_ORG_SLUG)).limit(1);
  if (!org) {
    [org] = await db.insert(orgs).values({ slug: DEMO_ORG_SLUG, name: "Demo Org" }).returning();
  }
  if (!org) throw new Error("failed to seed demo org");

  const [membership] = await db.select().from(orgMembers).where(eq(orgMembers.orgId, org.id)).limit(1);
  if (!membership) {
    await db.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: "owner" });
  }

  console.log(`seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`org: /${DEMO_ORG_SLUG}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
