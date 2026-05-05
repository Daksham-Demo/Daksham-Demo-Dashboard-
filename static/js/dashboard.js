let ALL_FUNDS=[], SEL_ITEM=null, CURR_VIEW='trailing', CATEGORY='', LATEST_AS_OF='', SESSION_AS_OF='', CURR_UNIVERSE='mf', BM_TYPE='explicit', CAT_DATA={}, SEARCH_QUERY='';

function getCYYears(){ const y=SESSION_AS_OF?new Date(SESSION_AS_OF).getFullYear():new Date().getFullYear(); const a=[]; for(let i=y;i>=y-9;i--)a.push(i); return a; }

const TR_COLS=[{k:'ytd',l:'YTD'},{k:'ret_1m',l:'1M'},{k:'ret_3m',l:'3M'},{k:'ret_6m',l:'6M'},{k:'ret_1y',l:'1Y'},{k:'ret_2y',l:'2Y'},{k:'ret_3y',l:'3Y'},{k:'ret_5y',l:'5Y'},{k:'ret_7y',l:'7Y'},{k:'ret_10y',l:'10Y'}];

function initDashboard(cat, asOf){
  CATEGORY=cat; LATEST_AS_OF=asOf; SESSION_AS_OF=asOf;
  CURR_UNIVERSE=cat.startsWith('nmf_')?'nmf':cat.startsWith('idx_')?'idx':'mf';
  document.querySelectorAll('.uni-tab').forEach(t=>t.classList.toggle('active',t.dataset.universe===CURR_UNIVERSE));
  loadCategories().then(()=>{ if(asOf) fetchFunds(asOf); else showEmptyState(); });
  populateModalCategories();
  document.addEventListener('click',e=>{ if(!e.target.closest('.search-container')) document.getElementById('searchResults').style.display='none'; });
}
async function loadCategories(){ try{ CAT_DATA=await(await fetch('/api/categories')).json(); renderCatNav(); }catch(e){} }
function renderCatNav(){
  const nav=document.getElementById('catNav'); let h='';
  let groups;
  if(CURR_UNIVERSE==='mf') groups={equity:'Equity',hybrids:'Hybrids'};
  else if(CURR_UNIVERSE==='nmf') groups={non_mf:'Non MF'};
  else groups={indices:'Indices'};
  for(const[gk,gl] of Object.entries(groups)){
    const cats=(CAT_DATA[CURR_UNIVERSE]||{})[gk]||[]; if(!cats.length)continue;
    if(CURR_UNIVERSE!=='idx') h+=`<span class="cat-group-label">${gl}</span>`;
    cats.forEach(c=>{ const a=c.code===CATEGORY?' active':''; const cnt=c.fund_count>0?`<span class="fund-count">(${c.fund_count})</span>`:'';
      h+=`<a class="cat-tab${a}" href="/dashboard/${c.code}">${c.name}${cnt}</a>`; });
  }
  nav.innerHTML=h;
}
function switchUniverse(u,btn){
  CURR_UNIVERSE=u; document.querySelectorAll('.uni-tab').forEach(t=>t.classList.remove('active')); btn.classList.add('active');
  const g=CAT_DATA[u]||{}; const fg=Object.values(g)[0];
  if(fg&&fg.length) window.location.href='/dashboard/'+fg[0].code; else renderCatNav();
}

function fetchFunds(asOf){
  const url=asOf===LATEST_AS_OF?`/api/funds/${CATEGORY}`:`/api/funds_as_of/${CATEGORY}?as_of=${asOf}`;
  fetch(url).then(r=>r.json()).then(data=>{
    if(data.empty){showEmptyState();return;}
    ALL_FUNDS=data.funds||[]; LATEST_AS_OF=data.latest_as_of||LATEST_AS_OF; SESSION_AS_OF=data.as_of||asOf; BM_TYPE=data.bm_type||'explicit';
    showDataState(); updateAsOfDisplay(); populateCustomFundSelect(); renderTable();
  }).catch(()=>showEmptyState());
}
function showEmptyState(){
  document.getElementById('emptyState').style.display='flex'; document.getElementById('dataState').style.display='none';
  document.getElementById('legendBar').style.display='none'; document.getElementById('asofControl').style.display='none';
}
function showDataState(){
  document.getElementById('emptyState').style.display='none';
  const ds=document.getElementById('dataState'); ds.style.display='flex'; ds.style.flexDirection='column'; ds.style.flex='1'; ds.style.overflow='hidden'; ds.style.minHeight='0';
  document.getElementById('legendBar').style.display=BM_TYPE!=='none'?'flex':'none';
  document.getElementById('asofControl').style.display='flex';
}
function updateAsOfDisplay(){
  document.getElementById('asOfBadge').textContent=SESSION_AS_OF;
  const inp=document.getElementById('asOfInput'); inp.value=SESSION_AS_OF; inp.max=LATEST_AS_OF;
  const rb=document.getElementById('resetAsOfBtn'); if(rb) rb.style.display=SESSION_AS_OF!==LATEST_AS_OF?'inline-block':'none';
}
function applyAsOf(){ const v=document.getElementById('asOfInput').value; if(v){SESSION_AS_OF=v; fetchFunds(v);} }
function resetAsOf(){ SESSION_AS_OF=LATEST_AS_OF; document.getElementById('asOfInput').value=LATEST_AS_OF; fetchFunds(LATEST_AS_OF); }

const sn=n=>(n||'').replace(/ Fund-Reg\(G\)/g,'').replace(/ Fund\(G\)/g,'');
const fmtAum=v=>!v?'':v>=10000?`₹${(v/1000).toFixed(1)}K Cr`:`₹${Math.round(v).toLocaleString()} Cr`;
const fp=v=>v==null?null:(v>=0?'+':'')+parseFloat(v).toFixed(2)+'%';
function brc(fv,bv){ if(fv==null||bv==null)return'ret-na'; const t=Math.abs(bv)*0.10; if(fv>=bv+t)return'ret-g'; if(fv<=bv-t)return'ret-r'; return'ret-gr'; }
function pctCell(v,bv,isBM){
  if(v==null)return'<span class="ret-na">—</span>';
  const s=fp(v);
  // No benchmark: show in black
  if(BM_TYPE==='none') return`<span class="ret-bk">${s}</span>`;
  if(isBM)return`<span class="${v>=0?'ret-g':'ret-r'}">${s}</span>`;
  return`<span class="${brc(v,bv)}">${s}</span>`;
}
const getBM=()=>ALL_FUNDS.find(f=>f.type==='benchmark');
const getStrat=()=>ALL_FUNDS.filter(f=>f.type==='strategy');
const getFunds=()=>ALL_FUNDS.filter(f=>f.type==='fund');

// ── SEARCH: filters table rows directly ──
function filterSearch(q){
  SEARCH_QUERY=q.toLowerCase().trim();
  renderTable();
}

function getFilteredFunds(){
  if(!SEARCH_QUERY) return ALL_FUNDS;
  const bm=getBM();
  return ALL_FUNDS.filter(f=>f.type==='benchmark'||f.name.toLowerCase().includes(SEARCH_QUERY));
}

function selectItem(id){ SEL_ITEM=ALL_FUNDS.find(f=>f.id===id)||null; showDetail(SEL_ITEM); }

function setView(v,btn){
  CURR_VIEW=v; document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  document.getElementById('customPanel').style.display=v==='custom'?'':'none';
  document.getElementById('rollingControl').style.display=(v==='rolling'&&BM_TYPE!=='none')?'flex':'none';
  if(SEL_ITEM) showDetail(SEL_ITEM); else{showTable();renderTable();}
}
function showTable(){
  document.getElementById('tablePanel').style.display='flex'; document.getElementById('detailPanel').style.display='none';
  const cn=document.querySelector('.cat-tab.active');
  document.getElementById('breadcrumb').innerHTML=`${cn?cn.textContent.trim():''} › <strong>All Funds</strong>`;
  SEL_ITEM=null;
}
function renderTable(){
  if(CURR_VIEW==='trailing')buildTrailing(); else if(CURR_VIEW==='calendar')buildCalendar();
  else if(CURR_VIEW==='rolling')buildRolling(); else if(CURR_VIEW==='custom')buildCustomPlaceholder();
}

function nameCell(item){
  const isBM=item.type==='benchmark',isSI=item.type==='strategy';
  const clr=isBM?'color:#92400e;font-weight:600':isSI?'color:#6d28d9;font-weight:500':'';
  const badge=isBM?' <span class="badge badge-bm">BM</span>':isSI?' <span class="badge badge-si">PRI</span>':'';
  const clickAttr=`style="${clr};cursor:pointer;text-decoration:underline dotted transparent" onmouseover="this.style.textDecorationColor='currentColor'" onmouseout="this.style.textDecorationColor='transparent'"`;
  return`<span ${clickAttr} onclick="event.stopPropagation();selectItem(${item.id})">${sn(item.name)}${badge}</span>`;
}
function rowClass(item){ if(item.type==='benchmark')return'bm-row'; if(item.type==='strategy')return'strat-row'; return''; }

function buildTrailing(){
  const bm=getBM(), all=getFilteredFunds(), bmv=k=>bm?bm[k]:null;
  const hasBM = BM_TYPE !== 'none';
  let th=`<tr><th>Fund / Index</th>${TR_COLS.map(c=>`<th>${c.l}</th>`).join('')}<th>Since Inc.</th>${hasBM?'<th>SI BM</th>':''}</tr>`;
  let tb='';
  if(bm && all.find(f=>f.id===bm.id)){
    tb+=`<tr class="bm-row bm-pinned"><td>${nameCell(bm)}</td>${TR_COLS.map(c=>`<td>${pctCell(bm[c.k],null,true)}</td>`).join('')}<td>${pctCell(bm.since_inception,null,true)}</td>${hasBM?'<td><span class="ret-na">—</span></td>':''}</tr>`;
  }
  all.filter(f=>f.type!=='benchmark').forEach(f=>{
    tb+=`<tr class="${rowClass(f)}"><td>${nameCell(f)}</td>${TR_COLS.map(c=>`<td>${pctCell(f[c.k],bmv(c.k),false)}</td>`).join('')}<td>${pctCell(f.since_inception,bmv('since_inception'),false)}</td>${hasBM?`<td>${f.since_inception_bm!=null?`<span class="${f.since_inception_bm>=0?'ret-g':'ret-r'}">${fp(f.since_inception_bm)}</span>`:'<span class="ret-na">—</span>'}</td>`:''}</tr>`;
  });
  document.getElementById('mainThead').innerHTML=th;
  document.getElementById('mainTbody').innerHTML=tb||'<tr><td colspan="14" class="loading-msg">No data</td></tr>';
}

function buildCalendar(){
  const bm=getBM(), all=getFilteredFunds(), yrs=getCYYears();
  let th=`<tr><th>Fund / Index</th>${yrs.map(y=>`<th>${y}</th>`).join('')}</tr>`;
  let tb='';
  if(bm && all.find(f=>f.id===bm.id)){
    tb+=`<tr class="bm-row bm-pinned"><td>${nameCell(bm)}</td>${yrs.map(y=>`<td>${pctCell(bm['cy'+y],null,true)}</td>`).join('')}</tr>`;
  }
  all.filter(f=>f.type!=='benchmark').forEach(f=>{
    tb+=`<tr class="${rowClass(f)}"><td>${nameCell(f)}</td>${yrs.map(y=>`<td>${pctCell(f['cy'+y],bm?bm['cy'+y]:null,false)}</td>`).join('')}</tr>`;
  });
  document.getElementById('mainThead').innerHTML=th;
  document.getElementById('mainTbody').innerHTML=tb||'<tr><td colspan="12" class="loading-msg">No data</td></tr>';
}

function buildRolling(){
  const bm=getBM(), all=getFilteredFunds();
  const hasBM = BM_TYPE !== 'none';
  let hdrs=['3Y Rolling','5Y Rolling'];
  if(hasBM) hdrs.push('% Times Outperformance > BM (3Y)','% Times Outperformance > BM (5Y)');
  hdrs.push('Since Inc.','Beta','Info Ratio','Std Dev');
  let th=`<tr><th>Fund / Index</th>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr>`;
  let tb='';
  function rrow(f,cls){
    const isBM=f.type==='benchmark'; const op3=f.outperf_3y,op5=f.outperf_5y;
    let r=`<tr class="${cls}"><td>${nameCell(f)}</td><td>${pctCell(f.roll_3y,bm?bm.roll_3y:null,isBM)}</td><td>${pctCell(f.roll_5y,bm?bm.roll_5y:null,isBM)}</td>`;
    if(hasBM) r+=`<td>${op3!=null?`<span class="${op3>=50?'ret-g':'ret-r'}">${op3.toFixed(1)}%</span>`:'<span class="ret-na">—</span>'}</td><td>${op5!=null?`<span class="${op5>=50?'ret-g':'ret-r'}">${op5.toFixed(1)}%</span>`:'<span class="ret-na">—</span>'}</td>`;
    r+=`<td>${pctCell(f.since_inception,bm?bm.since_inception:null,isBM)}</td><td><span style="color:#64748b">${f.beta!=null?f.beta.toFixed(4):'—'}</span></td><td><span class="${f.info_ratio!=null?(f.info_ratio>0?'ret-g':'ret-r'):'ret-na'}">${f.info_ratio!=null?f.info_ratio.toFixed(4):'—'}</span></td><td><span style="color:#64748b">${f.std_dev!=null?f.std_dev.toFixed(2):'—'}</span></td></tr>`;
    return r;
  }
  if(bm && all.find(f=>f.id===bm.id)) tb+=rrow(bm,'bm-row bm-pinned');
  all.filter(f=>f.type!=='benchmark').forEach(f=>tb+=rrow(f,rowClass(f)));
  document.getElementById('mainThead').innerHTML=th;
  document.getElementById('mainTbody').innerHTML=tb||'<tr><td colspan="10" class="loading-msg">No data</td></tr>';
}

function applyThreshold(){
  const t=document.getElementById('outperfThreshold').value;
  document.getElementById('mainTbody').innerHTML='<tr><td colspan="10" class="loading-msg">Recalculating…</td></tr>';
  fetch('/api/outperf_custom',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({category:CATEGORY,threshold:parseFloat(t),as_of:SESSION_AS_OF})}).then(r=>r.json()).then(data=>{
    if(data.results){ data.results.forEach(r=>{ const f=ALL_FUNDS.find(x=>x.id===r.fund_id); if(f){f.outperf_3y=r.outperf_3y;f.outperf_5y=r.outperf_5y;} }); buildRolling(); }
  });
}

function buildCustomPlaceholder(){
  document.getElementById('mainThead').innerHTML='<tr><th>Fund / Index</th><th>Absolute Return</th><th>Annualised CAGR</th><th>NAV (From)</th><th>NAV (To)</th><th>Days</th></tr>';
  document.getElementById('mainTbody').innerHTML='<tr><td colspan="6" style="padding:20px;color:#94a3b8">Select dates and click Calculate.</td></tr>';
}
function populateCustomFundSelect(){
  const sel=document.getElementById('customFundSelect'); if(!sel)return;
  sel.innerHTML=ALL_FUNDS.map(f=>`<option value="${f.id}">${sn(f.name)}</option>`).join('');
}
function runCustom(){
  const from=document.getElementById('fromDate').value, to=document.getElementById('toDate').value;
  if(!from||!to){alert('Select both dates.');return;}
  const sel=document.getElementById('customFundSelect');
  const fids=Array.from(sel.selectedOptions).map(o=>parseInt(o.value));
  document.getElementById('mainTbody').innerHTML='<tr><td colspan="6" style="padding:20px;color:#94a3b8">Calculating…</td></tr>';
  fetch('/api/custom_return',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({category:CATEGORY,from_date:from,to_date:to,fund_ids:fids})}).then(r=>r.json()).then(data=>{
    let tb='';
    data.results.forEach(r=>{
      const isBM=r.type==='benchmark',isSI=r.type==='strategy';
      const clr=isBM?'color:#92400e':isSI?'color:#6d28d9':'';
      const badge=isBM?'<span class="badge badge-bm">BM</span>':isSI?'<span class="badge badge-si">PRI</span>':'';
      const ac=r.abs_return>=0?'ret-g':'ret-r';
      tb+=`<tr><td style="${clr}">${sn(r.name)} ${badge}</td><td><span class="${ac}">${fp(r.abs_return)}</span></td><td>${r.ann_return!=null?`<span class="${r.ann_return>=0?'ret-g':'ret-r'}">${fp(r.ann_return)}</span>`:'<span class="ret-na">—</span>'}</td><td style="color:#64748b;font-family:'DM Mono',monospace">${r.nav_from!=null?'₹'+r.nav_from.toFixed(3):'—'}</td><td style="color:#64748b;font-family:'DM Mono',monospace">${r.nav_to!=null?'₹'+r.nav_to.toFixed(3):'—'}</td><td style="color:#94a3b8">${r.days}</td></tr>`;
    });
    document.getElementById('mainTbody').innerHTML=tb||'<tr><td colspan="6" style="padding:14px;color:#94a3b8">No data.</td></tr>';
  }).catch(e=>{ document.getElementById('mainTbody').innerHTML=`<tr><td colspan="6" style="color:#dc2626;padding:14px">Error: ${e.message}</td></tr>`; });
}

// ── DETAIL VIEW ──
function showDetail(item){
  if(!item)return;
  document.getElementById('tablePanel').style.display='none';
  document.getElementById('detailPanel').style.display='';
  const cn=document.querySelector('.cat-tab.active');
  document.getElementById('breadcrumb').innerHTML=`${cn?cn.textContent.trim():''} › <strong>${sn(item.name)}</strong>`;
  const bm=getBM(),isBM=item.type==='benchmark',isSI=item.type==='strategy';
  const sc=(l,v,sub)=>`<div class="stat-card"><div class="stat-lbl">${l}</div><div class="stat-val ${v!=null?(v>=0?'ret-g':'ret-r'):'ret-na'}">${v!=null?fp(v):'—'}</div><div class="stat-sub">${sub||''}</div></div>`;
  const rc=(p,k)=>{ const fv=item[k],bv=bm?bm[k]:null,diff=fv!=null&&bv!=null?(fv-bv):null;
    const cls=(!isBM&&!isSI)?brc(fv,bv):(fv!=null?(fv>=0?'ret-g':'ret-r'):'ret-na');
    return`<div class="ret-card"><div class="ret-period">${p}</div><div class="ret-val ${cls}">${fv!=null?fp(fv):'—'}</div>${!isBM&&bv!=null?`<div class="ret-bm">BM: ${fp(bv)}</div>`:''}${!isBM&&diff!=null?`<div class="ret-alpha ${diff>=0?'ret-g':'ret-r'}">${fp(diff)} α</div>`:''}</div>`; };
  const mgrs=[item.manager1,item.manager2].filter(Boolean).map(m=>`<div class="mgr-card"><div class="mgr-av">${m[0].toUpperCase()}</div><div><div class="mgr-name">${m}</div><div class="mgr-title">Fund Manager</div></div></div>`).join('');
  const CY=getCYYears();
  const cyH=CY.map(y=>{ const fv=item['cy'+y],bv=bm?bm['cy'+y]:null;
    const cls=(!isBM&&!isSI)?brc(fv,bv):(fv!=null?(fv>=0?'ret-g':'ret-r'):'ret-na');
    return`<div class="cy-cell"><div class="cy-yr">${y}</div><div class="cy-val ${cls}">${fv!=null?fp(fv):'—'}</div>${!isBM&&bv!=null?`<div class="cy-bm">${fp(bv)}</div>`:''}</div>`; }).join('');

  let rollHtml='';
  if(item.qualifies_rolling){
    const r3c=item.roll_3y!=null?(item.roll_3y>=0?'ret-g':'ret-r'):'',r5c=item.roll_5y!=null?(item.roll_5y>=0?'ret-g':'ret-r'):'';
    const d3=item.roll_3y!=null&&bm&&bm.roll_3y!=null?(item.roll_3y-bm.roll_3y):null,d5=item.roll_5y!=null&&bm&&bm.roll_5y!=null?(item.roll_5y-bm.roll_5y):null;
    const op3=item.outperf_3y,op5=item.outperf_5y;
    rollHtml=`<div class="card"><div class="card-h">Rolling Returns & Outperformance</div><div class="card-b"><div class="roll-grid"><div><div class="rl">3Y Rolling Avg</div><div class="rv ${r3c}">${item.roll_3y!=null?fp(item.roll_3y):'—'}</div>${!isBM&&bm&&bm.roll_3y!=null?`<div class="rsub">BM: ${fp(bm.roll_3y)}${d3!=null?' · α: <span class="'+(d3>=0?'ret-g':'ret-r')+'">'+fp(d3)+'</span>':''}</div>`:''}</div><div><div class="rl">5Y Rolling Avg</div><div class="rv ${r5c}">${item.roll_5y!=null?fp(item.roll_5y):'—'}</div>${!isBM&&bm&&bm.roll_5y!=null?`<div class="rsub">BM: ${fp(bm.roll_5y)}${d5!=null?' · α: <span class="'+(d5>=0?'ret-g':'ret-r')+'">'+fp(d5)+'</span>':''}</div>`:''}</div><div><div class="rl">Since Inception</div><div class="rv ${item.since_inception!=null?(item.since_inception>=0?'ret-g':'ret-r'):''}">${item.since_inception!=null?fp(item.since_inception):'—'}</div><div class="rsub">From ${item.inception_date||'—'}</div></div></div>${(op3!=null||op5!=null)?`<div class="outperf-grid"><div><div class="rl">% Times Outperformance > BM (3Y)</div><div class="rv ${op3!=null&&op3>=50?'ret-g':'ret-r'}">${op3!=null?op3.toFixed(1)+'%':'—'}</div></div><div><div class="rl">% Times Outperformance > BM (5Y)</div><div class="rv ${op5!=null&&op5>=50?'ret-g':'ret-r'}">${op5!=null?op5.toFixed(1)+'%':'—'}</div></div></div>`:''}</div></div>`;
  } else if(item.type==='fund'){
    rollHtml=`<div class="card"><div class="card-h">Rolling Returns</div><div class="card-b" style="color:#64748b;font-size:12px">⚠ Requires 10 years of history. Inception: <strong>${item.inception_date||'—'}</strong>${item.since_inception!=null?`<div style="margin-top:10px"><div class="rl">Since Inception CAGR</div><div class="rv ${item.since_inception>=0?'ret-g':'ret-r'}">${fp(item.since_inception)}</div></div>`:''}</div></div>`;
  }

  let mcpHtml='';
  if(item.lc_pct!=null){ const lc=(item.lc_pct*100).toFixed(1),mc=((item.mc_pct||0)*100).toFixed(1),sc=((item.sc_pct||0)*100).toFixed(1);
    mcpHtml=`<div class="card"><div class="card-h">Market Cap Allocation</div><div class="card-b"><div class="mcp-bar"><div style="width:${lc}%;background:#2563eb;border-radius:3px 0 0 3px"></div><div style="width:${mc}%;background:#d97706"></div><div style="width:${sc}%;background:#16a34a;border-radius:0 3px 3px 0"></div></div><div class="mcp-legend"><span><span class="mcp-dot" style="background:#2563eb"></span>LC: <strong>${lc}%</strong></span><span><span class="mcp-dot" style="background:#d97706"></span>MC: <strong>${mc}%</strong></span><span><span class="mcp-dot" style="background:#16a34a"></span>SC: <strong>${sc}%</strong></span></div></div></div>`;
  }

  let sectorsHtml='';
  const sectors=[[item.sector1_name,item.sector1_pct],[item.sector2_name,item.sector2_pct],[item.sector3_name,item.sector3_pct]].filter(s=>s[0]);
  if(sectors.length){
    const cumWt=sectors.reduce((a,s)=>a+(s[1]||0),0);
    sectorsHtml=`<div class="card"><div class="card-h">Top Sectors</div><div class="card-b"><div class="sectors-wrap">${sectors.map(s=>`<span class="sector-tag">${s[0]}${s[1]!=null?' ('+s[1].toFixed(1)+'%)':''}</span>`).join('')}</div><div style="font-size:10px;color:#64748b;margin-top:6px">Cumulative weight: <strong>${cumWt.toFixed(1)}%</strong></div></div></div>`;
  }

  // Hybrid allocation card
  let hybridAllocHtml='';
  if(item.equity_pct!=null || item.debt_pct!=null || item.others_pct!=null){
    const eq=item.equity_pct, neq=item.net_equity_pct, db=item.debt_pct, ot=item.others_pct;
    const gld=item.gold_pct, slv=item.silver_pct, rts=item.reits_pct;
    const fmtP=v=>v!=null?v.toFixed(1)+'%':'—';
    // Build allocation bar
    const eqW=eq||0, dbW=db||0, otW=ot||0;
    const total=eqW+dbW+otW;
    hybridAllocHtml=`<div class="card"><div class="card-h">Asset Allocation</div><div class="card-b">
      ${total>0?`<div class="mcp-bar" style="margin-bottom:10px">
        <div style="width:${(eqW/total*100).toFixed(1)}%;background:#2563eb;border-radius:3px 0 0 3px" title="Equity ${fmtP(eq)}"></div>
        <div style="width:${(dbW/total*100).toFixed(1)}%;background:#059669" title="Debt ${fmtP(db)}"></div>
        <div style="width:${(otW/total*100).toFixed(1)}%;background:#d97706;border-radius:0 3px 3px 0" title="Others ${fmtP(ot)}"></div>
      </div>`:''}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:8px;background:#f0f9ff;border-radius:6px;border:1px solid #bfdbfe">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.5px">Equity</div>
          <div style="font-size:16px;font-weight:500;font-family:'DM Mono',monospace;color:#2563eb">${fmtP(eq)}</div>
        </div>
        <div style="text-align:center;padding:8px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.5px">Net Equity</div>
          <div style="font-size:16px;font-weight:500;font-family:'DM Mono',monospace;color:#059669">${fmtP(neq)}</div>
        </div>
        <div style="text-align:center;padding:8px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.5px">Debt</div>
          <div style="font-size:16px;font-weight:500;font-family:'DM Mono',monospace;color:#059669">${fmtP(db)}</div>
        </div>
        <div style="text-align:center;padding:8px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.5px">Others</div>
          <div style="font-size:16px;font-weight:500;font-family:'DM Mono',monospace;color:#d97706">${fmtP(ot)}</div>
        </div>
      </div>
      ${(gld!=null||slv!=null||rts!=null)?`<div style="border-top:1px solid #f1f5f9;padding-top:8px">
        <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.5px;margin-bottom:6px">Others Breakdown</div>
        <div style="display:flex;gap:16px;font-size:12px">
          ${gld!=null?`<span style="color:#b45309"><strong>Gold:</strong> ${fmtP(gld)}</span>`:''}
          ${slv!=null?`<span style="color:#64748b"><strong>Silver:</strong> ${fmtP(slv)}</span>`:''}
          ${rts!=null?`<span style="color:#7c3aed"><strong>REITs:</strong> ${fmtP(rts)}</span>`:''}
        </div>
      </div>`:''}</div></div>`;
  }

  const typTag=isBM?'<span class="tag amber">Benchmark</span>':isSI?'<span class="tag purple">Strategy Index · PRI</span>':'<span class="tag blue">Active Fund</span>';
  let siVsBm='';
  if(!isBM&&!isSI&&item.since_inception_bm!=null){
    const diff=item.since_inception!=null?(item.since_inception-item.since_inception_bm):null;
    siVsBm=`<div class="stat-card"><div class="stat-lbl">SI Benchmark</div><div class="stat-val ${item.since_inception_bm>=0?'ret-g':'ret-r'}">${fp(item.since_inception_bm)}</div><div class="stat-sub">${diff!=null?`α: <span class="${diff>=0?'ret-g':'ret-r'}">${fp(diff)}</span>`:''}</div></div>`;
  }

  document.getElementById('detailContent').innerHTML=`
    <div class="detail-name">${sn(item.name)}</div>
    <div class="detail-tags">${typTag}${item.inception_date?`<span class="tag">Since ${item.inception_date}</span>`:''}${item.expense_ratio?`<span class="tag amber">ER: ${item.expense_ratio.toFixed(2)}%</span>`:''}${item.aum_latest?`<span class="tag green">AUM: ${fmtAum(item.aum_latest)}</span>`:''}${!isBM&&!isSI?(item.qualifies_rolling?'<span class="tag green">✓ Rolling eligible</span>':'<span class="tag amber">⚠ No rolling data</span>'):''}</div>
    ${isSI?'<div style="padding:7px 12px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:7px;font-size:11px;color:#6d28d9;margin-bottom:12px">ⓘ Price Return Index (PRI)</div>':''}
    ${mgrs?`<div class="mgrs-wrap">${mgrs}</div>`:''}
    <div class="stat-grid">${sc('1 Year',item.ret_1y,'CAGR')}${sc('3 Year',item.ret_3y,'CAGR')}${sc('5 Year',item.ret_5y,'CAGR')}${sc('Since Inception',item.since_inception,'From '+(item.inception_date||'—'))}${siVsBm}</div>
    ${!isBM&&!isSI?`<div class="risk-grid"><div class="stat-card"><div class="stat-lbl">Beta</div><div class="stat-val">${item.beta!=null?item.beta.toFixed(4):'—'}</div><div class="stat-sub">vs Benchmark</div></div><div class="stat-card"><div class="stat-lbl">Info Ratio</div><div class="stat-val ${item.info_ratio!=null?(item.info_ratio>0?'ret-g':'ret-r'):'ret-na'}">${item.info_ratio!=null?item.info_ratio.toFixed(4):'—'}</div><div class="stat-sub">Active consistency</div></div><div class="stat-card"><div class="stat-lbl">Std Deviation</div><div class="stat-val">${item.std_dev!=null?item.std_dev.toFixed(2):'—'}</div><div class="stat-sub">Volatility</div></div></div>`:''}
    <div class="card"><div class="card-h">Trailing Returns vs Benchmark</div><div class="card-b"><div class="ret-grid">${[['YTD','ytd'],['1M','ret_1m'],['3M','ret_3m'],['6M','ret_6m'],['1Y','ret_1y'],['2Y','ret_2y'],['3Y','ret_3y'],['5Y','ret_5y'],['7Y','ret_7y'],['10Y','ret_10y']].map(p=>rc(p[0],p[1])).join('')}</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">Returns >1Y annualised CAGR · <1Y absolute · α = alpha vs BM</div></div></div>
    ${rollHtml}${mcpHtml}${sectorsHtml}${hybridAllocHtml}
    <div class="card"><div class="card-h">Calendar Year Returns</div><div class="card-b"><div class="cy-grid">${cyH}</div>${!isBM?'<div style="font-size:10px;color:#94a3b8;margin-top:6px">Amber = BM return</div>':''}</div></div>`;
}

// ── UPLOAD MODALS ──
function populateModalCategories(){
  fetch('/api/categories').then(r=>r.json()).then(data=>{
    let opts='';
    for(const[u,groups] of Object.entries(data)) for(const[g,cats] of Object.entries(groups))
      cats.forEach(c=>{ opts+=`<option value="${c.code}"${c.code===CATEGORY?' selected':''}>${u==='nmf'?'[Non MF] ':''}${c.name}</option>`; });
    ['firstUploadCat','updateCat'].forEach(id=>{ const el=document.getElementById(id); if(el)el.innerHTML=opts; });
  });
}
function openFirstUploadForCategory(){ const s=document.getElementById('firstUploadCat'); if(s)s.value=CATEGORY; openModal('firstUploadModal'); }
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){
  document.getElementById(id).classList.remove('show');
  if(id==='updateModal'){_updateFiles=[];renderUpdateFileList();document.getElementById('updateStatus').style.display='none';document.getElementById('updateBtn').disabled=true;document.getElementById('updatePwd').value='';}
  if(id==='firstUploadModal'){document.getElementById('firstUploadStatus').style.display='none';document.getElementById('firstUploadBtn').disabled=true;document.getElementById('firstUploadPwd').value='';document.getElementById('firstFileName').textContent='';const fi=document.getElementById('firstFileInput');if(fi)fi.value='';}
}
function togglePwd(id){ const i=document.getElementById(id); i.type=i.type==='password'?'text':'password'; }

let _firstFile=null;
function handleFirstFile(input){ if(input.files.length>0){_firstFile=input.files[0]; document.getElementById('firstFileName').innerHTML=`<div class="file-row"><span class="file-name">📄 ${_firstFile.name}</span><span class="file-size">${(_firstFile.size/1024).toFixed(0)} KB</span><button class="file-remove" onclick="removeFirstFile()">✕</button></div>`; document.getElementById('firstUploadBtn').disabled=false;} }
function removeFirstFile(){_firstFile=null;document.getElementById('firstFileName').textContent='';document.getElementById('firstUploadBtn').disabled=true;document.getElementById('firstFileInput').value='';}
function showStatus(elId,cls,msg){ const el=document.getElementById(elId); el.className='upload-status '+cls; el.innerHTML=msg; el.style.display='block'; }
function doFirstUpload(){
  if(!_firstFile)return; const pwd=document.getElementById('firstUploadPwd').value, cat=document.getElementById('firstUploadCat').value;
  if(!pwd){showStatus('firstUploadStatus','err','Enter password.');return;}
  const fd=new FormData(); fd.append('file',_firstFile); fd.append('password',pwd); fd.append('category',cat);
  showStatus('firstUploadStatus','warn','⏳ Processing… This may take 1–3 minutes.'); document.getElementById('firstUploadBtn').disabled=true;
  fetch('/api/upload_navs',{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
    if(data.success){ let msg=`✓ ${data.message}`;
      if(data.created_funds.length) msg+=`<br><strong>Created:</strong> ${data.created_funds.join(', ')}`;
      if(data.fund_nav_counts){ msg+='<br><br><strong>NAV counts per fund:</strong><br>'; for(const[n,c] of Object.entries(data.fund_nav_counts)) msg+=`${n}: ${c}<br>`; }
      showStatus('firstUploadStatus','ok',msg); setTimeout(()=>window.location.href='/dashboard/'+cat, 2000);
    } else { showStatus('firstUploadStatus','err','✗ '+data.error); document.getElementById('firstUploadBtn').disabled=false; }
  }).catch(e=>{showStatus('firstUploadStatus','err','Error: '+e.message);document.getElementById('firstUploadBtn').disabled=false;});
}

let _updateFiles=[];
function handleUpdateDrop(e){e.preventDefault();document.getElementById('updateDropZone').classList.remove('drag');addUpdateFiles(Array.from(e.dataTransfer.files));}
function handleUpdateFiles(input){addUpdateFiles(Array.from(input.files));}
function addUpdateFiles(nf){nf.forEach(f=>{const e=f.name.toLowerCase();if(e.endsWith('.xlsx')||e.endsWith('.xls')||e.endsWith('.csv'))if(!_updateFiles.find(x=>x.name===f.name))_updateFiles.push(f);});renderUpdateFileList();document.getElementById('updateBtn').disabled=_updateFiles.length===0;}
function removeUpdateFile(i){_updateFiles.splice(i,1);renderUpdateFileList();document.getElementById('updateBtn').disabled=_updateFiles.length===0;}
function renderUpdateFileList(){const el=document.getElementById('updateFileList');if(!_updateFiles.length){el.innerHTML='<div style="color:#94a3b8;font-size:11px">No files selected</div>';return;}el.innerHTML=_updateFiles.map((f,i)=>`<div class="file-row"><span class="file-name">📄 ${f.name}</span><span class="file-size">${(f.size/1024).toFixed(0)} KB</span><button class="file-remove" onclick="removeUpdateFile(${i})">✕</button></div>`).join('');}
function doUpdate(){
  if(!_updateFiles.length)return; const pwd=document.getElementById('updatePwd').value,cat=document.getElementById('updateCat').value;
  if(!pwd){showStatus('updateStatus','err','Enter password.');return;}
  const fd=new FormData(); _updateFiles.forEach(f=>fd.append('files',f)); fd.append('password',pwd); fd.append('category',cat);
  showStatus('updateStatus','warn',`⏳ Processing ${_updateFiles.length} file(s)…`); document.getElementById('updateBtn').disabled=true;
  fetch('/api/upload_update',{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
    if(data.success){ let msg=`✓ ${data.message}`; if(data.files&&data.files.length){msg+='<br>';data.files.forEach(f=>{msg+=`• ${f.filename} — Matched: <strong>${f.matched}</strong>`;if(f.nav_date)msg+=` · Date: ${f.nav_date}`;msg+='<br>';});}
      if(data.parse_errors&&data.parse_errors.length)msg+=`<br>⚠ ${data.parse_errors.join('; ')}`;
      showStatus('updateStatus','ok',msg); setTimeout(()=>window.location.href='/dashboard/'+cat, 2000);
    } else {showStatus('updateStatus','err','✗ '+data.error);document.getElementById('updateBtn').disabled=false;}
  }).catch(e=>{showStatus('updateStatus','err','Error: '+e.message);document.getElementById('updateBtn').disabled=false;});
}

function downloadExcel(){window.location.href=`/api/download/${CATEGORY}?as_of=${SESSION_AS_OF}`;}
