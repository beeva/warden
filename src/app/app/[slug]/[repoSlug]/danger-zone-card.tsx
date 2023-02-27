"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DangerZoneCard({ slug, repoSlug }: { slug: string; repoSlug: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmText !== repoSlug) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/repos/${repoSlug}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete repo");
        return;
      }
      router.push(`/app/${slug}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-crimson-500/30">
      <CardHeader>
        <CardTitle className="text-crimson-400">Danger zone</CardTitle>
        <CardDescription>Deletes this repo and every scan and finding recorded against it. This can&apos;t be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDelete} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="confirm-slug">
              Type <span className="font-mono text-steel-200">{repoSlug}</span> to confirm
            </Label>
            <Input id="confirm-slug" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="max-w-xs" />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-crimson-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={submitting || confirmText !== repoSlug} className="w-fit border-crimson-500/50 text-crimson-400 hover:border-crimson-400">
            {submitting ? "Deleting…" : "Delete repo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
