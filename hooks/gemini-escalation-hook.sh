#!/usr/bin/env bash
# gemini-escalation-hook.sh — Gemini CLI / Antigravity escalation watcher hook
set -euo pipefail

# This hook checks if test or build exit code indicates repeated failure
EXIT_CODE="${1:-0}"
ATTEMPT_COUNT="${2:-1}"

if [ "$EXIT_CODE" -ne 0 ] && [ "$ATTEMPT_COUNT" -ge 2 ]; then
  echo "🚨 [Gemini / Antigravity Escalation Trigger]"
  echo "Task failed on attempt $ATTEMPT_COUNT (exit code $EXIT_CODE)."
  echo "Please invoke consult-dad skill or run 'dad ask --mode diagnose' before making another code change."
fi
