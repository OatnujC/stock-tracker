# JT's Book.

A custom dark market dashboard: https://oatnujc.github.io/stock-tracker/

Pure static HTML, CSS and JavaScript. No npm, build step, API keys or embedded TradingView widgets. The page includes an eight-cell markets grid, a one-month comparison chart and seven watchlist cards, with Palantir as the hero. TradingView links open external symbol pages.

## Run locally

Serve the repository with `python3 -m http.server 8000`, then open http://localhost:8000. A web server is required so the browser can fetch `data/market.json`.

## Data and refresh

The UI reads the relative file `data/market.json`. GitHub Actions runs `scripts/fetch_quotes.py` approximately every 10 minutes using Yahoo Finance's unofficial chart API, then commits and pushes changed JSON. The workflow also supports **Run workflow** (`workflow_dispatch`). It uses the standard GitHub Actions token with `contents: write`; no custom secrets are needed.

The script uses Python's standard library and sends a User-Agent. Run it manually with `python3 scripts/fetch_quotes.py`. It fetches one day of five-minute bars for holdings and markets, plus one month of daily history for holdings. The JSON has `updatedAt`, `source`, `holdings`, `markets` and `history`; each series contains `{t, c}` Unix-second timestamps and closes. PNG uses CAD; the other holdings use USD.

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

Custom SVG sparklines use intraday closes and a dashed prior-close baseline. Daily changes compare the quote with its prior close. The overall chart rebases each holding's own first available monthly close to 0% and plots percentage changes in its native currency. The seven lines are on equal footing — not actual portfolio weights or a portfolio return. No share counts, weights or foreign exchange conversions are assumed. Missing histories remain unavailable in the legend.

## Publish

Enable GitHub Pages from the repository's branch root in Settings → Pages. Keep `.nojekyll` and the committed JSON. If Pages uses branch publishing, commits from the Actions token may not trigger a Pages rebuild; use a Pages deployment workflow triggered by completion of this quote workflow when automatic deployment of refreshed data is needed.

Quotes may be delayed · Not financial advice.

## Enabling auto-refresh

The updater script is `scripts/fetch_quotes.py`. A ready-to-use GitHub Actions workflow lives at `docs/github-actions-update-quotes.yml` (copy it to `.github/workflows/update-quotes.yml`). Creating workflow files needs the `workflow` OAuth scope on `gh`, which this environment did not have when the site was first published — enable it once in the repo (or re-auth `gh` with that scope), then quotes refresh about every 10 minutes.
