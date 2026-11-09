'use strict';

const HOLDINGS = [
  ['PLTR', 'Palantir', 'NASDAQ', 'NASDAQ:PLTR'],
  ['AMD', 'AMD', 'NASDAQ', 'NASDAQ:AMD'],
  ['BBAI', 'BigBear.ai', 'NYSE', 'NYSE:BBAI'],
  ['PNG', 'Kraken Robotics', 'TSXV', 'TSXV:PNG'],
  ['AAPL', 'Apple', 'NASDAQ', 'NASDAQ:AAPL'],
  ['BB', 'BlackBerry', 'NYSE', 'NYSE:BB'],
  ['ICLN', 'iShares Global Clean Energy', 'NASDAQ', 'NASDAQ:ICLN'],
];
const MARKETS = [['FTSE', 'FTSE 100'], ['GBPUSD', 'GBP/USD'], ['BTC', 'Bitcoin'], ['GOLD', 'Gold'], ['BRENT', 'Brent crude'], ['SPX', 'S&P 500'], ['IXIC', 'Nasdaq'], ['US10Y', 'US 10Y']];
const COLORS = ['#2dd4bf', '#7eb5ff', '#c4a0ff', '#f2bd70', '#e6edf3', '#f184a0', '#86b88d'];
const valid = value => typeof value === 'number' && Number.isFinite(value);
const number = (value, digits = 2) => valid(value) ? value.toLocaleString('en-GB', {minimumFractionDigits: digits, maximumFractionDigits: digits}) : '—';
const signed = value => valid(value) ? `${value >= 0 ? '+' : '−'}${number(Math.abs(value))}` : '—';
const tone = value => !valid(value) || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative';
const change = quote => valid(quote?.price) && valid(quote?.previousClose) && quote.previousClose > 0 ? quote.price - quote.previousClose : null;
const percent = quote => valid(change(quote)) ? change(quote) / quote.previousClose * 100 : null;
const points = series => Array.isArray(series) ? series.filter(p => p && valid(p.t) && valid(p.c) && p.c > 0).sort((a,b) => a.t - b.t) : [];
const dateLabel = timestamp => new Date(timestamp * 1000).toLocaleDateString('en-GB', {timeZone:'UTC', day:'numeric', month:'short'});
const gmt = date => date.toLocaleTimeString('en-GB', {timeZone:'UTC', hour12:false});

function clockTick() { document.getElementById('clock').textContent = `${gmt(new Date())} GMT`; }
clockTick();
setInterval(clockTick, 1000);
setTimeout(() => window.location.reload(), 5 * 60 * 1000);

function renderMarkets(data) {
  document.getElementById('markets').innerHTML = MARKETS.map(([key, name]) => {
    const quote = data.markets?.[key], pct = percent(quote);
    let price = number(quote?.price, key === 'GBPUSD' ? 4 : key === 'US10Y' ? 3 : 2);
    if (valid(quote?.price)) {
      if (key === 'US10Y') price += '%';
      if (['BTC', 'GOLD', 'BRENT'].includes(key)) price = '$' + price;
    }
    return `<div class="market"><div class="market-name">${name}</div><div class="market-value">${price}</div><div class="market-change ${tone(pct)}">${valid(pct) ? `${pct > 0 ? '↗' : pct < 0 ? '↘' : '→'} ${signed(pct)}%` : '—'}</div></div>`;
  }).join('');
  document.getElementById('markets').setAttribute('aria-busy', 'false');
}

function sparkline(quote, key) {
  const series = points(quote?.series);
  if (series.length < 2) return '<span aria-label="Intraday chart unavailable">—</span>';
  const w = 500, h = 160, pad = 8;
  const values = series.map(p => p.c);
  if (valid(quote.previousClose) && quote.previousClose > 0) values.push(quote.previousClose);
  let low = Math.min(...values), high = Math.max(...values);
  const extra = (high - low) * .12 || high * .005;
  low -= extra; high += extra;
  const x = t => pad + (t - series[0].t) / (series.at(-1).t - series[0].t || 1) * (w - pad * 2);
  const y = c => h - pad - (c - low) / (high - low) * (h - pad * 2);
  const path = series.map((p,i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)},${y(p.c).toFixed(2)}`).join(' ');
  const color = tone(change(quote)) === 'negative' ? '#f43f5e' : tone(change(quote)) === 'positive' ? '#2dd4bf' : '#87939e';
  const baseline = valid(quote.previousClose) && quote.previousClose > 0 ? `<line x1="0" x2="${w}" y1="${y(quote.previousClose)}" y2="${y(quote.previousClose)}" stroke="#66747e" stroke-dasharray="4 6" stroke-width="1" vector-effect="non-scaling-stroke"><title>Prior close: ${number(quote.previousClose)}</title></line>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${key} intraday prices; dashed line is prior close"><defs><linearGradient id="fill-${key}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${path} L${x(series.at(-1).t)},${h} L${x(series[0].t)},${h} Z" fill="url(#fill-${key})"/>${baseline}<path d="${path}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><circle cx="${x(series.at(-1).t)}" cy="${y(series.at(-1).c)}" r="3" fill="${color}"/></svg>`;
}

function renderCards(data) {
  document.getElementById('watchlist').innerHTML = HOLDINGS.map(([key, name, exchange, tv]) => {
    const quote = data.holdings?.[key], delta = change(quote), pct = percent(quote);
    const currency = key === 'PNG' ? 'CAD' : 'USD';
    const price = valid(quote?.price) ? `${currency === 'CAD' ? 'C$' : '$'}${number(quote.price)}` : '—';
    return `<article class="stock-card ${key === 'PLTR' ? 'hero' : ''}" aria-labelledby="name-${key}"><div class="card-top"><span class="ticker">${key}</span><span class="exchange">${exchange}</span></div><h3 class="company" id="name-${key}">${name}</h3><div class="quote-row"><div><span class="price">${price}</span><span class="currency">${currency}</span></div><span class="pill ${tone(pct)}">${valid(pct) ? `${signed(pct)}%` : '—'}</span></div><div class="sparkline">${sparkline(quote, key)}</div><div class="card-footer"><span class="${tone(delta)}">${signed(delta)} today</span><a href="https://www.tradingview.com/symbols/${tv.replace(':','-')}/" target="_blank" rel="noopener noreferrer" aria-label="${name} on TradingView (opens in a new tab)">TradingView ↗</a></div></article>`;
  }).join('');
  document.getElementById('watchlist').setAttribute('aria-busy', 'false');
}

function renderOverall(data) {
  const lines = HOLDINGS.map(([key], i) => {
    const series = points(data.history?.[key]?.series);
    return {key, color:COLORS[i], series:series.length >= 2 ? series.map(p => ({t:p.t, c:(p.c / series[0].c - 1) * 100})) : []};
  });
  document.getElementById('legend').innerHTML = lines.map(line => `<span class="legend-item"><span class="legend-dot" style="--line:${line.color}"></span>${line.key}<span class="legend-return">${line.series.length ? signed(line.series.at(-1).c) + '%' : '—'}</span></span>`).join('');
  const all = lines.flatMap(line => line.series);
  if (!all.length) { document.getElementById('overall-chart').innerHTML = '<span aria-label="One-month history unavailable">—</span>'; return; }
  const w=1100, h=230, left=48, right=15, top=12, bottom=28;
  const minT=Math.min(...all.map(p=>p.t)), maxT=Math.max(...all.map(p=>p.t));
  let low=Math.min(0,...all.map(p=>p.c)), high=Math.max(0,...all.map(p=>p.c));
  const pad=(high-low)*.12 || 1; low-=pad; high+=pad;
  const x=t=>left+(t-minT)/(maxT-minT || 1)*(w-left-right);
  const y=c=>top+(high-c)/(high-low)*(h-top-bottom);
  let markup='';
  for (let i=0;i<=4;i++) {
    const value=low+(high-low)*i/4;
    markup+=`<line class="chart-grid" x1="${left}" x2="${w-right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-label" x="${left-10}" y="${y(value)+4}" text-anchor="end">${value.toFixed(0)}%</text>`;
  }
  markup+=`<line class="chart-zero" x1="${left}" x2="${w-right}" y1="${y(0)}" y2="${y(0)}"/>`;
  lines.forEach(line => {
    if (!line.series.length) return;
    const d=line.series.map((p,i)=>`${i?'L':'M'}${x(p.t).toFixed(2)},${y(p.c).toFixed(2)}`).join(' ');
    markup+=`<path d="${d}" stroke="${line.color}" stroke-width="1.8" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke"><title>${line.key}: ${signed(line.series.at(-1).c)}% over available month history</title></path>`;
  });
  for (let i=0;i<=4;i++) {
    const t=minT+(maxT-minT)*i/4;
    markup+=`<text class="chart-label" x="${x(t)}" y="${h-4}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${dateLabel(t)}</text>`;
  }
  document.getElementById('overall-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="One-month percentage change for seven holdings, each rebased to zero at its first available close. Individual returns are listed in the legend.">${markup}</svg>`;
}

function render(data) { renderMarkets(data); renderCards(data); renderOverall(data); }
render({});
async function load() {
  const status=document.getElementById('data-status');
  try {
    const response=await fetch('data/market.json', {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid market data');
    render(data);
    const updated=new Date(data.updatedAt);
    status.textContent=Number.isNaN(updated.getTime()) ? 'Quote update time — · Missing data shown as —' : `Data updated ${updated.toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'})} at ${gmt(updated)} GMT · Missing data shown as —`;
  } catch (error) {
    render({});
    status.textContent='Market data unavailable — · The page will retry in 5 minutes.';
    console.warn('Unable to load market data:', error);
  }
}
load();
