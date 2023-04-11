import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const configSchema = z.object({
  failOn: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  repo: z.string().optional(),
  exclude: z.array(z.string()).optional(),
});

export type WardenConfig = z.infer<typeof configSchema>;

/**
 * An optional warden.config.json in the scan target's own directory -
 * the same convention eslint/prettier/tsconfig use, so a repo doesn't
 * have to repeat --fail-on/--repo on every CI invocation or every
 * developer's local run. CLI flags still take precedence over this when
 * both are given; this only supplies the default a flag would otherwise
 * need to repeat. A missing file is normal (returns {}, not an error);
 * a present-but-malformed one prints a warning to stderr and falls back
 * to {} rather than crashing the scan over a config problem.
 */
export function loadConfig(dir: string): WardenConfig {
  const configPath = join(dir, "warden.config.json");
  if (!existsSync(configPath)) return {};

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error(`warning: ${configPath} is not valid JSON (${err instanceof Error ? err.message : String(err)}) - ignoring it`);
    return {};
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`warning: ${configPath} has an invalid shape (${parsed.error.issues[0]?.message}) - ignoring it`);
    return {};
  }
  return parsed.data;
}
