"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Severity } from "@/lib/db/schema";

const OPTIONS: Severity[] = ["critical", "high", "medium", "low", "info"];

export function RepoSettingsCard({ slug, repoSlug, failThreshold }: { slug: string; repoSlug: string; failThreshold: Severity }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: Severity) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/repos/${repoSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failThreshold: next }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update threshold");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CI-gate threshold</CardTitle>
        <CardDescription>A scan reports `blocked: true` when a finding at or above this severity exists.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <select
          value={failThreshold}
          disabled={pending}
          onChange={(event) => handleChange(event.target.value as Severity)}
          className="w-fit rounded-md border border-steel-700 bg-steel-900 px-3 py-1.5 text-sm text-steel-200 disabled:opacity-50"
        >
          {OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error ? (
          <p role="alert" className="text-sm text-crimson-400">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
