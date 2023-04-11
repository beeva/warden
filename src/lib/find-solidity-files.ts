import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "artifacts", "cache", "out", "lib", "forge-cache"]);

/** Every .sol file under `root` - a single file path is returned as-is (matching how most CLI scanners let you point at one file directly). Shared by the CLI and the server-side webhook clone-and-scan path, so both walk a checkout the same way. `extraExcludes` adds to (never replaces) the built-in exclusion list, for a repo-specific vendor/mock directory configured via warden.config.json. */
export function findSolidityFiles(root: string, extraExcludes: string[] = []): string[] {
  const excluded = extraExcludes.length === 0 ? EXCLUDED_DIRS : new Set([...EXCLUDED_DIRS, ...extraExcludes]);

  const stat = statSync(root);
  if (stat.isFile()) return root.endsWith(".sol") ? [root] : [];

  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".sol")) {
        results.push(full);
      }
    }
  };
  walk(root);
  return results.sort();
}
