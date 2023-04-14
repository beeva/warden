"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export interface ApiTokenRow {
  id: number;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const EXPIRY_OPTIONS = [
  { label: "Never expires", value: "" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "1 year", value: "365" },
];

export function TokensCard({ slug, tokens, isOwner }: { slug: string; tokens: ApiTokenRow[]; isOwner: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, expiresInDays: expiresInDays ? Number(expiresInDays) : null }),
      });
      const data = (await response.json().catch(() => ({}))) as { token?: { raw: string }; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not create token");
        return;
      }
      setLabel("");
      setExpiresInDays("");
      setRevealedToken(data.token?.raw ?? null);
      router.refresh();
    } catch {
      setError("Something went wrong - try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(tokenId: number) {
    await fetch(`/api/orgs/${slug}/tokens/${tokenId}`, { method: "DELETE" });
    router.refresh();
  }

  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>API tokens</CardTitle>
        <CardDescription>Used by `warden scan --upload` and CI to authenticate against this org.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {revealedToken ? (
          <div className="rounded-lg border border-mint-500/30 bg-mint-500/10 p-3 text-sm">
            <p className="text-mint-400">Copy this now - it won&apos;t be shown again:</p>
            <code className="mt-1 block break-all font-mono text-xs text-steel-100">{revealedToken}</code>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => {
            const expired = token.expiresAt ? new Date(token.expiresAt).getTime() <= Date.now() : false;
            return (
              <li key={token.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className={expired ? "text-crimson-400" : "text-steel-200"}>{token.label}</span>
                  <span className="ml-2 text-xs text-steel-500">
                    created {formatDate(token.createdAt)}
                    {token.lastUsedAt ? `, last used ${formatDate(token.lastUsedAt)}` : ", never used"}
                    {token.expiresAt ? `, ${expired ? "expired" : "expires"} ${formatDate(token.expiresAt)}` : ", never expires"}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRevoke(token.id)}>
                  Revoke
                </Button>
              </li>
            );
          })}
        </ul>
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="ci-github-actions" required className="flex-1" />
          <select
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
            className="rounded-md border border-steel-700 bg-steel-900 px-2 text-xs text-steel-200"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" disabled={submitting}>
            {submitting ? "Creating…" : "New token"}
          </Button>
        </form>
        {error ? (
          <p role="alert" className="text-sm text-crimson-400">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
