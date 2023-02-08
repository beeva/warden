import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-steel-800">
      <div className="container-page flex items-center justify-between py-4">
        <Link href="/" className="font-display text-lg text-steel-50">
          Warden
        </Link>
        <nav className="flex items-center gap-2">
          <LinkButton href="/docs" variant="ghost" size="sm">
            Docs
          </LinkButton>
          <LinkButton href="/login" variant="outline" size="sm">
            Sign in
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
