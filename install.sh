#!/usr/bin/env bash
# ==============================================================================
# Consult Dad — Universal One-Line Installer & Cross-Agent Skill Distributor
# Usage: curl -fsSL https://raw.githubusercontent.com/imMamdouhaboammar/consult-dad/main/install.sh | bash
# ==============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}"
echo "   ____                       _ _     ____            _ "
echo "  / ___|___  _ __  ___ _   _| | |_  |  _ \  __ _  __| |"
echo " | |   / _ \| '_ \/ __| | | | | __| | | | |/ _\` |/ _\` |"
echo " | |__| (_) | | | \__ \ |_| | | |_  | |_| | (_| | (_| |"
echo "  \____\___/|_| |_|___/\__,_|_|\__| |____/ \__,_|\__,_|"
echo -e "${RESET}"
echo -e "${BOLD}Local escalation bridge for AI coding agents${RESET}\n"

# 1. Detect Bun runtime
if ! command -v bun >/dev/null 2>&1; then
  echo -e "${YELLOW}⚡ Bun runtime not found. Installing Bun...${RESET}"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo -e "${RED}❌ Failed to locate or install Bun. Please install Bun from https://bun.sh and retry.${RESET}" >&2
  exit 1
fi

BUN_VERSION=$(bun --version)
echo -e "✓ Found Bun ${GREEN}v${BUN_VERSION}${RESET}"

# 2. Determine target install directory
INSTALL_DIR="${CONSULT_DAD_DIR:-$HOME/.local/share/consult-dad}"
BIN_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

echo -e "📦 Installing Consult Dad into ${BLUE}${INSTALL_DIR}${RESET}..."

# 3. Clone or update repository
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing installation in $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --ff-only || true
else
  # If running locally from repository directory
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
  if [ -f "$SCRIPT_DIR/package.json" ] && grep -q "consult-dad" "$SCRIPT_DIR/package.json" 2>/dev/null; then
    echo "Syncing from local repository..."
    cp -R "$SCRIPT_DIR"/. "$INSTALL_DIR"/
  else
    echo "Cloning latest release from GitHub..."
    git clone --depth 1 https://github.com/imMamdouhaboammar/consult-dad.git "$INSTALL_DIR"
  fi
fi

# 4. Install dependencies and build bundle
echo "🔨 Building binary bundle..."
cd "$INSTALL_DIR"
bun install --frozen-lockfile || bun install
bun run build

# 5. Link executable to PATH
DAD_BIN="$INSTALL_DIR/dist/cli/index.js"
chmod +x "$DAD_BIN"
ln -sf "$DAD_BIN" "$BIN_DIR/dad"
chmod +x "$BIN_DIR/dad"

echo -e "✓ Linked executable to ${GREEN}${BIN_DIR}/dad${RESET}"

# 6. Distribute skill across all agent runtimes
echo -e "\n🤖 Distributing Consult Dad skill across AI agent ecosystems..."
"$BIN_DIR/dad" skill install --all || true

# 7. Run system doctor verification
echo -e "\n🩺 Running Consult Dad Doctor..."
"$BIN_DIR/dad" doctor || true

echo -e "\n${BOLD}${GREEN}🎉 Consult Dad is installed and ready!${RESET}"
echo -e "Make sure ${BLUE}${BIN_DIR}${RESET} is in your PATH."
echo -e "Try running: ${BOLD}dad ask --help${RESET} or ${BOLD}dad doctor${RESET}\n"
