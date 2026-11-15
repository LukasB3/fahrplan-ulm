#!/usr/bin/env bash
# Builds and (re)starts the API from a checkout in /opt/fahrplan-ulm, and
# installs what a release can change outside of it: the unit and the Caddyfile.
# Usage: sudo ./deploy.sh [git-ref]
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
repo=/opt/fahrplan-ulm
ref=${1:-main}

if [[ ! -d $repo/.git ]]; then
  git clone --quiet https://github.com/LukasB3/fahrplan-ulm.git "$repo"
fi
git -C "$repo" fetch --quiet origin
git -C "$repo" checkout --quiet --detach "origin/$ref"
# The checkout may have brought a new version of this script. Start over with it.
if [[ -z ${DEPLOY_RESTARTED:-} ]]; then
  DEPLOY_RESTARTED=1 exec "$repo/infra/deploy.sh" "$ref"
fi

cd "$repo/api"
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm prune --omit=dev --no-audit --no-fund

cd "$repo/infra"
install -o root -g root -m 644 fahrplan-ulm.service /etc/systemd/system/fahrplan-ulm.service
systemctl daemon-reload
systemctl enable --quiet fahrplan-ulm
systemctl restart fahrplan-ulm

# A Caddyfile that does not validate is not installed; the old one stays.
if ! cmp --silent Caddyfile /etc/caddy/Caddyfile; then
  problems=$(caddy validate --adapter caddyfile --config Caddyfile 2>&1) || { echo "$problems" >&2; exit 1; }
  install -o root -g root -m 644 Caddyfile /etc/caddy/Caddyfile
  systemctl reload caddy || systemctl restart caddy
fi

sleep 2
systemctl --no-pager --lines=5 status fahrplan-ulm
curl -fsS http://127.0.0.1:8787/api/health && echo
