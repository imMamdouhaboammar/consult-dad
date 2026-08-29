#!/usr/bin/env bash
# check-escalation.sh — Pre-flight triage for AI worker agents
# Exits 0 if escalation is recommended, exits 1 if normal work should continue.

set -euo pipefail

FAIL_COUNT="${1:-0}"
IS_CROSSROADS="${2:-false}"
IS_CONCURRENCY="${3:-false}"

if [ "$FAIL_COUNT" -ge 2 ]; then
  echo "🚨 Escalation recommended: 2+ failed attempts reached ($FAIL_COUNT attempts)."
  exit 0
fi

if [ "$IS_CROSSROADS" = "true" ]; then
  echo "🚨 Escalation recommended: Architectural crossroads detected."
  exit 0
fi

if [ "$IS_CONCURRENCY" = "true" ]; then
  echo "🚨 Escalation recommended: Concurrency / race condition detected."
  exit 0
fi

echo "✅ Normal execution: No escalation trigger met."
exit 1
