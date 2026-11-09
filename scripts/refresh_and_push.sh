#!/usr/bin/env bash
# Fetch market.json and push to GitHub only when it changed.
# Intended to run every 5 minutes; self-gates outside market hours.
set -euo pipefail

ROOT="/workspace/stock-tracker"
LOCK="$ROOT/.refresh.lock"
LOG="$ROOT/refresh.log"
cd "$ROOT"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') skip: another refresh is running" >>"$LOG"
  exit 0
fi

export TZ=Europe/London
dow=$(date +%u)    # 1=Mon .. 7=Sun
hour=$(date +%-H)
minute=$(date +%-M)

in_session=0
if [[ "$dow" -ge 1 && "$dow" -le 5 ]]; then
  if [[ "$hour" -ge 8 && "$hour" -le 20 ]]; then
    in_session=1
  elif [[ "$hour" -eq 21 && "$minute" -le 30 ]]; then
    in_session=1
  fi
fi

# Off-hours / weekend: only the top-of-hour tick (hourly)
if [[ "$in_session" -eq 0 && "$minute" -ne 0 ]]; then
  exit 0
fi

{
  echo "---- $(date -u +'%Y-%m-%dT%H:%M:%SZ') London=$(date +'%Y-%m-%d %H:%M %Z') session=$in_session ----"
  python3 scripts/fetch_quotes.py

  git add -- data/market.json
  if git diff --cached --quiet -- data/market.json; then
    echo "no change"
    exit 0
  fi

  git -c user.email="jt@users.noreply.github.com" -c user.name="JT Chan" commit -m "data: refresh"
  git push origin main
  echo "pushed $(git rev-parse --short HEAD)"
} >>"$LOG" 2>&1
