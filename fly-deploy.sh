#!/usr/bin/env bash
# One-step Fly.io deploy for ReserveWatch. Run AFTER `flyctl auth login` (or with FLY_API_TOKEN set).
# Usage: ./fly-deploy.sh [app-name]   (default: reservewatch; fallback suggestion: thereservewatch)
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.fly/bin:$PATH"
APP="${1:-reservewatch}"
REGION="iad"

flyctl auth whoami
# fly.toml app name follows the argument
sed -i "s/^app = .*/app = \"$APP\"/" fly.toml

# 1. Create app (no-op if it already exists in your org)
flyctl apps list --json | grep -q "\"Name\": *\"$APP\"" || flyctl apps create "$APP"

# 2. Persistent volume for latest.json / alerts.log (1 GB, ~$0.15/mo)
flyctl volumes list -a "$APP" --json | grep -q reservewatch_data || \
  flyctl volumes create reservewatch_data --size 1 --region "$REGION" -a "$APP" --yes

# 3. Secret for POST /api/refresh (required in production)
flyctl secrets list -a "$APP" | grep -q REFRESH_TOKEN || \
  flyctl secrets set REFRESH_TOKEN="$(openssl rand -hex 24)" -a "$APP" --stage

# 4. Build remotely (no local Docker needed) and deploy a single always-on machine
flyctl deploy -a "$APP" --remote-only --ha=false

# 5. Public IPs (shared IPv4 is free; dedicated IPv4 is $2/mo — only needed for apex A record if you want it)
flyctl ips list -a "$APP"

# 6. TLS certs for the custom domain
flyctl certs add thereservewatch.com -a "$APP" || true
flyctl certs add www.thereservewatch.com -a "$APP" || true
flyctl certs setup thereservewatch.com -a "$APP" || flyctl certs show thereservewatch.com -a "$APP"
flyctl certs setup www.thereservewatch.com -a "$APP" || flyctl certs show www.thereservewatch.com -a "$APP"

echo "Live at: https://$APP.fly.dev   (health: https://$APP.fly.dev/healthz)"
