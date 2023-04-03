"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LeaveOrgButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleLeave() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/leave`, { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not leave this org");
        return;
      }
      router.push("/app");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Leave org
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-crimson-400">{error}</span> : null}
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleLeave} className="text-crimson-400">
        {pending ? "Leaving…" : "Confirm leave"}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
