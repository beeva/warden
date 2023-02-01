"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FindingStatus } from "@/lib/db/schema";

const OPTIONS: FindingStatus[] = ["open", "acknowledged", "false_positive", "fixed"];

export function FindingStatusControl({ slug, findingId, status }: { slug: string; findingId: number; status: FindingStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(next: FindingStatus) {
    setPending(true);
    try {
      await fetch(`/api/orgs/${slug}/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(event) => handleChange(event.target.value as FindingStatus)}
      className="rounded-md border border-steel-700 bg-steel-900 px-2 py-1 text-xs text-steel-200 disabled:opacity-50"
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
