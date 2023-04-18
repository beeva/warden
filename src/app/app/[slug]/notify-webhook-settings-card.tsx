"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotifyWebhookSettingsCard({ slug, connected }: { slug: string; connected: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  async function updateWebhook(notifyWebhookUrl: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/notify-webhook`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyWebhookUrl }),
      });
      const data = (await response.json().catch(() => ({}))) as { secret?: string | null; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update the notify webhook");
        return;
      }
      setUrl("");
      setRevealedSecret(data.secret ?? null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateWebhook(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generic webhook</CardTitle>
        <CardDescription>
          Signed POST (HMAC-SHA256, <code>X-Warden-Signature</code>) to any https:// URL whenever a scan crosses a repo&apos;s CI-gate
          threshold - for anything Slack doesn&apos;t cover.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {revealedSecret ? (
          <div className="rounded-lg border border-mint-500/30 bg-mint-500/10 p-3 text-sm">
            <p className="text-mint-400">Signing secret - copy this now, it won&apos;t be shown again:</p>
            <code className="mt-1 block break-all font-mono text-xs text-steel-100">{revealedSecret}</code>
          </div>
        ) : null}
        {connected ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-mint-400">Connected</span>
            <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => updateWebhook(null)}>
              Disconnect
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/warden-webhook"
              required
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={submitting}>
              {submitting ? "Connecting…" : "Connect"}
            </Button>
          </form>
        )}
        {error ? (
          <p role="alert" className="text-sm text-crimson-400">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
