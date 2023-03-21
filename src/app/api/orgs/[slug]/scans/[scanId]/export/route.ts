import { NextResponse } from "next/server";
import { getOrgForMember, getScanById, listAllFindingsForScan, scanBelongsToOrg } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { findingsToCsv } from "@/lib/findings-csv";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; scanId: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, scanId } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const id = Number(scanId);
  if (!Number.isInteger(id) || !(await scanBelongsToOrg(id, resolved.org.id))) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }

  const [scan, findings] = await Promise.all([getScanById(id), listAllFindingsForScan(id)]);
  const csv = findingsToCsv(findings);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="warden-scan-${scan?.id ?? id}-findings.csv"`,
    },
  });
});
