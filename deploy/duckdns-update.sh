#!/bin/sh
# Point a DuckDNS name at this network's current public IP, but only when it has changed.
#
# Runs every 5 minutes as the duckdns-updater CronJob (deploy/k8s/duckdns.yaml), and can also be
# run by hand:
#   DUCKDNS_TOKEN=... ./deploy/duckdns-update.sh
#
# Env:
#   DUCKDNS_TOKEN   required; your DuckDNS account token (never logged)
#   DUCKDNS_DOMAIN  subdomain without .duckdns.org (default: vectordemo)
#   FORCE=1         update even if DNS already matches
set -eu

DOMAIN="${DUCKDNS_DOMAIN:-vectordemo}"
: "${DUCKDNS_TOKEN:?DUCKDNS_TOKEN is not set}"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

is_ipv4() { echo "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; }

# Current public IPv4, from the first service that answers sensibly.
current=""
for url in https://api.ipify.org https://ipv4.icanhazip.com https://ifconfig.me/ip; do
  ip=$(curl -fsS --max-time 10 "$url" 2>/dev/null | tr -d '[:space:]') || continue
  if is_ipv4 "$ip"; then current="$ip"; break; fi
done
if [ -z "$current" ]; then
  log "ERROR: could not determine the public IP"
  exit 1
fi

# What the name resolves to now (DNS over HTTPS, so no resolver tools are needed).
published=$(curl -fsS --max-time 10 -H 'accept: application/dns-json' \
  "https://cloudflare-dns.com/dns-query?name=${DOMAIN}.duckdns.org&type=A" 2>/dev/null \
  | grep -o '"data":"[0-9.]*"' | head -n 1 | cut -d '"' -f 4) || published=""

if [ "$current" = "$published" ] && [ "${FORCE:-0}" != "1" ]; then
  log "${DOMAIN}.duckdns.org already points to ${current}; nothing to do"
  exit 0
fi

log "updating ${DOMAIN}.duckdns.org: ${published:-unknown} -> ${current}"
# The token is passed in the URL, so keep curl from echoing the URL on failure.
response=$(curl -fsS --max-time 15 \
  "https://www.duckdns.org/update?domains=${DOMAIN}&token=${DUCKDNS_TOKEN}&ip=${current}" 2>/dev/null) || {
  log "ERROR: request to DuckDNS failed"
  exit 1
}
if [ "$response" != "OK" ]; then
  log "ERROR: DuckDNS answered '${response}' (check the token and domain)"
  exit 1
fi
log "updated ${DOMAIN}.duckdns.org to ${current}"
