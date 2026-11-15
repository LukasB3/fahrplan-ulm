#!/usr/bin/env bash
# One-time (and re-runnable) host setup on Ubuntu 24.04.
# Usage: sudo ./provision.sh
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
etc=/etc/fahrplan-ulm
data=/var/lib/fahrplan-ulm
export DEBIAN_FRONTEND=noninteractive

echo "== packages"
apt-get update -q
apt-get -y -q install ca-certificates curl git gnupg caddy
# Node 22 from NodeSource's signed package source; Ubuntu's own is older.
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get -y -q install nodejs
fi

# This server has one way in, SSH. The firewall is only ever added to here:
# no defaults, no reset, no enable.
echo "== firewall"
ufw allow 80/tcp
ufw allow 443

echo "== service user and directories"
id -u fahrplan &>/dev/null || useradd --system --home-dir "$data" --shell /usr/sbin/nologin fahrplan
install -d -o fahrplan -g fahrplan -m 750 "$data"
install -d -o root -g fahrplan -m 750 "$etc"

# Settings and secrets of the API. Keys are added by hand, never by a script.
echo "== settings"
if [[ ! -f $etc/api.env ]]; then
  install -o root -g fahrplan -m 640 /dev/null "$etc/api.env"
  echo "WEB_ORIGIN=https://fahrplan-ulm.de" > "$etc/api.env"
fi

systemctl enable caddy
echo
echo "Done. Next: sudo ./deploy.sh"
[[ -f /var/run/reboot-required ]] && echo "A reboot is required to finish the updates."
exit 0
