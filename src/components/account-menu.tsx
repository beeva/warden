"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, LinkButton } from "@/components/ui/button";

export function AccountMenu() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <LinkButton href="/app/settings" variant="ghost" size="sm">
        Settings
      </LinkButton>
      <Button type="button" variant="ghost" size="sm" disabled={signingOut} onClick={handleSignOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

export function AppNavBar() {
  return (
    <div className="container-page flex items-center justify-between py-4">
      <Link href="/app" className="font-display text-lg text-steel-50">
        Warden
      </Link>
      <AccountMenu />
    </div>
  );
}
