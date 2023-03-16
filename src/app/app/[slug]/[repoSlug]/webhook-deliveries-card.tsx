import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import type { WebhookDelivery } from "@/lib/db/schema";

const STATUS_TONE = {
  ok: "safe",
  invalid_signature: "critical",
  error: "medium",
} as const;

const STATUS_LABEL = {
  ok: "ok",
  invalid_signature: "invalid signature",
  error: "error",
} as const;

export function WebhookDeliveriesCard({ slug, repoSlug, deliveries }: { slug: string; repoSlug: string; deliveries: WebhookDelivery[] }) {
  if (deliveries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent webhook deliveries</CardTitle>
        <CardDescription>Every inbound GitHub webhook request, verified or not - the same view GitHub&apos;s own webhook settings show.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {deliveries.map((delivery) => (
            <li key={delivery.id} className="flex items-center justify-between gap-3 border-t border-steel-800 py-2 text-sm first:border-t-0">
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[delivery.status]}>{STATUS_LABEL[delivery.status]}</Badge>
                <span className="text-steel-300">{delivery.eventType ?? "unknown event"}</span>
                {delivery.scanId ? (
                  <Link href={`/app/${slug}/${repoSlug}/scans/${delivery.scanId}`} className="text-xs text-cobalt-400 hover:text-cobalt-300">
                    view scan #{delivery.scanId}
                  </Link>
                ) : null}
                {delivery.errorMessage ? <span className="text-xs text-steel-500">{delivery.errorMessage}</span> : null}
              </div>
              <span className="shrink-0 text-xs text-steel-500">{formatRelativeTime(delivery.createdAt)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
