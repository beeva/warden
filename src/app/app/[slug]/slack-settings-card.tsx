"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SlackSettingsCard({ slug, connected }: { slug: string; connected: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function updateWebhook(slackWebhookUrl: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/slack`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slackWebhookUrl }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update Slack webhook");
        return;
      }
      setUrl("");
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
        <CardTitle>Slack notifications</CardTitle>
        <CardDescription>Posts to this webhook whenever a scan crosses a repo&apos;s CI-gate threshold.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
              placeholder="https://hooks.slack.com/services/..."
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
