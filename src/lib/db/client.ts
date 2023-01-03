// No "server-only" guard here: this module is also imported directly by
// standalone scripts (scripts/evals.ts, scripts/migrate.ts, scripts/seed.ts,
// and the CLI's own server-upload path) run through tsx, outside of Next's
// build pipeline where that guard is enforced - it throws even in a genuine
// server-only context run that way. node:postgres already makes this
// unbundlable for the browser regardless, which is the guard's actual
// purpose here.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __wardenQueryClient: ReturnType<typeof postgres> | undefined;
  var __wardenDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function getQueryClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Reuse the connection pool across hot reloads in dev instead of opening
  // a fresh one per module reload.
  if (!globalThis.__wardenQueryClient) {
    globalThis.__wardenQueryClient = postgres(connectionString);
  }
  return globalThis.__wardenQueryClient;
}

// Connecting lazily, on first use, rather than at module load - a module
// that exports both DB-backed functions and plain pure ones shouldn't
// require DATABASE_URL just because a unit test imports only the pure
// half (the detector engine and scoring functions are like this).
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (!globalThis.__wardenDb) {
      globalThis.__wardenDb = drizzle(getQueryClient(), { schema });
    }
    return Reflect.get(globalThis.__wardenDb, prop, receiver);
  },
});
