import { NextResponse } from "next/server";
import { z } from "zod";
import { countOrgOwners, getOrgForMember, getOrgMemberById, logAudit, updateOrgMemberRole } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({ role: z.enum(["owner", "member"]) });

// Owner-only - promoting someone to owner hands them everything an
// owner can do (members, tokens, repo settings, deleting the org
// itself), and demoting the org's last owner would leave it with no one
// able to manage any of that, the same reasoning member removal already
// applies.
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string; memberId: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can change a member's role" }, { status: 403 });
  }

  const id = Number(memberId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid member id" }, { status: 400 });

  const member = await getOrgMemberById(resolved.org.id, id);
  if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });

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

  if (member.role === "owner" && parsed.data.role === "member") {
    const ownerCount = await countOrgOwners(resolved.org.id);
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "cannot demote the last owner" }, { status: 409 });
    }
  }

  await updateOrgMemberRole(member.id, parsed.data.role);
  await logAudit({
    orgId: resolved.org.id,
    actorUserId: session.userId,
    action: "member.role_changed",
    targetType: "user",
    targetId: member.userId,
    metadata: { from: member.role, to: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
});
