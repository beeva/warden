import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const linkClass = "rounded-md border border-steel-700 px-3 py-1 text-xs text-steel-300 hover:border-cobalt-500 hover:text-cobalt-400";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between pt-2 text-xs text-steel-500">
      <Link href={`${basePath}?page=${page - 1}`} className={cn(linkClass, page <= 1 && disabledClass)} aria-disabled={page <= 1}>
        ← Previous
      </Link>
      <span>
        Page {page} of {totalPages}
      </span>
      <Link href={`${basePath}?page=${page + 1}`} className={cn(linkClass, page >= totalPages && disabledClass)} aria-disabled={page >= totalPages}>
        Next →
      </Link>
    </div>
  );
}

/** Clamped, non-NaN page number from a raw searchParam value - a missing, malformed, zero, or negative value all fall back to page 1 rather than producing a broken offset. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
