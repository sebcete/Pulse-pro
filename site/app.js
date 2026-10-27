'use strict';
let DATA=null, lookback=90, sortMode='return', shownTrades=40, selectedPerson=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>v==null||!Number.isFinite(v)?'—':(v>=0?'+':'')+v.toFixed(2)+'%';
const money=v=>'$'+Math.round(v).toLocaleString();
const cls=v=>v==null?'':v>=0?'pos':'neg';
const dparse=s=>Date.parse(s+'T00:00:00Z');
function loadSet(k){try{return new Set(JSON.parse(localStorage.getItem(k)||'[]'))}catch{return new Set()}}
function saveSet(k,s){localStorage.setItem(k,JSON.stringify([...s]))}
let watchPeople=loadSet('pulse-pro-watch-people'), watchStocks=loadSet('pulse-pro-watch-stocks');
function spyReturnFor(buy){
  const bars=DATA?.prices?.SPY||[]; if(!bars.length) return null;
  let entry=null; for(const [d,p] of bars){ if(d>buy.filedDate){entry=p;break;} }
  if(entry==null) return null;
  return 100*(bars[bars.length-1][1]/entry-1);
}
function groupPersons(days){
  const ref=Date.parse(DATA.generatedAt), min=ref-days*86400000, groups={};
  for(const t of (DATA.trades||[])){
    if(t.type!=='buy'||!Number.isFinite(t.returnPct)||dparse(t.filedDate)<min) continue;
    const g=groups[t.member]||(groups[t.member]={person:t.member,chamber:t.chamber,state:t.state,buys:[],spy:[]});
    g.buys.push(t); const s=spyReturnFor(t); if(s!=null) g.spy.push(s);
  }
  return Object.values(groups).filter(g=>g.buys.length>=2).map(g=>{
    const mean=g.buys.reduce((a,b)=>a+b.returnPct,0)/g.buys.length;
    const spyMean=g.spy.length?g.spy.reduce((a,b)=>a+b,0)/g.spy.length:null;
    const win=100*g.buys.filter(b=>b.returnPct>0).length/g.buys.length;
    return {...g,mean,spyMean,excess:spyMean==null?null:mean-spyMean,win,tickers:[...new Set(g.buys.map(b=>b.ticker))]};
  });
}
function ranked(){
  const rows=groupPersons(lookback);
  if(sortMode==='consistency') rows.sort((a,b)=>b.win-a.win||b.mean-a.mean);
  else if(sortMode==='spy') rows.sort((a,b)=>(b.excess??-999)-(a.excess??-999));
  else rows.sort((a,b)=>b.mean-a.mean);
  return rows.slice(0,10);
}
function togglePerson(p){ watchPeople.has(p)?watchPeople.delete(p):watchPeople.add(p); saveSet('pulse-pro-watch-people',watchPeople); renderAll(); }
function toggleStock(t){ watchStocks.has(t)?watchStocks.delete(t):watchStocks.add(t); saveSet('pulse-pro-watch-stocks',watchStocks); renderAll(); }
window.togglePerson=togglePerson; window.toggleStock=toggleStock;
window.selectPerson=p=>{ selectedPerson=p; renderPersonDetail(); document.getElementById('leader').scrollIntoView({behavior:'smooth'}); };
function chartSVG(buys, amount){
  // Equal-weight cumulative path: for each trading date, mean of (price/entry) over buys already entered.
  const dates=[]; const byTicker={};
  for(const b of buys){
    const bars=DATA.prices[b.ticker]; if(!bars) continue;
    byTicker[b.ticker]=new Map(bars);
    for(const [d] of bars) if(!dates.includes(d)) dates.push(d);
  }
  dates.sort();
  const pts=[];
  for(const d of dates){
    let vals=[];
    for(const b of buys){
      if(d<b.entryDate) continue;
      const m=byTicker[b.ticker]; if(!m) continue;
      // forward-fill: last close on or before d
      let close=null; for(const [dd,pp] of m){ if(dd<=d) close=pp; else break; }
      if(close) vals.push(close/b.entryPrice);
    }
    if(vals.length) pts.push([d, amount*vals.reduce((a,c)=>a+c,0)/vals.length]);
  }
  if(pts.length<2) return '<p class="hint">Not enough price history for a chart.</p>';
  const vals=pts.map(p=>p[1]), lo=Math.min(...vals), hi=Math.max(...vals), W=720, H=180, P=10;
  const xy=pts.map(([d,v],i)=>`${(P+i/(pts.length-1)*(W-2*P)).toFixed(1)},${(H-P-((v-lo)/(hi-lo||1))*(H-2*P)).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><polyline points="${xy}" fill="none" stroke="#0f172a" stroke-width="2"/><text x="10" y="18" font-size="12" fill="#475569">${money(pts[0][1])} → ${money(pts[pts.length-1][1])} on ${money(amount)}</text></svg>`;
}
function renderPersonDetail(){
  const box=$('personDetail'); if(!selectedPerson){box.innerHTML='';return;}
  const g=groupPersons(lookback).find(x=>x.person===selectedPerson) || groupPersons(180).find(x=>x.person===selectedPerson);
  if(!g){box.innerHTML='<p class="hint">That person has no priced buys in this lookback.</p>';return;}
  const trades=(DATA.trades||[]).filter(t=>t.member===selectedPerson).slice(0,12);
  box.innerHTML=`<h3>${esc(g.person)} — detail</h3>
    <p class="hint">${esc(g.chamber)} · ${g.buys.length} priced buys · Mean ${pct(g.mean)} · vs SPY ${pct(g.excess)} · Consistency ${g.win.toFixed(0)}% · Tickers: ${esc(g.tickers.join(', '))}</p>
    ${chartSVG(g.buys,1000)}
    <p class="hint">Chart: $1,000 split equally across this person's priced buys in the lookback, valued over time. Flat segments are buys not yet entered.</p>
    <ul>${trades.map(t=>`<li>${esc(t.ticker)} ${t.type} · Filed ${esc(t.filedDate)} · ${esc(t.amountLabel)}${Number.isFinite(t.returnPct)?` · ${pct(t.returnPct)}`:''}</li>`).join('')}</ul>
    <button type="button" class="mini" onclick="togglePerson('${esc(selectedPerson)}')">${watchPeople.has(selectedPerson)?'✓ Following person':'＋ Follow person'}</button>`;
}
function renderLeader(){
  const rows=ranked();
  $('leaderEmpty').hidden=rows.length>0;
  $('leaderTable').querySelector('tbody').innerHTML=rows.map((r,i)=>`<tr>
    <td>${i+1}</td><td><a href="#" onclick="selectPerson('${esc(r.person)}');return false;"><b>${esc(r.person)}</b></a><br><small>${esc(r.chamber)}</small></td>
    <td>${r.buys.length}</td><td class="${cls(r.mean)}">${pct(r.mean)}</td><td class="${cls(r.excess)}">${pct(r.excess)}</td><td>${r.win.toFixed(0)}%</td>
    <td><button type="button" class="mini" onclick="togglePerson('${esc(r.person)}')">${watchPeople.has(r.person)?'✓':'＋ Follow'}</button></td></tr>`).join('');
  const sel=$('simPerson');
  sel.innerHTML=rows.map(r=>`<option value="${esc(r.person)}">${esc(r.person)} (${pct(r.mean)})</option>`).join('');
  if(selectedPerson && !rows.find(r=>r.person===selectedPerson)) { /* keep detail from 180D fallback */ }
  renderSim(); renderPersonDetail();
}
function renderHistory(){
  const maps={30:{},90:{},180:{}};
  for(const d of [30,90,180]) for(const g of groupPersons(d)) maps[d][g.person]=g.mean;
  const people=[...new Set([...Object.keys(maps[30]),...Object.keys(maps[90]),...Object.keys(maps[180])])];
  const top=people.map(p=>({p, m:maps[90][p]??maps[180][p]??-999})).sort((a,b)=>b.m-a.m).slice(0,10);
  $('historyTable').querySelector('tbody').innerHTML=top.map(x=>`<tr><td><b>${esc(x.p)}</b></td><td class="${cls(maps[30][x.p])}">${pct(maps[30][x.p])}</td><td class="${cls(maps[90][x.p])}">${pct(maps[90][x.p])}</td><td class="${cls(maps[180][x.p])}">${pct(maps[180][x.p])}</td></tr>`).join('');
}
function renderMarket(){
  const rows=groupPersons(lookback);
  const top=rows[0];
  const spyBars=DATA?.prices?.SPY||[];
  let spyCal=null;
  if(spyBars.length>lookback){
    const a=spyBars[spyBars.length-1-lookback][1], b=spyBars[spyBars.length-1][1];
    spyCal=100*(b/a-1);
  }
  $('marketBox').innerHTML=`<div><small>Top person (mean, post-disclosure)</small><b class="${cls(top?.mean)}">${top?esc(top.person)+' · '+pct(top.mean):'—'}</b></div>
    <div><small>SPY, same-entry average for top person</small><b>${pct(top?.spyMean)}</b></div>
    <div><small>SPY, last ${lookback} trading days (calendar)</small><b class="${cls(spyCal)}">${pct(spyCal)}</b></div>`;
  // Strategies
  const all=groupPersons(lookback);
  const top10=all.slice(0,10);
  const cons=all.filter(g=>g.win>=60).sort((a,b)=>b.win-a.win);
  $('strategyBox').innerHTML=`<div><small>Simulated: Top 10 leaderboard, equal weight</small><b>${pct(top10.length?top10.reduce((a,b)=>a+b.mean,0)/top10.length:null)}</b></div>
    <div><small>Simulated: Most consistent (≥60% wins)</small><b>${pct(cons.length?cons.reduce((a,b)=>a+b.mean,0)/cons.length:null)}</b></div>
    <div><small>Simulated: Best vs SPY</small><b>${pct(all.length?Math.max(...all.map(g=>g.excess??-999)):null)} excess</b></div>`;
}
function renderPortfolio(){
  const people=[...watchPeople];
  const box=$('portfolioBox'), chart=$('portfolioChart'), hold=$('holdingsBox');
  if(!people.length){ box.innerHTML='<p class="hint">No people followed yet. Tap “＋ Follow” on the leaderboard.</p>'; chart.innerHTML=''; hold.innerHTML=''; return; }
  const buys=(DATA.trades||[]).filter(t=>people.includes(t.member)&&t.type==='buy'&&Number.isFinite(t.returnPct)&&dparse(t.filedDate)>=Date.parse(DATA.generatedAt)-lookback*86400000);
  if(!buys.length){ box.innerHTML='<p class="hint">Followed people have no priced buys in this lookback.</p>'; chart.innerHTML=''; hold.innerHTML=''; return; }
  const mean=buys.reduce((a,b)=>a+b.returnPct,0)/buys.length;
  const spyVals=buys.map(spyReturnFor).filter(v=>v!=null); const spyMean=spyVals.length?spyVals.reduce((a,b)=>a+b,0)/spyVals.length:null;
  box.innerHTML=`<p class="result">Hypothetical $1,000 across ${buys.length} buys from ${people.length} followed ${people.length===1?'person':'people'}: <span class="${cls(mean)}">${money(1000*(1+mean/100))}</span> (${pct(mean)}), vs SPY ${money(1000*(1+(spyMean||0)/100))} (${pct(spyMean)})</p>`;
  chart.innerHTML=chartSVG(buys,1000);
  const byTicker={};
  for(const b of buys){ const h=byTicker[b.ticker]||(byTicker[b.ticker]={ticker:b.ticker,buys:[],people:new Set()}); h.buys.push(b); h.people.add(b.member); }
  const rows=Object.values(byTicker).sort((a,b)=>b.buys.length-a.buys.length).slice(0,20);
  hold.innerHTML='<h3>Holdings (disclosed buys only)</h3><div class="tablewrap"><table><thead><tr><th>Ticker</th><th>Buys</th><th>People</th><th>Mean return</th><th>Latest close</th></tr></thead><tbody>'+
    rows.map(h=>{ const m=h.buys.reduce((a,b)=>a+b.returnPct,0)/h.buys.length; const bars=DATA.prices[h.ticker]; const last=bars?bars[bars.length-1][1]:null;
      return `<tr><td><b>${esc(h.ticker)}</b></td><td>${h.buys.length}</td><td>${h.people.size}</td><td class="${cls(m)}">${pct(m)}</td><td>${last?'$'+last.toFixed(2):'—'}</td></tr>`; }).join('')+'</tbody></table></div>';
}
function renderSim(){
  const rows=groupPersons(lookback);
  const person=$('simPerson').value;
  const row=rows.find(r=>r.person===person);
  const amount=parseFloat($('simAmount').value)||0;
  if(!row||!amount){ $('simResult').textContent='Pick a person and an amount.'; return; }
  const val=amount*(1+row.mean/100), spyVal=row.spyMean==null?null:amount*(1+row.spyMean/100);
  $('simResult').innerHTML=`${money(amount)} split equally across ${row.buys.length} buys → <span class="${cls(row.mean)}">${money(val)}</span> (${pct(row.mean)}). Same amount in SPY on the same entry dates → ${spyVal==null?'—':money(spyVal)} (${pct(row.spyMean)}). Hypothetical only.`;
}
function renderTrades(){
  const q=($('searchBox').value||'').trim().toLowerCase(), type=$('typeFilter').value;
  const list=(DATA.trades||[]).filter(t=>{
    if(type!=='all'&&t.type!==type) return false;
    if(!q) return true;
    return [t.member,t.ticker,t.asset].join(' ').toLowerCase().includes(q);
  });
  const lastVisit=localStorage.getItem('pulse-pro-last-visit');
  $('tradeList').innerHTML=list.slice(0,shownTrades).map(t=>{
    const isNew=lastVisit && t.filedDate>lastVisit;
    return `<div class="trade"><div><b>${esc(t.ticker)}</b> <span class="pill ${t.type}">${t.type==='buy'?'Buy':'Sell'}</span> ${isNew?'<span class="pill signal-buy">NEW</span>':''}
      <div class="meta">${esc(t.member)} · ${esc(t.chamber)} · ${esc(t.asset)}<br>Traded ${esc(t.tradeDate)} · Filed ${esc(t.filedDate)} · ${esc(t.amountLabel)}
      ${Number.isFinite(t.returnPct)?`<br>Post-disclosure return: <span class="${cls(t.returnPct)}">${pct(t.returnPct)}</span>`:''}</div></div>
      <div>${t.filing?`<a href="${esc(t.filing)}" target="_blank" rel="noopener">Source ↗</a> `:''}
      <button type="button" class="mini" onclick="toggleStock('${esc(t.ticker)}')">${watchStocks.has(t.ticker)?'✓ Watching':'＋ Watch'}</button></div></div>`;
  }).join('')||'<p class="hint">No trades match this filter.</p>';
  $('moreBtn').style.display=list.length>shownTrades?'':'none';
}
function renderRatings(){
  const min=Date.parse(DATA.generatedAt)-lookback*86400000;
  const by={};
  for(const t of (DATA.trades||[])){
    if(!t.ticker||dparse(t.filedDate)<min) continue;
    const g=by[t.ticker]||(by[t.ticker]={ticker:t.ticker,buys:0,sells:0});
    if(t.type==='buy') g.buys++; else if(t.type==='sell') g.sells++;
  }
  function stats(ticker){
    const bars=DATA.prices[ticker]||[]; if(bars.length<35) return {mom:null,vol:null};
    const last=bars[bars.length-1][1], ago=bars[Math.max(0,bars.length-31)][1];
    const mom=100*(last/ago-1);
    const rets=[]; for(let i=1;i<Math.min(bars.length,91);i++) rets.push(Math.log(bars[i][1]/bars[i-1][1]));
    const m=rets.reduce((a,b)=>a+b,0)/rets.length; const vol=100*Math.sqrt(rets.reduce((a,b)=>a+(b-m)*(b-m),0)/rets.length);
    return {mom,vol};
  }
  const rows=Object.values(by).filter(g=>g.buys+g.sells>=2).map(g=>{
    const s=stats(g.ticker); const net=g.buys-g.sells;
    let signal='Neutral', signalClass='signal-neutral';
    if(net>=2&&s.mom>0){signal='Lean Buy';signalClass='signal-buy';}
    else if(net<=-2&&s.mom<0){signal='Lean Avoid';signalClass='signal-avoid';}
    const risk=s.vol==null?'—':s.vol<1.5?'Low':s.vol<3?'Medium':'High';
    return {...g,net,...s,signal,signalClass,risk};
  }).sort((a,b)=>b.net-a.net).slice(0,20);
  $('ratingsTable').querySelector('tbody').innerHTML=rows.map(g=>`<tr><td><b>${esc(g.ticker)}</b></td><td>${g.buys} / ${g.sells}</td><td class="${cls(g.mom)}">${pct(g.mom)}</td><td>${g.risk}</td><td><span class="pill ${g.signalClass}">${g.signal}</span></td><td><button type="button" class="mini" onclick="toggleStock('${esc(g.ticker)}')">${watchStocks.has(g.ticker)?'✓':'＋ Watch'}</button></td></tr>`).join('');
}
function renderWatch(){
  const prices=DATA?.prices||{};
  $('watchPeople').innerHTML=[...watchPeople].map(p=>{
    const g=groupPersons(lookback).find(x=>x.person===p);
    return `<li><b>${esc(p)}</b> ${g?`<span class="${cls(g.mean)}">${pct(g.mean)}</span>`:''} <button type="button" onclick="togglePerson('${esc(p)}')">×</button></li>`;
  }).join('')||'<li>No people followed yet.</li>';
  $('watchStocks').innerHTML=[...watchStocks].map(t=>{
    const bars=prices[t]; const last=bars?bars[bars.length-1][1]:null; const prev=bars&&bars.length>1?bars[bars.length-2][1]:null;
    const ch=last&&prev?100*(last/prev-1):null;
    return `<li><b>${esc(t)}</b> ${last?'$'+last.toFixed(2):''} <span class="${cls(ch)}">${pct(ch)}</span> <button type="button" onclick="toggleStock('${esc(t)}')">×</button></li>`;
  }).join('')||'<li>No stocks watched yet.</li>';
}
function renderAll(){
  const banner=$('statusBanner');
  if(!DATA){banner.className='banner bad';banner.textContent='No snapshot available yet.';return;}
  banner.className='banner '+(DATA.coverage?.chambers?.includes('Senate')?'ok':'');
  banner.textContent=`Snapshot: ${DATA.generatedAt.slice(0,10)} · Latest filing: ${DATA.latestFilingDate} · Source as of: ${DATA.sourceAsOf||'—'} · ${DATA.coverage?.recentRows||''} recent trades · ${DATA.coverage?.pricedSymbols||''} priced tickers plus SPY · Chambers: ${(DATA.coverage?.chambers||[]).join(', ')}`;
  $('metaLine').textContent=banner.textContent;
  renderMarket(); renderLeader(); renderHistory(); renderPortfolio(); renderTrades(); renderRatings(); renderWatch();
}
async function load(){
  try{
    const res=await fetch('data.json?ts='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    DATA=await res.json();
    const prev=localStorage.getItem('pulse-pro-last-visit');
    const ab=$('alertBanner');
    if(prev){
      const n=(DATA.trades||[]).filter(t=>t.filedDate>prev).length;
      if(n>0){ ab.hidden=false; ab.className='banner ok'; ab.textContent=`${n} new filing${n===1?'':'s'} since your last visit (after ${prev}). New trades are marked NEW below.`; }
      else { ab.hidden=false; ab.textContent='No new filings since your last visit.'; }
    }
    localStorage.setItem('pulse-pro-last-visit', new Date().toISOString().slice(0,10));
  }catch(e){
    DATA={generatedAt:new Date().toISOString(),latestFilingDate:'—',sourceAsOf:'',trades:[],prices:{},coverage:{}};
    $('alertBanner').hidden=true;
  }
  renderAll();
}
document.querySelectorAll('#lookbackSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#lookbackSeg button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  lookback=parseInt(b.dataset.days,10); renderAll();
}));
$('sortMode').addEventListener('change',e=>{sortMode=e.target.value;renderLeader();});
$('searchBox').addEventListener('input',()=>{shownTrades=40;renderTrades();});
$('typeFilter').addEventListener('change',()=>{shownTrades=40;renderTrades();});
$('moreBtn').addEventListener('click',()=>{shownTrades+=60;renderTrades();});
$('simAmount').addEventListener('input',renderSim);
$('simPerson').addEventListener('change',renderSim);
document.querySelectorAll('#simPresets button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#simPresets button').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  const amt=parseInt(b.dataset.amt,10); if(amt>0){$('simAmount').value=amt;renderSim();}
}));
$('refreshBtn').addEventListener('click',load);
load();
