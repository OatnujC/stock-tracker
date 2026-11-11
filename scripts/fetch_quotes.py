#!/usr/bin/env python3
"""Refresh the dashboard from Yahoo's unofficial chart API; no API key required."""

import concurrent.futures
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'data' / 'market.json'
MARKETS = {
    'FTSE': ('^FTSE', 'FTSE 100', 'GBP'),
    'GBPUSD': ('GBPUSD=X', 'GBP/USD', 'USD'),
    'BTC': ('BTC-USD', 'Bitcoin', 'USD'),
    'GOLD': ('GC=F', 'Gold', 'USD'),
    'BRENT': ('BZ=F', 'Brent crude', 'USD'),
    'SPX': ('^GSPC', 'S&P 500', 'USD'),
    'IXIC': ('^IXIC', 'Nasdaq', 'USD'),
    'US10Y': ('^TNX', 'US 10Y', 'USD'),
}
FX = {'USDCAD=X': 'CAD', 'GBPUSD=X': 'USD'}
PERIODS = {'intraday1d': ('1d', '5m'), 'intraday5d': ('5d', '15m'), 'daily1y': ('1y', '1d')}
USER_AGENT = 'Mozilla/5.0 (compatible; JTsBook/2.0; static market dashboard)'


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def numeric(value):
    return value if finite(value) else None


def fetch_chart(symbol, period='intraday1d'):
    span, interval = PERIODS[period]
    params = urlencode({'range': span, 'interval': interval, 'includePrePost': 'false'})
    last_error = None
    for attempt, host in enumerate(('query1.finance.yahoo.com', 'query2.finance.yahoo.com')):
        try:
            url = f'https://{host}/v8/finance/chart/{quote(symbol, safe="")}?{params}'
            request = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
            with urlopen(request, timeout=15) as response:
                payload = json.load(response)
            chart = payload.get('chart', {})
            if chart.get('error') or not chart.get('result'):
                raise ValueError(str(chart.get('error') or 'Empty chart response'))
            result = chart['result'][0]
            meta = result.get('meta', {})
            quotes = result.get('indicators', {}).get('quote', [])
            closes = quotes[0].get('close', []) if quotes else []
            series = [{'t': int(t), 'c': round(c, 6)}
                      for t, c in zip(result.get('timestamp', []), closes)
                      if finite(t) and finite(c) and c > 0]
            if not series:
                raise ValueError('No price bars returned')
            return {
                'symbol': symbol, 'currency': meta.get('currency'),
                'exchange': meta.get('exchangeName'),
                'price': numeric(meta.get('regularMarketPrice')),
                'previousClose': numeric(meta.get('previousClose', meta.get('chartPreviousClose'))),
                'series': sorted(series, key=lambda p: p['t']),
            }
        except (OSError, ValueError, KeyError, TypeError) as error:
            last_error = error
            if attempt == 0:
                time.sleep(1)
    raise RuntimeError(f'{symbol} {period}: {last_error}')


def main():
    holdings = json.loads((ROOT / 'holdings.json').read_text())['holdings']
    result = {'schemaVersion': 2, 'updatedAt': None,
              'source': 'Yahoo Finance (unofficial chart API)',
              'holdings': {}, 'markets': {}, 'fx': {}}
    jobs = []
    for holding in holdings:
        key, symbol = holding['key'], holding['yahoo']
        result['holdings'][key] = {
            'symbol': symbol, 'name': holding['name'], 'currency': holding['currency'],
            'exchange': holding['exchange'], 'price': None, 'previousClose': None,
            **{period: [] for period in PERIODS},
        }
        jobs.extend(('holdings', key, symbol, period) for period in PERIODS)
    for key, (symbol, name, currency) in MARKETS.items():
        result['markets'][key] = {'symbol': symbol, 'name': name, 'currency': currency,
                                  'exchange': None, 'price': None, 'previousClose': None, 'series': [],
                                  **{period: [] for period in PERIODS}}
        jobs.extend(('markets', key, symbol, period) for period in PERIODS)
    for symbol, currency in FX.items():
        result['fx'][symbol] = {'symbol': symbol, 'currency': currency, 'exchange': None,
                                'price': None, 'latest': None, 'previousClose': None, 'daily1y': []}
        jobs.append(('fx', symbol, symbol, 'daily1y'))
    successes = 0
    # Each series fails independently. Missing data stays empty; never fabricate bars.
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        pending = {pool.submit(fetch_chart, symbol, period): (group, key, period)
                   for group, key, symbol, period in jobs}
        for future in concurrent.futures.as_completed(pending):
            group, key, period = pending[future]
            try:
                entry = future.result()
                successes += 1
            except Exception as error:
                print(f'Unavailable {group}/{key}/{period}: {error}', file=sys.stderr)
                continue
            target = result[group][key]
            target[period] = entry['series']
            if group == 'markets' and period == 'intraday1d':
                target['series'] = entry['series']
            # Quote metadata comes from the shortest successful interval available.
            rank = list(PERIODS).index(period)
            if rank < target.get('_metaRank', 99):
                target['_metaRank'] = rank
                for field in ('price', 'previousClose', 'currency', 'exchange'):
                    if entry.get(field) is not None:
                        target[field] = entry[field]
            if group == 'fx':
                target['latest'] = entry['price']
    if not successes:
        print('All requests failed; preserving existing data/market.json.', file=sys.stderr)
        return 1
    for group in ('holdings', 'markets', 'fx'):
        for entry in result[group].values():
            entry.pop('_metaRank', None)
    result['updatedAt'] = datetime.now(timezone.utc).isoformat()
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=DESTINATION.parent,
                                         suffix='.tmp', delete=False) as handle:
            temporary = handle.name
            json.dump(result, handle, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
            handle.write('\n')
        os.replace(temporary, DESTINATION)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    print(f'Wrote {DESTINATION}: {successes}/{len(jobs)} requests succeeded.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
