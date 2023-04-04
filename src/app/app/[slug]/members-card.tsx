"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface OrgMember {
  id: number;
  userId: number;
  email: string;
  role: "owner" | "member";
}

export function MembersCard({ slug, members, isOwner }: { slug: string; members: OrgMember[]; isOwner: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);

  async function handleRemove(memberId: number) {
    setRemovingId(memberId);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/members/${memberId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not remove member");
        return;
      }
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRoleChange(memberId: number, role: "owner" | "member") {
    setChangingRoleId(memberId);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not change role");
        return;
      }
      router.refresh();
    } finally {
      setChangingRoleId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not add member");
        return;
      }
      setEmail("");
      router.refresh();
    } catch {
      setError("Something went wrong - try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <select
                    value={member.role}
                    disabled={changingRoleId === member.id}
                    onChange={(event) => handleRoleChange(member.id, event.target.value as "owner" | "member")}
                    className="rounded-md border border-steel-700 bg-steel-900 px-2 py-0.5 text-xs text-steel-200 disabled:opacity-50"
                  >
                    <option value="owner">owner</option>
                    <option value="member">member</option>
                  </select>
                ) : (
                  <Badge tone={member.role === "owner" ? "low" : "neutral"}>{member.role}</Badge>
                )}
                <span className="text-steel-200">{member.email}</span>
              </div>
              {isOwner ? (
                <Button type="button" variant="ghost" size="sm" disabled={removingId === member.id} onClick={() => handleRemove(member.id)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={submitting}>
              {submitting ? "Adding…" : "Add"}
            </Button>
          </form>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-crimson-400">
            {error}
          </p>
        ) : null}
        {isOwner ? <p className="text-xs text-steel-500">They need an account already - this doesn&apos;t send an invite email.</p> : null}
      </CardContent>
    </Card>
  );
}
