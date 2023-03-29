"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export interface PendingInvite {
  id: number;
  role: "owner" | "member";
  expiresAt: string;
  createdAt: string;
}

export function InvitesCard({ slug, invites }: { slug: string; invites: PendingInvite[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  async function handleCreate(role: "owner" | "member") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await response.json().catch(() => ({}))) as { inviteUrl?: string; error?: string };
      if (!response.ok || !data.inviteUrl) {
        setError(data.error ?? "Could not create invite");
        return;
      }
      setLastInviteUrl(data.inviteUrl);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(inviteId: number) {
    setPending(true);
    try {
      await fetch(`/api/orgs/${slug}/invites/${inviteId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite links</CardTitle>
        <CardDescription>No email service here - copy a link and send it however you normally would. Single-use, expires in 7 days.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {lastInviteUrl ? (
          <div className="rounded-lg border border-mint-500/30 bg-mint-500/10 p-3 text-sm">
            <p className="text-mint-400">Copy this link:</p>
            <code className="mt-1 block break-all font-mono text-xs text-steel-100">{lastInviteUrl}</code>
          </div>
        ) : null}
        {invites.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-steel-300">
                  {invite.role} · expires {formatDate(invite.expiresAt)}
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => handleRevoke(invite.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-steel-500">No pending invites.</p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleCreate("member")}>
            Invite a member
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleCreate("owner")}>
            Invite an owner
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-crimson-400">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
