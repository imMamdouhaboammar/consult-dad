#!/bin/sh
# Consult Dad — Claude Code PreToolUse Hook
# Detects repeated tool failures and prompts the agent to consider consulting Dad

if [ -f ".consult-dad/config.json" ] || [ -d "$HOME/.local/state/consult-dad" ]; then
  # Advisory reminder if needed
  :
fi
exit 0
