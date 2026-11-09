# JT's Book — UI redesign brief (mockup image not yet on disk; follow this literally)

## Visual
- Near-black bg ~#0b0f12, dark rounded cards (~#12171c), subtle 1px borders (#1e262e)
- NO white boxes, NO TradingView iframe widgets on the watchlist/markets
- Teal accent ~#2dd4bf / #14b8a6 for positive sparklines and pills
- Red ~#f43f5e / #ef4444 for negative moves
- Clean sans (Inter/system-ui), large glanceable numbers

## Header
- Left: small square "JT" logo tile + title "JT's Book." + subtitle "Your corner of the market."
- Right: green live dot + clock with GMT label (Europe/London / GMT)

## Around the markets
- Section label "AROUND THE MARKETS"
- Static grid (NOT scrolling tape): preferably 2 rows or 8 columns
  FTSE 100, GBP/USD, Bitcoin, Gold, Brent crude, S&P 500, Nasdaq, US 10Y
- Each cell: small label, BIG value, small arrow + % change (green/red), thin vertical dividers

## Overall chart (between markets and watchlist)
- Label: "Overall" / "The book, % change, equal footing — not your actual weights"
- Custom canvas/SVG multi-line % change chart for all 7 holdings over ~1 month (from data/history)
- Dark panel, teal accents, legend with tickers; no invented portfolio weights

## The Watchlist / The book
- Heading "THE WATCHLIST" or "The book" with "07" count pill and "Intraday · 1 day" legend
- Cards:
  - ticker small-caps top-left, exchange top-right
  - company name
  - big price + currency + green/red pill with % change
  - teal (or red) line sparkline with soft gradient fill and dashed baseline at prior close
  - footer "+x.xx today" and "TradingView ↗" link
- Palantir card is HERO: spans 2 columns / ~2 rows
- Grid as mockup: hero left, others fill around it
- Failed quotes show "—" clearly — never fake prices

## Footer
- "Quotes may be delayed · Not financial advice"
- Mention data source + approximate refresh (GitHub Actions ~every 10 min)

## Data
- Client reads `/data/market.json` (relative)
- Seeded + refreshed by GitHub Actions using Yahoo chart API (no API key in repo)
- Client may also try live refresh if a CORS path exists; otherwise JSON file is source of truth
