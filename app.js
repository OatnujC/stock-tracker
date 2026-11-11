'use strict';

const MARKETS = [['FTSE', 'FTSE 100'], ['GBPUSD', 'GBP/USD'], ['BTC', 'Bitcoin'], ['GOLD', 'Gold'], ['BRENT', 'Brent crude'], ['SPX', 'S&P 500'], ['IXIC', 'Nasdaq'], ['US10Y', 'US 10Y']];
const COLORS = ['#2dd4bf', '#7eb5ff', '#c4a0ff', '#f2bd70', '#e6edf3', '#f184a0', '#86b88d'];
const MARKET_COLORS = {FTSE:'#38bdf8', GBPUSD:'#a3e635', BTC:'#fb923c', GOLD:'#facc15', BRENT:'#e879f9', SPX:'#818cf8', IXIC:'#fb7185', US10Y:'#22d3ee'};
const RANGES = ['1D', '5D', '14D', '30D', '365D', 'YTD'];
const valid = n => typeof n === 'number' && Number.isFinite(n);
const positive = n => valid(n) && n > 0;
const $ = id => document.getElementById(id);
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const number = (n, digits = 2) => valid(n) ? n.toLocaleString('en-GB', {minimumFractionDigits:digits, maximumFractionDigits:digits}) : '—';
const signed = n => valid(n) ? `${n >= 0 ? '+' : '−'}${number(Math.abs(n))}` : '—';
const pctLabel = n => valid(n) ? `${signed(n)}%` : '—';
const tone = n => !valid(n) || n === 0 ? 'neutral' : n > 0 ? 'positive' : 'negative';
const points = s => Array.isArray(s) ? s.filter(p => p && valid(p.t) && positive(p.c)).sort((a,b) => a.t-b.t) : [];
const gmt = d => d.toLocaleTimeString('en-GB', {timeZone:'UTC', hour12:false});
const dateLabel = t => new Date(t*1000).toLocaleDateString('en-GB', {timeZone:'UTC', day:'numeric', month:'short'});
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ } }
let range = stored('jt-range', '30D');
if (!RANGES.includes(range)) range = '30D';
let view = stored('jt-view', 'Combined');
if (!['Combined', 'All'].includes(view)) view = 'Combined';
const selected = new Set();
let config = {baseCurrency:'GBP', holdings:[]}, market = {};

function rangeSeries(quote) {
  if (range === '1D') return points(quote?.intraday1d ?? quote?.series);
  if (range === '5D') return points(quote?.intraday5d);
  const now = new Date();
  const cutoff = range === 'YTD' ? Date.UTC(now.getUTCFullYear(), 0, 1)/1000 : now.getTime()/1000 - Number.parseInt(range, 10)*86400;
  return points(quote?.daily1y).filter(p => p.t >= cutoff && p.t <= now.getTime()/1000);
}
function baseline(quote, series) { return range === '1D' && positive(quote?.previousClose) ? quote.previousClose : series[0]?.c; }
function returnOf(quote, series) { const base = baseline(quote, series); return series.length >= 2 && positive(base) ? (series.at(-1).c/base-1)*100 : null; }
// Historical values are carried forward only after their first observed timestamp.
function at(series, t) {
  let lo=0, hi=series.length-1, found=-1;
  while (lo<=hi) { const mid=(lo+hi)>>1; if (series[mid].t<=t) { found=mid; lo=mid+1; } else hi=mid-1; }
  return found<0 ? null : series[found].c;
}
function fxRate(symbol, t, mode = 'history') {
  const quote=market.fx?.[symbol];
  if (mode === 'latest') return positive(quote?.price) ? quote.price : positive(quote?.latest) ? quote.latest : null;
  if (mode === 'baseline' && range === '1D') return positive(quote?.previousClose) ? quote.previousClose : null;
  return at(points(quote?.daily1y), t);
}
function convert(value, currency, target, t, mode) {
  if (!positive(value)) return null;
  if (currency === target) return value;
  let usd=value;
  if (currency === 'CAD') { const rate=fxRate('USDCAD=X', t, mode); if (!positive(rate)) return null; usd/=rate; }
  else if (currency === 'GBP') { const rate=fxRate('GBPUSD=X', t, mode); if (!positive(rate)) return null; usd*=rate; }
  else if (currency !== 'USD') return null;
  if (target === 'USD') return usd;
  const rate=fxRate(target === 'GBP' ? 'GBPUSD=X' : 'USDCAD=X', t, mode);
  if (!positive(rate) || !['GBP','CAD'].includes(target)) return null;
  return target === 'GBP' ? usd/rate : usd*rate;
}

function renderMarkets() {
  $('markets').innerHTML=MARKETS.map(([key,name]) => {
    const q=market.markets?.[key];
    const pct=valid(q?.price) && positive(q?.previousClose) ? (q.price/q.previousClose-1)*100 : null;
    let price=number(q?.price, key==='GBPUSD' ? 4 : key==='US10Y' ? 3 : 2);
    if (valid(q?.price)) { if (key==='US10Y') price+='%'; if (['BTC','GOLD','BRENT'].includes(key)) price='$'+price; }
    const selectionKey=`m:${key}`, active=selected.has(selectionKey);
    return `<div class="market${active?' selected':''}" data-key="${selectionKey}" tabindex="0" role="button" aria-pressed="${active}" aria-label="${escapeHTML(name)}"><span class="selection-check" aria-hidden="true">✓</span><div class="market-name">${name}</div><div class="market-value">${price}</div><div class="market-change ${tone(pct)}">${valid(pct) ? `${pct>0?'↗':pct<0?'↘':'→'} ${pctLabel(pct)}` : '—'}</div></div>`;
  }).join('');
  $('markets').setAttribute('aria-busy','false');
}
function sparkline(q, series, key) {
  if (series.length<2) return '<span aria-label="Range chart unavailable">—</span>';
  const base=baseline(q,series), values=series.map(p=>p.c);
  if (positive(base)) values.push(base);
  const w=500,h=100,pad=8, min=Math.min(...values), max=Math.max(...values), extra=(max-min)*.12 || max*.005;
  const x=t=>pad+(t-series[0].t)/(series.at(-1).t-series[0].t || 1)*(w-pad*2);
  const y=c=>h-pad-(c-min+extra)/(max-min+extra*2)*(h-pad*2);
  const color=returnOf(q,series)<0 ? '#f43f5e' : '#2dd4bf';
  const path=series.map((p,i)=>`${i?'L':'M'}${x(p.t)},${y(p.c)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHTML(key)} ${range} prices; dashed baseline is ${range==='1D' && positive(q?.previousClose)?'prior close':'first range point'}"><line x1="0" x2="${w}" y1="${y(base)}" y2="${y(base)}" stroke="#66747e" stroke-dasharray="4 6" vector-effect="non-scaling-stroke"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderCards() {
  $('holding-count').textContent=String(config.holdings.length).padStart(2,'0');
  $('watchlist-period').textContent=`${range} · ${['1D','5D'].includes(range)?'Intraday prices':'Daily closes'}`;
  $('watchlist').innerHTML=config.holdings.map(h=>{
    const q=market.holdings?.[h.key], series=rangeSeries(q), pct=returnOf(q,series), label=`${range} ${pctLabel(pct)}`;
    const currency=h.currency || q?.currency || 'USD';
    const price=valid(q?.price) ? `${currency==='CAD'?'C$':currency==='USD'?'$':currency==='GBP'?'£':''}${number(q.price)}` : '—';
    return `<article class="stock-card${selected.has(h.key)?' selected':''}" data-key="${escapeHTML(h.key)}" tabindex="0" role="button" aria-pressed="${selected.has(h.key)}" aria-label="${escapeHTML(h.symbol || h.key)}: ${escapeHTML(h.name)}"><span class="selection-check" aria-hidden="true">✓</span><div class="card-top"><span class="ticker">${escapeHTML(h.symbol || h.key)}</span><span class="exchange">${escapeHTML(h.exchange)}</span></div><h3 class="company">${escapeHTML(h.name)}</h3><div class="quote-row"><div><span class="price">${price}</span><span class="currency">${escapeHTML(currency)}</span></div><span class="pill ${tone(pct)}">${label}</span></div><div class="sparkline">${sparkline(q,series,h.key)}</div><div class="card-footer"><span class="${tone(pct)}">${label}</span><a href="https://www.tradingview.com/symbols/${encodeURIComponent((h.tv || h.symbol || h.key).replace(':','-'))}/" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(h.name)} on TradingView (opens in a new tab)">TradingView ↗</a></div></article>`;
  }).join('');
  $('watchlist').setAttribute('aria-busy','false');
}

function book() {
  const weighted=config.holdings.length>0 && config.holdings.every(h=>valid(h.shares) && h.shares>=0);
  const target=weighted ? config.baseCurrency || 'GBP' : 'USD';
  const fallback=[];
  const lines=config.holdings.map((h,i)=>{
    const q=market.holdings?.[h.key], native=rangeSeries(q), currency=h.currency || q?.currency || 'USD';
    if (native.length<2) return {key:h.key,color:COLORS[i%COLORS.length],series:[],shares:h.shares};
    const base=baseline(q,native);
    let initial=convert(base,currency,target,native[0].t,'baseline');
    let values=native.map(p=>({t:p.t,c:convert(p.c,currency,target,p.t,'history')}));
    if (!positive(initial) || values.some(p=>!positive(p.c))) {
      if (!weighted) { initial=base; values=native; fallback.push(h.key); }
      else return {key:h.key,color:COLORS[i%COLORS.length],series:[],shares:h.shares};
    }
    return {key:h.key,color:COLORS[i%COLORS.length],shares:h.shares,initial,values,series:values.map(p=>({t:p.t,c:(p.c/initial-1)*100}))};
  });
  const holdings=config.holdings.filter(h=>!selected.size || selected.has(h.key));
  const basket=lines.filter(l=>!selected.size || selected.has(l.key));
  const available=basket.filter(l=>l.series.length);
  let combined=[];
  // Keep a fixed basket throughout the plot; unavailable constituents are disclosed.
  if (available.length && (!weighted || available.length===basket.length)) {
    const start=Math.max(...available.map(l=>l.series[0].t));
    const end=Math.max(...available.map(l=>l.series.at(-1).t));
    const times=[...new Set(available.flatMap(l=>l.series.map(p=>p.t)))].filter(t=>t>=start && t<=end).sort((a,b)=>a-b);
    const initial=available.reduce((sum,l)=>sum+l.initial*l.shares,0);
    combined=times.map(t=>({t,c:weighted ? (available.reduce((sum,l)=>sum+at(l.values,t)*l.shares,0)/initial-1)*100 : available.reduce((sum,l)=>sum+at(l.series,t),0)/available.length})).filter(p=>valid(p.c));
  }
  let total=null;
  if (weighted) {
    const values=holdings.map(h=>convert(market.holdings?.[h.key]?.price,h.currency || market.holdings?.[h.key]?.currency || 'USD',target,0,'latest'));
    if (holdings.length && values.every(positive)) total=values.reduce((sum,v,i)=>sum+v*holdings[i].shares,0);
  }
  return {weighted,target,lines,combined,total,fallback:fallback.filter(key=>!selected.size || selected.has(key)),available:available.length,count:basket.length};
}
function renderOverall() {
  const b=book(), result=b.combined.at(-1)?.c;
  const marketLines=MARKETS.filter(([key])=>selected.has(`m:${key}`)).map(([key])=>{
    const q=market.markets?.[key], series=rangeSeries(q), base=baseline(q,series);
    return {key,selectionKey:`m:${key}`,color:MARKET_COLORS[key],series:series.length>=2 && positive(base) ? series.map(p=>({t:p.t,c:(p.c/base-1)*100})) : []};
  });
  const label=selected.size ? `Selected: ${[...selected].map(key=>key.startsWith('m:') ? MARKETS.find(([id])=>key===`m:${id}`)?.[1] || key : key).join(', ')} (${selected.size})` : 'The whole book';
  $('overall-subtitle').textContent=`${range} · ${label} · ${b.target} returns`;
  $('clear-selection').hidden=!selected.size;
  $('overall-headline').className=`overall-headline ${tone(result)}`;
  $('overall-headline').textContent=pctLabel(result);
  if (b.weighted && b.count) {
    const small=document.createElement('small');
    small.textContent=`Total value: ${valid(b.total)?`${b.target} ${number(b.total)}`:'—'}`;
    $('overall-headline').append(small);
  }
  $('weighting-note').textContent=b.weighted ? `Value-weighted in ${b.target} — based on shares in holdings.json; fixed share counts over the selected range` : 'Equal-weighted — add share counts in holdings.json for your real mix';
  const notes=[];
  if (b.available<b.count) notes.push(`${b.available}/${b.count} holdings have usable ${range} history${b.weighted?'; Combined requires all holdings':'; equal-weighted over available holdings'}.`);
  if (b.fallback.length) notes.push(`FX missing for ${b.fallback.join(', ')}: using native % returns.`);
  if (b.weighted && b.count && !valid(b.total)) notes.push('Total value unavailable: missing quote or FX.');
  const missingMarkets=marketLines.filter(l=>!l.series.length);
  if (missingMarkets.length) notes.push(`${missingMarkets.map(l=>l.key).join(', ')}: no usable ${range} history.`);
  notes.push('Historical FX uses the last available daily rate.');
  $('coverage-note').textContent=notes.join(' ');
  const holdingLines=view==='Combined'
    ? (b.count ? [{key:'Combined',color:tone(result)==='negative'?'#f43f5e':'#2dd4bf',series:b.combined}] : [])
    : b.lines.filter(l=>!selected.size || selected.has(l.key));
  const lines=[...holdingLines,...marketLines];
  $('legend').hidden=view!=='All' && !marketLines.length;
  $('legend').innerHTML=$('legend').hidden ? '' : lines.map(l=>{
    const content=`<span class="legend-dot" style="--line:${l.color}"></span>${escapeHTML(l.key)}<span class="legend-return">${pctLabel(l.series.at(-1)?.c)}</span>`;
    return l.key==='Combined' ? `<span class="legend-item">${content}</span>` : `<button type="button" class="legend-item" data-key="${escapeHTML(l.selectionKey || l.key)}" aria-pressed="true">${content}</button>`;
  }).join('');
  drawChart(lines);
}
function drawChart(lines) {
  const all=lines.flatMap(l=>l.series);
  $('chart-readout').textContent='Hover or focus the chart to inspect returns. Use arrow keys to move.';
  if (!all.length) { $('overall-chart').innerHTML='<span>—</span>'; $('chart-readout').textContent='No visible range history available.'; return; }
  const w=1100,h=230,left=54,right=16,top=12,bottom=28;
  const minT=Math.min(...all.map(p=>p.t)),maxT=Math.max(...all.map(p=>p.t));
  let low=Math.min(0,...all.map(p=>p.c)),high=Math.max(0,...all.map(p=>p.c));
  const pad=(high-low)*.12 || 1; low-=pad; high+=pad;
  const x=t=>left+(t-minT)/(maxT-minT || 1)*(w-left-right), y=c=>top+(high-c)/(high-low)*(h-top-bottom);
  let markup='';
  for(let i=0;i<=4;i++) {
    const v=low+(high-low)*i/4;
    markup+=`<line class="chart-grid" x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-label" x="${left-8}" y="${y(v)+4}" text-anchor="end">${v.toFixed(1)}%</text>`;
    const t=minT+(maxT-minT)*i/4;
    markup+=`<text class="chart-label" x="${x(t)}" y="${h-4}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${range==='1D'?gmt(new Date(t*1000)).slice(0,5):dateLabel(t)}</text>`;
  }
  markup+=`<line class="chart-zero" x1="${left}" x2="${w-right}" y1="${y(0)}" y2="${y(0)}"/>`;
  lines.forEach(l=>{ if (l.series.length) markup+=`<path d="${l.series.map((p,i)=>`${i?'L':'M'}${x(p.t)},${y(p.c)}`).join(' ')}" fill="none" stroke="${l.color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`; });
  markup+=`<line class="chart-cursor" x1="${left}" x2="${left}" y1="${top}" y2="${h-bottom}" visibility="hidden"/>`;
  $('overall-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" tabindex="0" role="img" aria-label="${range} ${view} percentage returns. Use arrow keys to inspect.">${markup}</svg>`;
  const svg=$('overall-chart').querySelector('svg'), cursor=svg.querySelector('.chart-cursor');
  const times=[...new Set(all.map(p=>p.t))].sort((a,b)=>a-b);
  let index=times.length-1;
  function read(t) {
    const position=x(t); cursor.setAttribute('x1',position); cursor.setAttribute('x2',position); cursor.setAttribute('visibility','visible');
    $('chart-readout').textContent=`${dateLabel(t)} ${['1D','5D'].includes(range)?gmt(new Date(t*1000))+' GMT · ': '· '}${lines.map(l=>`${l.key} ${pctLabel(t>l.series.at(-1)?.t?null:at(l.series,t))}`).join(' · ')}`;
  }
  svg.addEventListener('pointermove',event=>{
    const rect=svg.getBoundingClientRect(), t=minT+Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*w-left)/(w-left-right)))*(maxT-minT);
    index=times.reduce((best,v,i)=>Math.abs(v-t)<Math.abs(times[best]-t)?i:best,0); read(times[index]);
  });
  svg.addEventListener('focus',()=>read(times[index]));
  svg.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); index=event.key==='Home'?0:event.key==='End'?times.length-1:Math.max(0,Math.min(times.length-1,index+(event.key==='ArrowLeft'?-1:1))); read(times[index]);
  });
}
function render() {
  document.querySelectorAll('[data-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.range===range)));
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  renderMarkets(); renderCards(); renderOverall();
}
$('range-controls').addEventListener('click',event=>{ const value=event.target.closest('[data-range]')?.dataset.range; if (RANGES.includes(value)) { range=value; save('jt-range',range); render(); } });
$('view-controls').addEventListener('click',event=>{ const value=event.target.closest('[data-view]')?.dataset.view; if (['Combined','All'].includes(value)) { view=value; save('jt-view',view); renderOverall(); document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view))); } });
// Update tile state in place so keyboard focus survives selection changes.
function selectionChanged() {
  document.querySelectorAll('.stock-card, #markets .market').forEach(card=>{
    const active=selected.has(card.dataset.key);
    card.classList.toggle('selected',active);
    card.setAttribute('aria-pressed',String(active));
  });
  renderOverall();
}
function writeSelection() {
  const params=new URLSearchParams(window.location.hash.slice(1));
  if (selected.size) params.set('sel',[...selected].join(',')); else params.delete('sel');
  const hash=params.toString().replace(/%2C/gi,',').replace(/%3A/gi,':');
  window.history.replaceState(null,'',`${window.location.pathname}${window.location.search}${hash?'#'+hash:''}`);
}
function readSelection() {
  const keys=new Set([...config.holdings.map(h=>h.key), ...MARKETS.map(([key])=>`m:${key}`)]);
  const value=new URLSearchParams(window.location.hash.slice(1)).get('sel') || '';
  selected.clear();
  value.split(',').forEach(key=>{ if (keys.has(key)) selected.add(key); });
  selectionChanged();
}
function toggleSelection(key) {
  if (selected.has(key)) selected.delete(key); else selected.add(key);
  writeSelection();
  selectionChanged();
}
let ignoreClickUntil=0;
function activateCard(event){
  if (event.target.closest('a')) return false;
  const card=event.target.closest('.stock-card');
  if (!card) return false;
  toggleSelection(card.dataset.key);
  return true;
}
// Touch can synthesize a follow-up click; ignore that ghost click or selection toggles twice.
$('watchlist').addEventListener('pointerup',event=>{
  if (event.pointerType!=='touch' && event.pointerType!=='pen') return;
  if (activateCard(event)) ignoreClickUntil=Date.now()+700;
},{passive:true});
$('watchlist').addEventListener('click',event=>{
  if (Date.now()<ignoreClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
  if (event.target.closest('a')) { event.stopPropagation(); return; }
  const card=event.target.closest('.stock-card');
  if (card) toggleSelection(card.dataset.key);
});
$('watchlist').addEventListener('keydown',event=>{
  if (!event.target.matches('.stock-card') || !['Enter',' '].includes(event.key)) return;
  event.preventDefault();
  if (!event.repeat) toggleSelection(event.target.dataset.key);
});
$('markets').addEventListener('pointerup',event=>{
  if (event.pointerType!=='touch' && event.pointerType!=='pen') return;
  const tile=event.target.closest('.market');
  if (tile) { toggleSelection(tile.dataset.key); ignoreClickUntil=Date.now()+700; }
},{passive:true});
$('markets').addEventListener('click',event=>{
  if (Date.now()<ignoreClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
  const tile=event.target.closest('.market');
  if (tile) toggleSelection(tile.dataset.key);
});
$('markets').addEventListener('keydown',event=>{
  if (!event.target.matches('.market') || !['Enter',' '].includes(event.key)) return;
  event.preventDefault();
  if (!event.repeat) toggleSelection(event.target.dataset.key);
});
$('legend').addEventListener('click',event=>{
  const key=event.target.closest('[data-key]')?.dataset.key;
  if (!key) return;
  // With no explicit selection all lines are visible; hide the clicked line.
  if (!selected.size) config.holdings.forEach(h=>selected.add(h.key));
  toggleSelection(key);
  [...$('legend').querySelectorAll('[data-key]')].find(button=>button.dataset.key===key)?.focus();
});
$('clear-selection').addEventListener('click',()=>{
  selected.clear(); writeSelection(); selectionChanged();
  document.querySelector(`[data-view="${view}"]`).focus();
});
window.addEventListener('hashchange',readSelection);
function clockTick() { $('clock').textContent=`${gmt(new Date())} GMT`; }
clockTick(); setInterval(clockTick,1000); setTimeout(()=>window.location.reload(),5*60*1000);
async function fetchJSON(path) { const url=`${path}${path.includes('?')?'&':'?'}t=${Date.now()}`; const response=await fetch(url,{cache:'no-store'}); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json(); }
async function load() {
  const results=await Promise.allSettled([fetchJSON('holdings.json'),fetchJSON('data/market.json')]);
  const errors=[];
  if (results[0].status==='fulfilled' && Array.isArray(results[0].value?.holdings)) config=results[0].value; else errors.push('Holdings configuration unavailable');
  if (results[1].status==='fulfilled' && results[1].value?.schemaVersion===2) market=results[1].value; else errors.push('Market data unavailable');
  readSelection();
  render();
  const updated=new Date(market.updatedAt);
  $('data-status').textContent=errors.length ? `${errors.join(' · ')} — · The page will retry in 5 minutes.` : `${Number.isNaN(updated.getTime())?'Quote update time —':`Data updated ${dateLabel(updated.getTime()/1000)} ${updated.getUTCFullYear()} at ${gmt(updated)} GMT`} · Missing data shown as —`;
}
render(); load();
