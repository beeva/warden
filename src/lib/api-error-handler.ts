import { NextResponse } from "next/server";

/**
 * Wraps a route handler so an unexpected throw (most commonly the DB
 * being unreachable) becomes a clean JSON 503 instead of an opaque,
 * bodyless 500 - Next's default behavior for an uncaught exception in a
 * route handler is to log server-side and send an empty response, which
 * looks like a broken deployment rather than a transient, retriable
 * failure from the client's perspective (and CI logs specifically need a
 * body to explain why a scan upload failed).
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "temporarily unavailable, try again" }, { status: 503 });
    }
  };
}
