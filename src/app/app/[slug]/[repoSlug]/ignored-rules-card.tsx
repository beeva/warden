"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function IgnoredRulesCard({ slug, repoSlug, ignoredRuleIds }: { slug: string; repoSlug: string; ignoredRuleIds: string[] }) {
  const router = useRouter();
  const [newRuleId, setNewRuleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(next: string[]) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/repos/${repoSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoredRuleIds: next }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update ignored rules");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ruleId = newRuleId.trim();
    if (!ruleId || ignoredRuleIds.includes(ruleId)) return;
    await save([...ignoredRuleIds, ruleId]);
    setNewRuleId("");
  }

  async function handleRemove(ruleId: string) {
    await save(ignoredRuleIds.filter((id) => id !== ruleId));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ignored rules</CardTitle>
        <CardDescription>
          Findings from these rules are dropped before a scan is even recorded, for this repo only. See{" "}
          <Link href="/rules" className="text-cobalt-400 hover:text-cobalt-300">
            all rule ids
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ignoredRuleIds.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {ignoredRuleIds.map((ruleId) => (
              <li key={ruleId} className="flex items-center gap-1.5 rounded-full bg-steel-800 px-2.5 py-0.5 text-xs text-steel-300">
                <code>{ruleId}</code>
                <button type="button" disabled={pending} onClick={() => handleRemove(ruleId)} className="text-steel-500 hover:text-crimson-400" aria-label={`Remove ${ruleId}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-steel-500">No rules ignored - every detector applies to this repo.</p>
        )}
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input value={newRuleId} onChange={(event) => setNewRuleId(event.target.value)} placeholder="floating-pragma" className="flex-1" />
          <Button type="submit" variant="outline" size="sm" disabled={pending || !newRuleId.trim()}>
            Add
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
