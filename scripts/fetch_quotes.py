#!/usr/bin/env python3
"""Refresh the static dashboard from Yahoo's public, unofficial chart endpoint."""

import concurrent.futures
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

DESTINATION = Path(__file__).resolve().parents[1] / "data" / "market.json"
HOLDINGS = {
    "PLTR": ("PLTR", "Palantir", "NASDAQ", "USD"),
    "AMD": ("AMD", "AMD", "NASDAQ", "USD"),
    "BBAI": ("BBAI", "BigBear.ai", "NYSE", "USD"),
    "PNG": ("PNG.V", "Kraken Robotics", "TSXV", "CAD"),
    "AAPL": ("AAPL", "Apple", "NASDAQ", "USD"),
    "BB": ("BB", "BlackBerry", "NYSE", "USD"),
    "ICLN": ("ICLN", "iShares Global Clean Energy", "NASDAQ", "USD"),
}
MARKETS = {
    "FTSE": ("^FTSE", "FTSE 100", "", "GBP"),
    "GBPUSD": ("GBPUSD=X", "GBP/USD", "", "USD"),
    "BTC": ("BTC-USD", "Bitcoin", "", "USD"),
    "GOLD": ("GC=F", "Gold", "", "USD"),
    "BRENT": ("BZ=F", "Brent crude", "", "USD"),
    "SPX": ("^GSPC", "S&P 500", "", "USD"),
    "IXIC": ("^IXIC", "Nasdaq", "", "USD"),
    "US10Y": ("^TNX", "US 10Y", "", "USD"),
}
USER_AGENT = "Mozilla/5.0 (compatible; JTsBook/1.0; static market dashboard)"


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def numeric(value):
    return value if finite(value) else None


def fetch_chart(symbol, history=False):
    params = urlencode({"range": "1mo" if history else "1d", "interval": "1d" if history else "5m", "includePrePost": "false"})
    last_error = None
    for attempt, host in enumerate(("query1.finance.yahoo.com", "query2.finance.yahoo.com")):
        url = f"https://{host}/v8/finance/chart/{quote(symbol, safe='')}?{params}"
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urlopen(request, timeout=12) as response:
                payload = json.load(response)
            chart = payload.get("chart", {})
            if chart.get("error") or not chart.get("result"):
                raise ValueError(str(chart.get("error") or "Empty chart response"))
            result = chart["result"][0]
            meta = result.get("meta", {})
            quotes = result.get("indicators", {}).get("quote", [])
            closes = quotes[0].get("close", []) if quotes else []
            series = [
                {"t": int(t), "c": round(c, 6)}
                for t, c in zip(result.get("timestamp", []), closes)
                if finite(t) and finite(c) and c > 0
            ]
            if history:
                if not series:
                    raise ValueError("No history returned")
                return {"symbol": symbol, "series": series, "previousClose": series[0]["c"]}
            price = numeric(meta.get("regularMarketPrice"))
            if price is None:
                raise ValueError("No current quote returned")
            return {
                "symbol": symbol,
                "currency": meta.get("currency"),
                "exchange": meta.get("exchangeName"),
                "price": price,
                "previousClose": numeric(meta.get("chartPreviousClose", meta.get("previousClose"))),
                "series": series,
            }
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
            last_error = error
            if attempt == 0:
                time.sleep(1)
    raise RuntimeError(f"{symbol}: {last_error}")


def main():
    result = {"updatedAt": None, "source": "Yahoo Finance (unofficial chart API)", "holdings": {}, "markets": {}, "history": {}}
    jobs = []
    for group, symbols in (("holdings", HOLDINGS), ("markets", MARKETS), ("history", HOLDINGS)):
        for key, details in symbols.items():
            jobs.append((group, key, details))
    successes = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        pending = {pool.submit(fetch_chart, details[0], group == "history"): (group, key, details) for group, key, details in jobs}
        for future in concurrent.futures.as_completed(pending):
            group, key, (symbol, name, exchange, currency) = pending[future]
            try:
                entry = future.result()
                successes += 1
            except Exception as error:
                print(f"Unavailable {group}/{key}: {error}", file=sys.stderr)
                entry = {"symbol": symbol, "series": [], "previousClose": None}
                if group != "history":
                    entry.update(price=None, currency=currency, exchange=None)
            if group != "history":
                entry["currency"] = entry.get("currency") or currency
                entry["name"] = name
                if group == "holdings":
                    entry["exchangeLabel"] = exchange
            result[group][key] = entry
    if not successes:
        print("All requests failed; preserving existing data/market.json.", file=sys.stderr)
        return 1
    # Keep deterministic symbol ordering despite concurrent requests.
    for group, symbols in (("holdings", HOLDINGS), ("markets", MARKETS), ("history", HOLDINGS)):
        result[group] = {key: result[group][key] for key in symbols}
    result["updatedAt"] = datetime.now(timezone.utc).isoformat()
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=DESTINATION.parent, suffix=".tmp", delete=False) as handle:
            temporary = handle.name
            json.dump(result, handle, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            handle.write("\n")
        os.replace(temporary, DESTINATION)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Wrote {DESTINATION}: {successes}/{len(jobs)} requests succeeded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
