import { NextResponse } from "next/server";
import { z } from "zod";
import { createRepo, getOrgForMember, getRepoBySlug, listReposForOrg, logAudit } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const repos = await listReposForOrg(resolved.org.id);
  return NextResponse.json({ repos });
});

const bodySchema = z.object({ name: z.string().trim().min(1).max(100) });

export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

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

  const repoSlug = slugify(parsed.data.name);
  if (!repoSlug) return NextResponse.json({ error: "name must contain at least one letter or number" }, { status: 400 });

  const existing = await getRepoBySlug(resolved.org.id, repoSlug);
  if (existing) return NextResponse.json({ error: "a repo with this name already exists in this org" }, { status: 409 });

  const repo = await createRepo(resolved.org.id, repoSlug, parsed.data.name);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "repo.created", targetType: "repo", targetId: repo.id });

  return NextResponse.json({ repo }, { status: 201 });
});
