export function wardenWorkflowTemplate(repoSlug: string): string {
  return `name: Warden

on:
  push:
    branches: [main]
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/warden@v1
        with:
          path: .
          fail-on: critical
          repo: ${repoSlug}
          token: \${{ secrets.WARDEN_TOKEN }}
`;
}
