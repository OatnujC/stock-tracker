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
# Off-hours: top of hour only. In-session: allow scheduled ticks (crontab */10).
if [[ "$in_session" -eq 0 && "$minute" -ne 0 ]]; then exit 0; fi

meaningful_change() {
  python3 - <<'PY'
import json, pathlib, subprocess, math
root = pathlib.Path('.')
new = json.loads((root/'data/market.json').read_text())
try:
    old_txt = subprocess.check_output(['git','show','HEAD:data/market.json'], text=True)
    old = json.loads(old_txt)
except Exception:
    raise SystemExit(0)  # treat as changed
def price_map(doc):
    out={}
    for k,v in (doc.get('holdings') or {}).items():
        p=v.get('price')
        if isinstance(p,(int,float)): out[f'h:{k}']=round(p,4)
    for k,v in (doc.get('markets') or {}).items():
        p=v.get('price')
        if isinstance(p,(int,float)): out[f'm:{k}']=round(p,4)
    return out
a,b=price_map(old),price_map(new)
if a!=b:
    raise SystemExit(0)
# also publish if series lengths changed a lot (new trading day)
def lens(doc):
    return {k: (len((v or {}).get('intraday1d') or []), len((v or {}).get('daily1y') or [])) for k,v in (doc.get('holdings') or {}).items()}
if lens(old)!=lens(new):
    raise SystemExit(0)
raise SystemExit(1)
PY
}

publish_gh_pages() {
  local ver
  ver=$(git rev-parse --short HEAD)
  if [[ ! -d "$PUBLISH" ]]; then
    git fetch origin gh-pages:gh-pages 2>/dev/null || true
    git worktree add "$PUBLISH" gh-pages
  fi
  # Ensure worktree on gh-pages tip
  git -C "$PUBLISH" fetch origin gh-pages 2>/dev/null || true
  git -C "$PUBLISH" checkout gh-pages
  git -C "$PUBLISH" reset --hard origin/gh-pages 2>/dev/null || git -C "$PUBLISH" reset --hard gh-pages
  for f in app.js styles.css holdings.json .nojekyll README.md; do
    cp -f "$ROOT/$f" "$PUBLISH/$f"
  done
  mkdir -p "$PUBLISH/data"
  cp -f "$ROOT/data/market.json" "$PUBLISH/data/market.json"
  # Stamp cache-busting version into HTML
  sed "s/ASSET_VERSION/${ver}/g" "$ROOT/index.html" > "$PUBLISH/index.html"
  rm -rf "$PUBLISH/.github" "$PUBLISH/scripts" "$PUBLISH/screenshot"* "$PUBLISH/refresh.log" "$PUBLISH/.refresh.lock" 2>/dev/null || true
  git -C "$PUBLISH" add -- index.html app.js styles.css holdings.json .nojekyll README.md data/market.json
  if ! git -C "$PUBLISH" diff --cached --quiet; then
    # Brief pause to reduce overlap with an in-flight Pages build
    sleep 8
    git -C "$PUBLISH" -c user.email="jt@users.noreply.github.com" -c user.name="JT Chan" commit -m "data: refresh"
    git -C "$PUBLISH" push origin gh-pages
  else
    echo "gh-pages unchanged"
  fi
}

{
  echo "---- $(date -u +'%Y-%m-%dT%H:%M:%SZ') London=$(date +'%Y-%m-%d %H:%M %Z') session=$in_session ----"
  # Stay in step with GitHub: drop local data-only commits, keep code.
  git fetch -q origin main gh-pages || true
  if [[ -z "$(git log --format=%s origin/main..HEAD | grep -v '^data: refresh$' || true)" ]]; then
    git reset -q --keep origin/main || true
  fi
  python3 scripts/fetch_quotes.py
  if ! meaningful_change; then
    echo "no meaningful price change"
    exit 0
  fi
  git add -- data/market.json
  if git diff --cached --quiet -- data/market.json; then
    echo "no file change"; exit 0
  fi
  git -c user.email="jt@users.noreply.github.com" -c user.name="JT Chan" commit -m "data: refresh"
  git push origin main || echo "WARN: main push failed; publishing site anyway"
  publish_gh_pages
  echo "pushed main=$(git rev-parse --short HEAD)"
} >>"$LOG" 2>&1
