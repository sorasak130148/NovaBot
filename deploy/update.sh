#!/bin/sh
# Pull the latest NovaBot, rebuild and restart the home-server service.
set -eu
cd "$HOME/novabot"
export PATH="$HOME/.local/node/bin:$PATH"
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
systemctl --user restart novabot
echo "NovaBot updated and restarted."
