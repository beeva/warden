import { NextResponse } from "next/server";
import { getOrgForMember, listAuditLogForOrg } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { auditLogToCsv } from "@/lib/audit-log-csv";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Any member can export, matching who can already view the activity
// page itself - this isn't a new disclosure, just the same data in a
// downloadable form.
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const entries = await listAuditLogForOrg(resolved.org.id, 1000);
  const csv = auditLogToCsv(entries);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="warden-${slug}-activity.csv"`,
    },
  });
});
