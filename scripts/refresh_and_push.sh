#!/usr/bin/env bash
set -euo pipefail
ROOT="/workspace/stock-tracker"
LOCK="$ROOT/.refresh.lock"
LOG="$ROOT/refresh.log"
PUBLISH="$ROOT/.gh-pages-worktree"
cd "$ROOT"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') skip: another refresh is running" >>"$LOG"
  exit 0
fi
export TZ=Europe/London
dow=$(date +%u); hour=$(date +%-H); minute=$(date +%-M)
in_session=0
if [[ "$dow" -ge 1 && "$dow" -le 5 ]]; then
  if [[ "$hour" -ge 8 && "$hour" -le 20 ]]; then in_session=1
  elif [[ "$hour" -eq 21 && "$minute" -le 30 ]]; then in_session=1; fi
fi
if [[ "$in_session" -eq 0 && "$minute" -ne 0 ]]; then exit 0; fi

log() { echo "$*" >>"$LOG"; }

{
  echo "---- $(date -u +'%Y-%m-%dT%H:%M:%SZ') London=$(date +'%Y-%m-%d %H:%M %Z') session=$in_session ----"
  python3 scripts/fetch_quotes.py
  git add -- data/market.json
  if git diff --cached --quiet -- data/market.json; then
    echo "no change"; exit 0
  fi
  git -c user.email="jt@users.noreply.github.com" -c user.name="JT Chan" commit -m "data: refresh"
  git push origin main

  # Ensure publish worktree
  if [[ ! -d "$PUBLISH/.git" && ! -f "$PUBLISH/.git" ]]; then
    rm -rf "$PUBLISH"
    git fetch origin gh-pages:gh-pages 2>/dev/null || true
    if git show-ref --verify --quiet refs/heads/gh-pages; then
      git worktree add "$PUBLISH" gh-pages
    else
      git worktree add -b gh-pages "$PUBLISH" main
    fi
  fi
  # Copy only publishable files
  for f in index.html app.js styles.css holdings.json .nojekyll README.md; do
    cp -f "$ROOT/$f" "$PUBLISH/$f"
  done
  mkdir -p "$PUBLISH/data"
  cp -f "$ROOT/data/market.json" "$PUBLISH/data/market.json"
  # Remove any accidental workflow/junk
  rm -rf "$PUBLISH/.github" "$PUBLISH/scripts" "$PUBLISH/screenshot"* "$PUBLISH/refresh.log" "$PUBLISH/.refresh.lock" 2>/dev/null || true
  git -C "$PUBLISH" add -- index.html app.js styles.css holdings.json .nojekyll README.md data/market.json
  if ! git -C "$PUBLISH" diff --cached --quiet; then
    git -C "$PUBLISH" -c user.email="jt@users.noreply.github.com" -c user.name="JT Chan" commit -m "data: refresh"
    git -C "$PUBLISH" push origin gh-pages
  else
    echo "gh-pages unchanged"
  fi
  echo "pushed main=$(git rev-parse --short HEAD)"
} >>"$LOG" 2>&1
