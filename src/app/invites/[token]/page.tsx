"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InvitePreview {
  orgName: string;
  role: string;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${params.token}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as InvitePreview & { error?: string };
        if (!response.ok) {
          setError(data.error ?? "This invite link isn't valid");
          return;
        }
        setPreview(data);
      })
      .catch(() => setError("Something went wrong - try again"))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const response = await fetch(`/api/invites/${params.token}/accept`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { orgSlug?: string; error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=/invites/${params.token}`);
          return;
        }
        setError(data.error ?? "Could not accept this invite");
        return;
      }
      router.push(`/app/${data.orgSlug}`);
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join on Warden</CardTitle>
          {preview ? <CardDescription>You&apos;ve been invited to join {preview.orgName} as {preview.role}.</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? <p className="text-sm text-steel-500">Loading…</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-crimson-400">
              {error}
            </p>
          ) : null}
          {preview ? (
            <Button type="button" disabled={accepting} onClick={handleAccept} className="w-full">
              {accepting ? "Joining…" : `Accept and join ${preview.orgName}`}
            </Button>
          ) : null}
          <p className="text-center text-sm text-steel-400">
            Not signed in?{" "}
            <Link href={`/login?next=/invites/${params.token}`} className="text-cobalt-400 hover:text-cobalt-300">
              Sign in
            </Link>{" "}
            or{" "}
            <Link href="/signup" className="text-cobalt-400 hover:text-cobalt-300">
              create an account
            </Link>{" "}
            first.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
