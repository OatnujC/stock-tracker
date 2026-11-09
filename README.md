# JT's Book

A dark, responsive stock dashboard for a laptop or TV. Pure static HTML/CSS/JS with free TradingView ticker-tape, Advanced Chart, and mini-symbol-overview embeds: no backend, build step, API keys, or portfolio value calculations.

Open `index.html` directly in your browser. Internet access and JavaScript are required for quotes and charts. The local clock updates each second; the page reloads every five minutes. “Page refreshed” records the page load, not a quote timestamp.

GitHub Pages URL: https://oatnujc.github.io/stock-tracker/

To publish, push these files to the repository and enable GitHub Pages from the repository's branch root in Settings → Pages.

## Holdings

- Palantir — `NASDAQ:PLTR`
- AMD — `NASDAQ:AMD`
- BigBear.ai — `NYSE:BBAI`
- Kraken Robotics — `TSXV:PNG`
- Apple — `NASDAQ:AAPL`
- BlackBerry — `NYSE:BB`
- iShares Global Clean Energy ETF — `NASDAQ:ICLN`

## Overall chart

Between the markets strip and holdings cards, a full-width, dark TradingView Advanced Chart compares all seven holdings as percentage-change lines over an initial one-month range with daily intervals. `NASDAQ:PLTR` is the main symbol, with overlays for `NASDAQ:AMD`, `NYSE:BBAI`, `TSXV:PNG`, `NASDAQ:AAPL`, `NYSE:BB`, and `NASDAQ:ICLN`.

The symbols are shown on equal footing. This is NOT weighted to JT's holdings and is not a portfolio return or value calculation; no share counts or portfolio weights are assumed. The chart uses TradingView's Web Component with a visible toolbar and legend.

## Markets strip

`AMEX:SPY` (S&P 500 ETF), `NASDAQ:NDX`, `FOREXCOM:UKXGBP`, `FX:GBPUSD`, `BITSTAMP:BTCUSD`, `TVC:GOLD`, `TVC:UKOIL`, `TVC:US10Y`

Quotes may be delayed, and availability depends on TradingView and the exchange. Widgets may show an unavailable-symbol message where a feed is unsupported. No share counts, weights, or holding values are shown. This is not financial advice. Data via TradingView.

Widget documentation: [Advanced Chart](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/) · [Mini Chart](https://www.tradingview.com/widget-docs/widgets/charts/mini-chart/) · [Ticker Tape](https://www.tradingview.com/widget-docs/widgets/tickers/ticker-tape/)
