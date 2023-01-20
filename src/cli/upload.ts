import type { ScanFileResult } from "../lib/detectors/types";

export interface UploadOptions {
  apiUrl: string;
  token: string;
  repoSlug: string;
  commitSha?: string;
  branch?: string;
}

export interface UploadResponse {
  scanId: number;
  blocked: boolean;
}

/**
 * Real HTTP POST to the dashboard's ingestion API - this is what makes a
 * local `warden scan` and a CI run show up in the same audit trail as a
 * scan triggered from the web app, not a separate, disconnected history.
 */
export async function uploadResults(results: ScanFileResult[], options: UploadOptions): Promise<UploadResponse> {
  const findings = results.flatMap((r) =>
    r.findings.map((f) => ({
      filePath: r.filePath,
      ruleId: f.ruleId,
      severity: f.severity,
      line: f.line,
      column: f.column,
      message: f.message,
      snippet: f.snippet,
      fixSuggestion: f.fixSuggestion,
    }))
  );

  const response = await fetch(`${options.apiUrl}/api/v1/scans`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({
      repoSlug: options.repoSlug,
      commitSha: options.commitSha,
      branch: options.branch,
      filesScanned: results.length,
      findings,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`upload failed: ${response.status} ${response.statusText} ${body}`.trim());
  }

  return (await response.json()) as UploadResponse;
}
