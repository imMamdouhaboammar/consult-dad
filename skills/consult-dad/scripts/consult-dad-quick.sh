#!/usr/bin/env bash
# consult-dad-quick.sh — Fast agent CLI escalation wrapper
set -euo pipefail

if ! command -v dad >/dev/null 2>&1; then
  echo "Error: 'dad' CLI binary not found in PATH. Run 'bun run src/cli/index.ts' or install globally." >&2
  exit 1
fi

dad ask "$@"
