"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OrgDangerZoneCard({ slug }: { slug: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmText !== slug) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete org");
        return;
      }
      router.push("/app");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-crimson-500/30">
      <CardHeader>
        <CardTitle className="text-crimson-400">Danger zone</CardTitle>
        <CardDescription>
          Deletes this org and every repo, scan, finding, member, token, and invite in it. This can&apos;t be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDelete} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="confirm-org-slug">
              Type <span className="font-mono text-steel-200">{slug}</span> to confirm
            </Label>
            <Input id="confirm-org-slug" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="max-w-xs" />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-crimson-400">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="outline"
            disabled={submitting || confirmText !== slug}
            className="w-fit border-crimson-500/50 text-crimson-400 hover:border-crimson-400"
          >
            {submitting ? "Deleting…" : "Delete org"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
