import { csvField, toCsv } from "@/lib/csv";

export interface AuditLogRow {
  createdAt: Date;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  metadata: unknown;
}

const COLUMNS = ["createdAt", "actor", "action", "targetType", "targetId", "metadata"];

export function auditLogToCsv(entries: AuditLogRow[]): string {
  const rows = entries.map((entry) => [
    csvField(entry.createdAt.toISOString()),
    csvField(entry.actorEmail ?? "via API"),
    csvField(entry.action),
    csvField(entry.targetType),
    csvField(entry.targetId),
    csvField(entry.metadata ? JSON.stringify(entry.metadata) : null),
  ]);
  return toCsv(COLUMNS, rows);
}
