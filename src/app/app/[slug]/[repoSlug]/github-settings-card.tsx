"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConnectResponse {
  webhookUrl: string;
  webhookSecret: string;
}

export function GithubSettingsCard({ slug, repoSlug, connected }: { slug: string; repoSlug: string; connected: boolean }) {
  const router = useRouter();
  const [cloneUrl, setCloneUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justConnected, setJustConnected] = useState<ConnectResponse | null>(null);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/repos/${repoSlug}/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloneUrl }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<ConnectResponse> & { error?: string };
      if (!response.ok || !data.webhookUrl || !data.webhookSecret) {
        setError(data.error ?? "Could not connect GitHub");
        return;
      }
      setJustConnected({ webhookUrl: data.webhookUrl, webhookSecret: data.webhookSecret });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    setSubmitting(true);
    try {
      await fetch(`/api/orgs/${slug}/repos/${repoSlug}/github`, { method: "DELETE" });
      setJustConnected(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub push-triggered scanning</CardTitle>
        <CardDescription>Warden shallow-clones and scans this repo server-side on every push - no CI runner or CLI needed.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {justConnected ? (
          <div className="rounded-lg border border-mint-500/30 bg-mint-500/10 p-3 text-sm">
            <p className="text-mint-400">Add this as a webhook in your GitHub repo settings (Settings → Webhooks → Add webhook), content type application/json:</p>
            <code className="mt-1 block break-all font-mono text-xs text-steel-100">Payload URL: {justConnected.webhookUrl}</code>
            <code className="mt-1 block break-all font-mono text-xs text-steel-100">Secret (copy now - it won&apos;t be shown again): {justConnected.webhookSecret}</code>
          </div>
        ) : null}
        {connected ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-mint-400">Connected</span>
            <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="clone-url">Repo clone URL</Label>
              <Input
                id="clone-url"
                value={cloneUrl}
                onChange={(event) => setCloneUrl(event.target.value)}
                placeholder="https://github.com/you/your-repo.git"
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={submitting} className="mt-6 h-fit">
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
