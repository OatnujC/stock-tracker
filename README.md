# JT's Book.

A custom dark market dashboard: https://oatnujc.github.io/stock-tracker/

Pure static HTML, CSS and JavaScript. No npm, build step, API keys or embedded TradingView widgets. The page includes an eight-cell markets grid, a Combined/All performance chart and seven uniform watchlist cards. TradingView links open external symbol pages.

## Run locally

Serve the repository with `python3 -m http.server 8000`, then open http://localhost:8000. A web server is required so the browser can fetch `data/market.json`.

## Data and refresh

The UI reads `holdings.json` and the relative file `data/market.json`. GitHub Actions runs `scripts/fetch_quotes.py` approximately every 10 minutes using Yahoo Finance's unofficial chart API, then commits and pushes changed JSON. The workflow also supports **Run workflow** (`workflow_dispatch`). It uses the standard GitHub Actions token with `contents: write`; no custom secrets are needed.

The script uses Python's standard library and sends a User-Agent. Run it manually with `python3 scripts/fetch_quotes.py`. Schema version 2 provides `holdings.*.intraday1d`, `intraday5d`, `daily1y`, market quotes and `fx` history; each series contains `{t, c}` Unix-second timestamps and closes. PNG uses CAD; the other holdings use USD.

Failed requests produce null quote fields and empty series, displayed as **—**, never fabricated prices. If every request fails, the script exits with an error and preserves the existing file. The page displays the data update timestamp; its live GMT clock is separate from quote freshness. The page reloads every five minutes. All displayed dates and times use GMT (UTC), including during British Summer Time.

Quotes may be delayed. GitHub schedules can run late or be disabled for inactive repositories; market closures and Yahoo availability also affect freshness. Yahoo's unofficial endpoint has no availability guarantee. Gold and Brent use futures, and US 10Y is a yield index.

## Symbols

| Holding | Yahoo symbol | Currency |
| --- | --- | --- |
| Palantir | PLTR | USD |
| AMD | AMD | USD |
| BigBear.ai | BBAI | USD |
| Kraken Robotics | PNG.V | CAD |
| Apple | AAPL | USD |
| BlackBerry | BB | USD |
| iShares Global Clean Energy | ICLN | USD |

| Market | Yahoo symbol |
| --- | --- |
| FTSE 100 | ^FTSE |
| GBP/USD | GBPUSD=X |
| Bitcoin | BTC-USD |
| Gold futures | GC=F |
| Brent crude futures | BZ=F |
| S&P 500 | ^GSPC |
| Nasdaq Composite | ^IXIC |
| US 10Y yield | ^TNX |

## Charts

Range pills select **1D, 5D, 14D, 30D, 365D or YTD** (default 30D, remembered locally). 1D/5D use intraday histories; longer ranges slice daily history, with YTD starting January 1 UTC. Every card has the same size, price styling and sparkline height. Card returns use native currency and the first selected point, or prior close for 1D; the dashed sparkline marks that baseline.

**Combined** defaults to the equal-weighted average of available USD percentage returns. CAD prices are divided by `USDCAD=X`; missing FX falls back to native percentage returns with a visible note. **All** plots seven coloured return lines with legend toggles and pointer/keyboard readouts. Missing histories remain unavailable. Daily FX is carried forward from the last observed rate; coverage notes disclose unavailable holdings.

Click watchlist cards (or focus a card and press Enter/Space) to select multiple holdings. Selected cards have a teal border and check mark. **All** shows only selected lines; **Combined** recalculates returns and any total value for that subset, keeping the configured weighting method. The subtitle lists the selected tickers. Legend toggles share the selection; with no selection, a legend click hides that line by selecting the others. Clearing selection (or deselecting the last card) restores the whole book. TradingView links open independently. Selection is restored from the URL hash, e.g. `#sel=PLTR,AMD`, so it survives reloads and can be bookmarked; unknown tickers are ignored.

Add numeric, nonnegative `shares` for every entry in `holdings.json` to enable value-weighted Combined returns and total value in `baseCurrency` (GBP by default; USD and CAD also supported). Partial share counts keep equal weighting. Value weighting assumes fixed shares throughout the selected period and needs complete price/FX history; missing current prices or FX show total value as **—**. Range and view choices persist in localStorage when available.

## Publish

Enable GitHub Pages from the repository's branch root in Settings → Pages. Keep `.nojekyll` and the committed JSON. If Pages uses branch publishing, commits from the Actions token may not trigger a Pages rebuild; use a Pages deployment workflow triggered by completion of this quote workflow when automatic deployment of refreshed data is needed.

Quotes may be delayed · Not financial advice.

## Enabling auto-refresh

The updater script is `scripts/fetch_quotes.py`. A ready-to-use GitHub Actions workflow lives at `docs/github-actions-update-quotes.yml` (copy it to `.github/workflows/update-quotes.yml`). Creating workflow files needs the `workflow` OAuth scope on `gh`, which this environment did not have when the site was first published — enable it once in the repo (or re-auth `gh` with that scope), then quotes refresh about every 10 minutes.

## Box refresh (cron substitute)

GitHub Actions workflow push needs a `workflow` OAuth scope this environment lacks, so quotes are refreshed from the shared box by **supercronic** (crontab not available in the container image):

- Crontab: `~/.config/stock-tracker/crontab` → every 5 minutes calls `scripts/refresh_and_push.sh`
- Script self-gates to **weekdays 08:00–21:30 Europe/London** every 5 minutes, and **hourly** otherwise (nights/weekends, for crypto)
- Uses `flock` on `.refresh.lock`; logs to `refresh.log`; commits `data: refresh` only when `data/market.json` changed
- Start: `nohup ~/.config/stock-tracker/run-supercronic.sh &` — **does not auto-start after a box reboot** unless relaunched
