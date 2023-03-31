import { NextResponse } from "next/server";
import { deleteOrg, getOrgForMember } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Owner-only - cascades to every repo (and each repo's own scans,
// findings, and webhook deliveries), member, API token, and invite for
// this org. The single most destructive action in the product; there's
// no further confirmation at this layer beyond the type-to-confirm the
// UI requires before ever sending the request.
export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can delete the org" }, { status: 403 });
  }

  await deleteOrg(resolved.org.id);

  return NextResponse.json({ ok: true });
});
