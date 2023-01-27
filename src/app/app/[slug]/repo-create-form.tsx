"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RepoCreateForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not create repo");
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Something went wrong - try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="my-protocol" required className="flex-1" />
      <Button type="submit" variant="outline" disabled={submitting}>
        {submitting ? "Adding…" : "Add repo"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-crimson-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
