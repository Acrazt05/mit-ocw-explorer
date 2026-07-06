// MIT OCW Knowledge Map - Interactive D3.js Force Graph
(function() {
'use strict';

// ========== STATE ==========
const STORAGE_KEY_TAKEN = 'mit-ocw-taken-courses';
const STORAGE_KEY_SAVED = 'mit-ocw-saved-plans';
const STORAGE_KEY_EXCLUSIONS = 'mit-ocw-excluded-courses';

function loadSetFromStorage(key){ try { const d=localStorage.getItem(key); return d ? new Set(JSON.parse(d)) : new Set(); } catch(e){ return new Set(); } }
function saveSetToStorage(key, s){ localStorage.setItem(key, JSON.stringify([...s])); }

const state = {
  nodes: [],
  links: [],
  selectedNodes: [],
  get selectedNode(){ return this.selectedNodes[0]||null; },
  activeDepts: new Set(),
  searchQuery: '',
  path: null,
  hideLone: false,
  activeLevels: new Set(),
  activeFeatures: new Set(),
  activeSort: 'num',
  takenCourses: loadSetFromStorage(STORAGE_KEY_TAKEN),
  excludedCourses: loadSetFromStorage(STORAGE_KEY_EXCLUSIONS),
};

// ========== DOM ELEMENTS ==========
const graphEl = document.getElementById('graph');
const tooltip = document.getElementById('tooltip');
const searchInp = document.getElementById('search');
const deptFiltersEl = document.getElementById('dept-filters');
const courseDetail = document.getElementById('course-detail');
const pathSelect = document.getElementById('path-select');
const loadingEl = document.getElementById('loading-overlay');
const statTotal = document.getElementById('stat-total');
const statVisible = document.getElementById('stat-visible');
const statSelected = document.getElementById('stat-selected');
const levelFiltersEl = document.getElementById('level-filters');
const featureFiltersEl = document.getElementById('feature-filters');
const sortSelect = document.getElementById('sort-select');
const exportBar = document.getElementById('export-bar');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnToggleFilters = document.getElementById('btn-toggle-filters');
const advancedFilters = document.getElementById('advanced-filters');
const filtersToggleIcon = document.getElementById('filters-toggle-icon');
const btnToggleDepts = document.getElementById('btn-toggle-depts');
const deptFiltersWrap = document.getElementById('dept-filters-wrap');
const deptsToggleIcon = document.getElementById('depts-toggle-icon');

// ========== D3 SETUP ==========
const W = () => graphEl.clientWidth;
const H = () => graphEl.clientHeight;

const svg = d3.select('#graph').append('svg').attr('width','100%').attr('height','100%');
const defs = svg.append('defs');

// Glow
const glow = defs.append('filter').attr('id','glow');
glow.append('feGaussianBlur').attr('stdDeviation','3').attr('result','blur');
const merge = glow.append('feMerge');
merge.append('feMergeNode').attr('in','blur');
merge.append('feMergeNode').attr('in','SourceGraphic');

// Arrows — larger and more visible
defs.append('marker').attr('id','arrow').attr('viewBox','0 -6 12 12').attr('refX',18).attr('refY',0).attr('markerWidth',8).attr('markerHeight',8).attr('orient','auto').append('path').attr('d','M0,-6L12,0L0,6').attr('fill','#4a4a7a');
defs.append('marker').attr('id','arrow-hl').attr('viewBox','0 -6 12 12').attr('refX',18).attr('refY',0).attr('markerWidth',8).attr('markerHeight',8).attr('orient','auto').append('path').attr('d','M0,-6L12,0L0,6').attr('fill','#7c5cfc');

// Star for gateway courses
const starPath = defs.append('symbol').attr('id','star').attr('viewBox','-8 -8 16 16');
starPath.append('path').attr('d','M0,-7 L1.6,-2.2 L6.7,-2.2 L2.6,1.1 L4.1,6 L0,3 L-4.1,6 L-2.6,1.1 L-6.7,-2.2 L-1.6,-2.2 Z').attr('fill','#ffd43b').attr('stroke','#b8860b').attr('stroke-width',0.5);

// Compute gateway courses — courses that unlock the most
let GATEWAY_SET = new Set();
(function computeGateways(){
  const counts = {};
  for(const [cid,preqs] of Object.entries(PREREQUISITES)){
    for(const p of preqs){
      if(p==='GIR') continue;
      counts[p] = (counts[p]||0) + 1;
    }
  }
  // Top 5% by unlock count, minimum 3 unlocks
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const threshold = Math.max(3, Math.round(sorted.length*0.05));
  sorted.slice(0, threshold).forEach(([id])=>{ GATEWAY_SET.add(id); });
})();

const g = svg.append('g');
const zoom = d3.zoom().scaleExtent([0.08,5]).on('zoom',(e)=>{g.attr('transform',e.transform);tooltip.style.display='none';});
svg.call(zoom);
svg.on('click',(e)=>{if(e.target===svg.node()){selectNode(null);}});

let simulation;

// ========== BUILD GRAPH ==========
const GROUP_CENTERS = {
  math: [-300,-200], physics: [-150,-150], chemistry: [100,-200],
  biology: [250,-80], eecs: [0,80], engineering: [-200,100],
  economics: [300,150], management: [350,250], humanities: [-100,300],
  science: [150,-300], other: [0,0]
};

function buildGraph(){
  let filtered = COURSES;
  if(state.activeDepts.size>0) filtered = filtered.filter(c=>state.activeDepts.has(c.department));
  // Level filter
  if(state.activeLevels.size>0) filtered = filtered.filter(c=>(c.level||[]).some(l=>state.activeLevels.has(l)));
  // Feature filter
  if(state.activeFeatures.size>0) filtered = filtered.filter(c=>(c.features||[]).some(f=>state.activeFeatures.has(f)));
  if(state.searchQuery){
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(c=>c.id.toLowerCase().includes(q)||c.title.toLowerCase().includes(q)||(c.description||'').toLowerCase().includes(q)||(c.topics||[]).some(t=>t.toLowerCase().includes(q)));
  }
  // Sort
  if(state.activeSort==='alpha') filtered = [...filtered].sort((a,b)=>a.title.localeCompare(b.title));
  else if(state.activeSort==='dept') filtered = [...filtered].sort((a,b)=>a.department.localeCompare(b.department));

  const nodeLookup = {};
  const nodes = filtered.map(c=>{
    const n = { id:c.id, title:c.title, department:c.department, group:c.group, color:c.color, level:c.level||[], topics:c.topics||[], desc:(c.description||'').slice(0,200), url:c.url, features:c.features||[], radius:5 };
    nodeLookup[c.id]=n;
    return n;
  });

  const nodeIds = new Set(nodes.map(n=>n.id));
  const links = [];
  for(const [cid,preqs] of Object.entries(PREREQUISITES)){
    if(!nodeIds.has(cid)) continue;
    for(const p of preqs){
      if(p==='GIR'||!nodeIds.has(p)) continue;
      if(!links.some(l=>l.source===p&&l.target===cid)) links.push({source:p,target:cid,value:1});
    }
  }

  // Filter lone nodes if toggle is on
  if(state.hideLone){
    const connectedIds = new Set();
    for(const l of links){ connectedIds.add(l.source); connectedIds.add(l.target); }
    const filteredNodes = nodes.filter(n=>connectedIds.has(n.id));
    const filteredIds = new Set(filteredNodes.map(n=>n.id));
    const filteredLinks = links.filter(l=>filteredIds.has(l.source)&&filteredIds.has(l.target));
    return {nodes:filteredNodes, links:filteredLinks, nodeLookup};
  }

  return {nodes,links,nodeLookup};
}

// ========== RENDER ==========
function render(gd){
  state.nodes = gd.nodes;
  state.links = gd.links;
  g.selectAll('*').remove();
  if(simulation) simulation.stop();

  statTotal.textContent = COURSES.length;
  statVisible.textContent = gd.nodes.length;
  statSelected.textContent = state.selectedNodes.length;

  // Links
  g.selectAll('.lg').data(gd.links).join('g').attr('class','lg').append('line')
    .attr('stroke','#2a2a45').attr('stroke-width',0.7).attr('stroke-opacity',0.5).attr('marker-end','url(#arrow)');

  // Nodes
  const ng = g.selectAll('.ng').data(gd.nodes).join('g').attr('class','ng').attr('cursor','pointer');
  ng.append('circle').attr('r',d=>d.radius).attr('fill',d=>d.color).attr('stroke',d=>d3.color(d.color).darker(0.5)).attr('stroke-width',1).attr('stroke-opacity',0.4).attr('opacity',0.85);
  ng.append('text').text(d=>d.id).attr('x',0).attr('y',-9).attr('text-anchor','middle').attr('fill','#7070a0').attr('font-size','7px').attr('font-family','JetBrains Mono,monospace').attr('pointer-events','none').attr('opacity',0.65);
  // Star badge for gateway courses
  ng.filter(d=>GATEWAY_SET.has(d.id)).append('use').attr('href','#star').attr('x',-6).attr('y',4).attr('width',12).attr('height',12).attr('class','gw-star').attr('pointer-events','none');

  ng.on('mouseover',(ev,d)=>{
    if(state.selectedNodes.some(n=>n.id===d.id)) return;
    d3.select(ev.currentTarget).select('circle').transition().duration(120).attr('r',d.radius*2.2).attr('filter','url(#glow)').attr('opacity',1);
    const pre = getPrerequisites(d.id).filter(isAvailable);
    const unl = getUnlocks(d.id).filter(isAvailable);
    const [mx,my] = d3.pointer(ev,svg.node());
    tooltip.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-weight:700;color:var(--accent);font-size:13px;">${d.id}</div><div style="font-weight:600;margin:3px 0;">${d.title}</div><div style="font-size:10px;color:var(--text3);">${d.department}${d.level.length?' · '+d.level.join(', '):''}</div>${d.desc?`<div style="font-size:10px;color:var(--text2);margin-top:4px;line-height:1.4;">${d.desc.slice(0,140)}…</div>`:''}${pre.length?`<div style="font-size:10px;color:#ff6b6b;margin-top:3px;">⬆ ${pre.slice(0,4).join(', ')}${pre.length>4?' +'+(pre.length-4):''}</div>`:''}${unl.length?`<div style="font-size:10px;color:#51cf66;margin-top:2px;">⬇ ${unl.slice(0,4).join(', ')}${unl.length>4?' +'+(unl.length-4):''}</div>`:''}`;
    tooltip.style.display='block'; tooltip.style.left=(mx+14)+'px'; tooltip.style.top=(my+14)+'px';
  });
  ng.on('mouseout',(ev,d)=>{
    if(state.selectedNodes.some(n=>n.id===d.id)) return;
    d3.select(ev.currentTarget).select('circle').transition().duration(120).attr('r',d.radius).attr('filter',null).attr('opacity',0.85);
    tooltip.style.display='none';
  });
  ng.on('click',(ev,d)=>{ev.stopPropagation();
    if(ev.shiftKey) addNodeToSelection(d); else selectNode(d);
  });
  ng.on('contextmenu',(ev,d)=>{ev.preventDefault();ev.stopPropagation();toggleTaken(d);});

  // Taken-course checkmarks
  ng.each(function(d){
    if(state.takenCourses.has(d.id)){
      const sel = d3.select(this);
      const r = d.radius;
      sel.append('text')
        .attr('class','taken-check')
        .attr('x',0).attr('y',r*0.7).attr('text-anchor','middle')
        .attr('fill','#51cf66').attr('font-size',`${r*2.5}px`).attr('font-weight','900')
        .attr('pointer-events','none').attr('stroke','#1a5c1a').attr('stroke-width',0.8)
        .text('✔');
    }
  });
  ng.call(d3.drag().on('start',(ev,d)=>{if(!ev.active) simulation.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;})
    .on('drag',(ev,d)=>{d.fx=ev.x;d.fy=ev.y;})
    .on('end',(ev,d)=>{if(!ev.active) simulation.alphaTarget(0);d.fx=null;d.fy=null;}));

  // Force simulation
  simulation = d3.forceSimulation(gd.nodes)
    .force('link',d3.forceLink(gd.links).id(d=>d.id).distance(55).strength(0.25))
    .force('charge',d3.forceManyBody().strength(-100))
    .force('center',d3.forceCenter(0,0))
    .force('x',d3.forceX(d=>(GROUP_CENTERS[d.group]||GROUP_CENTERS.other)[0]).strength(0.04))
    .force('y',d3.forceY(d=>(GROUP_CENTERS[d.group]||GROUP_CENTERS.other)[1]).strength(0.04))
    .force('collision',d3.forceCollide().radius(d=>d.radius+4))
    .alphaDecay(0.018)
    .on('tick',()=>{
      g.selectAll('.lg line').attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
      g.selectAll('.ng').attr('transform',d=>`translate(${d.x},${d.y})`);
    });

  if(state.selectedNodes.length) highlightAll();
}

// ========== HIGHLIGHT ==========
function highlightAll(){
  // Reset all
  g.selectAll('.ng circle').transition().duration(200).attr('opacity',0.85).attr('r',d=>d.radius).attr('filter',null).attr('stroke',d=>d3.color(d.color).darker(0.5)).attr('stroke-width',1).attr('stroke-opacity',0.4);
  g.selectAll('.ng text').transition().duration(200).attr('opacity',0.65);
  g.selectAll('.lg line').transition().duration(200).attr('stroke','#2a2a45').attr('stroke-width',0.7).attr('stroke-opacity',0.5).attr('marker-end','url(#arrow)');
  if(!state.selectedNodes.length) return;

  const sels = state.selectedNodes;
  const selIds = new Set(sels.map(n=>n.id));

  // Merge chains from all selected nodes
  const allChains = new Set();
  const allPre = new Set();
  const allUnl = new Set();
  const chainEdges = new Set();

  for(const node of sels){
    const chain = buildChain(node.id);
    chain.forEach(id=>allChains.add(id));
    getPrerequisites(node.id).filter(id=>COURSE_MAP[id]).forEach(id=>allPre.add(id));
    getUnlocks(node.id).filter(id=>COURSE_MAP[id]).forEach(id=>allUnl.add(id));
    for(let i=0; i<chain.length-1; i++) chainEdges.add(chain[i]+'→'+chain[i+1]);
  }

  // Compute shortest distance to any selected node (for ordering)
  const dist = {};
  for(const nid of allChains){
    let best = Infinity;
    for(const sel of sels){
      const chain = buildChain(sel.id);
      const idx = chain.indexOf(nid);
      if(idx>=0 && idx<best) best = idx;
    }
    dist[nid] = best===Infinity ? 999 : best;
  }
  const maxDist = Math.max(1, ...Object.values(dist));

  const rel = new Set([...allPre, ...allUnl]);

  g.selectAll('.ng circle').transition().duration(200)
    .attr('opacity',d=>{
      if(selIds.has(d.id)) return 1;
      if(allChains.has(d.id)) return 1;
      if(allUnl.has(d.id)) return 0.7;
      return 0.08;
    })
    .attr('r',d=>{
      if(selIds.has(d.id)) return d.radius*3;
      if(allChains.has(d.id)) return d.radius*2;
      if(allUnl.has(d.id)) return d.radius*1.4;
      return d.radius;
    })
    .attr('filter',d=>selIds.has(d.id)?'url(#glow)':null)
    .attr('stroke',d=>{
      if(selIds.has(d.id)) return '#fff';
      if(allChains.has(d.id)){
        const t = (dist[d.id]||0) / maxDist;
        const r = Math.round(255*t + 100*(1-t));
        const g = Math.round(180*t + 80*(1-t));
        const b = Math.round(80*t + 40*(1-t));
        return `rgb(${r},${g},${b})`;
      }
      if(allUnl.has(d.id)) return '#51cf66';
      return d3.color(d.color).darker(0.5);
    })
    .attr('stroke-width',d=>{
      if(selIds.has(d.id)) return 3.5;
      if(allChains.has(d.id)) return 2.5;
      if(allUnl.has(d.id)) return 2;
      return 1;
    }).attr('stroke-opacity',1);

  g.selectAll('.ng text').transition().duration(200)
    .attr('opacity',d=>rel.has(d.id)||allChains.has(d.id)?1:0.05)
    .attr('font-weight',d=>selIds.has(d.id)?'700':allChains.has(d.id)?'600':allUnl.has(d.id)?'500':'400');

  g.selectAll('.lg line').transition().duration(200)
    .attr('stroke',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return '#ffa040';
      if(selIds.has(d.source.id)||selIds.has(d.target.id)) return '#7c5cfc';
      return '#2a2a45';
    })
    .attr('stroke-width',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return 3;
      if(selIds.has(d.source.id)||selIds.has(d.target.id)) return 2.2;
      return 0.7;
    })
    .attr('stroke-opacity',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return 1;
      if(selIds.has(d.source.id)||selIds.has(d.target.id)) return 0.9;
      return 0.2;
    })
    .attr('marker-end',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return 'url(#arrow-hl)';
      if(selIds.has(d.source.id)||selIds.has(d.target.id)) return 'url(#arrow-hl)';
      return 'url(#arrow)';
    });
}

function selectNode(node){
  state.selectedNodes = node ? [node] : [];
  tooltip.style.display = 'none';
  highlightAll();
  updateDetail();
  exportBar.style.display = node ? 'block' : 'none';
}

function addNodeToSelection(node){
  // Toggle: if already selected, remove; otherwise add
  const idx = state.selectedNodes.findIndex(n=>n.id===node.id);
  if(idx>=0) state.selectedNodes.splice(idx,1);
  else state.selectedNodes.push(node);
  tooltip.style.display = 'none';
  highlightAll();
  updateDetail();
  exportBar.style.display = state.selectedNodes.length ? 'block' : 'none';
}

// ========== DETAIL PANEL ==========
function updateDetail(){
  if(!state.selectedNodes.length){
    courseDetail.innerHTML=`<div class="empty-state"><div class="icon">📚</div><div>Click a course node<br>or <strong>Shift+Click</strong> to select multiple</div></div>`;
    statSelected.textContent='0';
    return;
  }
  statSelected.textContent = state.selectedNodes.length;

  // Merge all chains
  const mergedChains = new Set();
  const allPre = new Set();
  const allUnl = new Set();
  for(const node of state.selectedNodes){
    buildChain(node.id).forEach(id=>mergedChains.add(id));
    getPrerequisites(node.id).filter(isAvailable).forEach(id=>allPre.add(id));
    getUnlocks(node.id).filter(isAvailable).forEach(id=>allUnl.add(id));
  }
  const selIds = new Set(state.selectedNodes.map(n=>n.id));

  // Show selected courses as cards, then merged chain
  let h = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
    <span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Selected (${state.selectedNodes.length})</span>
    <button id="btn-clear-sel" style="padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;font-size:10px;">✕ Clear</button>
  </div>`;

  for(const node of state.selectedNodes){
    h+=`<div class="course-card" style="border-color:var(--accent);border-width:2px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div class="cnum">${node.id}</div>
        <button class="btn-remove-sel" data-id="${node.id}" style="padding:2px 8px;border-radius:4px;border:1px solid #ff6b6b;background:transparent;color:#ff6b6b;cursor:pointer;font-size:10px;">✕</button>
      </div>
      <div class="ctitle">${node.title}</div>
      <div class="cmeta"><span class="ctag dept">${node.department}</span>`;
    (node.level||[]).forEach(l=>{h+=`<span class="ctag level">${l}</span>`;});
    (node.features||[]).slice(0,3).forEach(f=>{h+=`<span class="ctag">${f}</span>`;});
    h+=`</div>${node.desc?`<div class="cdesc">${node.desc}</div>`:''}
      <div class="clinks"><a class="clink" href="https://ocw.mit.edu/search/?q=${encodeURIComponent(node.id)}" target="_blank">OCW Search ↗</a></div>
    </div>`;
  }

  // Merged prerequisite chain
  const sortedChain = [...mergedChains].sort((a,b)=>{
    const da = Math.min(...state.selectedNodes.map(s=>{const c=buildChain(s.id);const i=c.indexOf(a);return i>=0?i:999;}));
    const db = Math.min(...state.selectedNodes.map(s=>{const c=buildChain(s.id);const i=c.indexOf(b);return i>=0?i:999;}));
    return da-db;
  });

  h+=`<div class="prereq-section"><div class="prereq-title">🧭 Merged Prerequisite Chain (${mergedChains.size} courses)</div><div class="prereq-flow">`;
  sortedChain.forEach((id,i)=>{
    if(i>0) h+=`<span class="prereq-arrow">→</span>`;
    h+=`<span class="prereq-node" data-id="${id}" style="${selIds.has(id)?'background:var(--accent);color:#fff;font-weight:700;':''}">${id}</span>`;
  });
  h+=`</div></div>`;

  if(allUnl.size){
    h+=`<div class="prereq-section"><div class="prereq-title">⬇ Common Unlocks (${allUnl.size})</div><div class="prereq-flow">`;
    [...allUnl].slice(0,20).forEach(u=>{h+=`<span class="prereq-node" data-id="${u}">${u}</span>`;});
    if(allUnl.size>20) h+=`<span class="prereq-node">+${allUnl.size-20} more</span>`;
    h+=`</div></div>`;
  }

  courseDetail.innerHTML = h;

  // Bind handlers
  const btnClear = document.getElementById('btn-clear-sel');
  if(btnClear) btnClear.addEventListener('click',()=>{selectNode(null);});
  courseDetail.querySelectorAll('.btn-remove-sel').forEach(el=>{
    el.addEventListener('click',()=>{
      const id = el.dataset.id;
      state.selectedNodes = state.selectedNodes.filter(n=>n.id!==id);
      highlightAll();
      updateDetail();
      statSelected.textContent = state.selectedNodes.length;
      exportBar.style.display = state.selectedNodes.length ? 'block' : 'none';
      if(!state.selectedNodes.length) courseDetail.innerHTML=`<div class="empty-state"><div class="icon">📚</div><div>Click a course node<br>or <strong>Shift+Click</strong> to select multiple</div></div>`;
    });
  });
  courseDetail.querySelectorAll('.prereq-node').forEach(el=>{
    el.addEventListener('click',()=>{
      const id=el.dataset.id; if(!id)return;
      const n=state.nodes.find(x=>x.id===id);
      if(n){selectNode(n);centerOnNode(n);}
    });
  });
}

function buildChain(cid,visited=new Set(),depth=0){
  if(visited.has(cid)||depth>8) return [];
  visited.add(cid);
  const pre = getPrerequisites(cid).filter(isAvailable).filter(p=>COURSE_MAP[p]);
  const all = [];
  for(const p of pre) {
    if(!state.takenCourses.has(p)) all.push(...buildChain(p,visited,depth+1));
  }
  if(!state.takenCourses.has(cid)) all.push(cid);
  return [...new Set(all)];
}

function centerOnNode(node){
  const t = d3.zoomTransform(svg.node());
  const tx = -node.x*t.k+W()/2, ty = -node.y*t.k+H()/2;
  svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity.translate(tx,ty).scale(t.k));
}

// ========== SEARCH ==========
searchInp.addEventListener('input',()=>{
  state.searchQuery = searchInp.value.trim();
  refresh();
});

// ========== DEPARTMENT FILTERS ==========
function buildDeptFilters(){
  const counts = {};
  COURSES.forEach(c=>{counts[c.department]=(counts[c.department]||0)+1;});
  const depts = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  deptFiltersEl.innerHTML = depts.map(([d,n])=>`<span class="dept-chip${state.activeDepts.has(d)?' active':''}" data-dept="${d.replace(/"/g,'"')}">${d} <span style="opacity:0.5;font-size:10px;">${n}</span></span>`).join('');
  deptFiltersEl.querySelectorAll('.dept-chip').forEach(el=>{el.addEventListener('click',()=>{
    const dept = el.dataset.dept;
    if(state.activeDepts.has(dept)) state.activeDepts.delete(dept); else state.activeDepts.add(dept);
    buildDeptFilters(); refresh();
  });});
  // Count active departments in button label
  const activeCount = state.activeDepts.size;
  btnToggleDepts.querySelector('span:last-child').textContent = activeCount ? `Departments (${activeCount} selected)` : 'Departments';
}

// Department toggle
let deptsExpanded = true;
btnToggleDepts.addEventListener('click', ()=>{
  deptsExpanded = !deptsExpanded;
  if(deptsExpanded){
    deptFiltersWrap.style.maxHeight = '200px';
    deptsToggleIcon.textContent = '▾';
    btnToggleDepts.style.borderColor = 'var(--accent)';
    btnToggleDepts.style.color = 'var(--accent)';
  } else {
    deptFiltersWrap.style.maxHeight = '0';
    deptsToggleIcon.textContent = '▸';
    btnToggleDepts.style.borderColor = 'var(--border)';
    btnToggleDepts.style.color = 'var(--text2)';
  }
});
// Start departments expanded
deptFiltersWrap.style.maxHeight = '200px';
deptsToggleIcon.textContent = '▾';
btnToggleDepts.style.borderColor = 'var(--accent)';
btnToggleDepts.style.color = 'var(--accent)';

// ========== LEARNING PATHS ==========
const LEARNING_PATHS = {
  'robotics': { name:'🤖 Robotics', courses:['18.01','18.02','18.03','18.06','8.01','8.02','6.0001','6.006','6.041','2.003','2.004','6.200','6.241','2.12','6.141','16.30','16.405'] },
  'ai-ml': { name:'🧠 AI & Machine Learning', courses:['18.01','18.02','18.06','18.03','6.0001','6.042','6.006','6.041','18.600','6.034','6.867','6.869','6.047'] },
  'quantum': { name:'⚛️ Quantum Computing', courses:['18.01','18.02','18.03','18.06','8.01','8.02','8.03','8.04','8.044','8.05','8.370','6.006','6.845','8.371'] },
  'biotech': { name:'🧬 Biotechnology', courses:['5.111','5.12','7.012','7.03','7.05','7.06','18.01','18.02','5.60','7.91','6.006'] },
  'economics': { name:'📈 Economics', courses:['18.01','18.02','14.01','14.02','14.03','14.04','14.30','14.32','14.381','14.382'] },
  'physics': { name:'🔭 Physics', courses:['18.01','18.02','18.03','18.06','8.01','8.02','8.03','8.04','8.044','8.05','8.06','8.033'] },
  'math': { name:'📐 Pure Math', courses:['18.01','18.02','18.03','18.06','18.100','18.200','18.700','18.701','18.702','18.705','18.725'] },
  'cs-theory': { name:'💻 CS Theory', courses:['6.0001','6.042','18.02','6.006','6.046','6.854','6.855','6.856','6.045'] },
  'control-sys': { name:'🎛️ Control Systems', courses:['18.01','18.02','18.03','18.06','6.002','6.003','6.200','6.241','2.004','2.151','16.30'] },
  'aerospace': { name:'🚀 Aerospace', courses:['18.01','18.02','18.03','18.06','8.01','8.02','2.001','2.003','16.001','16.002','16.003','16.004'] },
  'datascience': { name:'📊 Data Science', courses:['18.01','18.02','18.06','18.05','6.0001','6.006','6.041','6.867','6.869','15.075'] },
  'energy': { name:'⚡ Energy', courses:['18.01','18.02','18.03','8.01','8.02','5.111','5.60','2.005','22.01','22.02','22.05'] },
};

function buildPathOptions(){
  pathSelect.innerHTML = '<option value="">— Browse freely —</option>';
  for(const [key,path] of Object.entries(LEARNING_PATHS)){
    pathSelect.innerHTML += `<option value="${key}">${path.name}</option>`;
  }
}
pathSelect.addEventListener('change',()=>{
  const key = pathSelect.value;
  if(!key){state.path=null;refresh();return;}
  const path = LEARNING_PATHS[key];
  if(!path) return;
  state.path = path.courses;
  state.searchQuery = '';
  state.activeDepts.clear();
  searchInp.value = '';
  buildDeptFilters();
  refresh();
});

// ========== LEVEL FILTERS ==========
const LEVEL_OPTIONS = ['Undergraduate','Graduate'];
function buildLevelFilters(){
  if(!LEVEL_OPTIONS.length) return;
  levelFiltersEl.innerHTML = LEVEL_OPTIONS.map(l=>`<span class="dept-chip${state.activeLevels.has(l)?' active':''}" data-val="${l}">🎓 ${l}</span>`).join('');
  levelFiltersEl.querySelectorAll('.dept-chip').forEach(el=>{el.addEventListener('click',()=>{
    const v = el.dataset.val;
    if(state.activeLevels.has(v)) state.activeLevels.delete(v); else state.activeLevels.add(v);
    buildLevelFilters(); refresh();
  });});
}

// ========== FEATURE FILTERS ==========
const TOP_FEATURES = ['Lecture Videos','Lecture Notes','Problem Sets','Exams','Exam Solutions','Projects','Written Assignments','Programming Assignments','Instructor Insights'];
function buildFeatureFilters(){
  featureFiltersEl.innerHTML = TOP_FEATURES.map(f=>`<span class="dept-chip${state.activeFeatures.has(f)?' active':''}" data-val="${f}">📎 ${f}</span>`).join('');
  featureFiltersEl.querySelectorAll('.dept-chip').forEach(el=>{el.addEventListener('click',()=>{
    const v = el.dataset.val;
    if(state.activeFeatures.has(v)) state.activeFeatures.delete(v); else state.activeFeatures.add(v);
    buildFeatureFilters(); refresh();
  });});
}

// ========== SORT ==========
sortSelect.addEventListener('change',()=>{
  state.activeSort = sortSelect.value;
  refresh();
});

// ========== UPDATE DATA BUTTON ==========
const btnRefreshData = document.getElementById('btn-refresh-data');
btnRefreshData.addEventListener('click', ()=>{
  const msg = 'To update course data, run:\npython update_data.py\n\nThen reload this page.\n\nReload now?';
  if(confirm(msg)) location.reload();
});

// ========== REFRESH ==========
function refresh(){
  const gd = buildGraph();
  render(gd);
  if(state.selectedNodes.length){
    const restored = [];
    for(const sel of state.selectedNodes){
      const found = gd.nodes.find(n=>n.id===sel.id);
      if(found) restored.push(found);
    }
    state.selectedNodes = restored;
    highlightAll();
    updateDetail();
    statSelected.textContent = state.selectedNodes.length;
    exportBar.style.display = state.selectedNodes.length ? 'block' : 'none';
  }
}

// ========== TAKEN COURSES ==========
function toggleTaken(node){
  if(state.takenCourses.has(node.id)){
    state.takenCourses.delete(node.id);
    saveSetToStorage(STORAGE_KEY_TAKEN, state.takenCourses);
    applyTakenCheckmarks();
    // Rebuild plan: refresh highlights and detail (course may now re-appear in plan)
    if(state.selectedNodes.length){
      highlightAll();
      updateDetail();
    }
  } else {
    const preqs = getPrerequisites(node.id).filter(isAvailable).filter(p=>COURSE_MAP[p]);
    if(preqs.length>0){
      const cascade = confirm(`Mark "${node.id}: ${node.title}" as taken?\n\nIt has ${preqs.length} prerequisite(s): ${preqs.slice(0,5).join(', ')}${preqs.length>5?'...':''}\n\nClick OK to also mark all prerequisites as taken.\nClick Cancel to mark only this course.`);
      if(cascade){
        const stack = [...preqs];
        while(stack.length){
          const pid = stack.pop();
          if(!state.takenCourses.has(pid)){
            state.takenCourses.add(pid);
            const pp = getPrerequisites(pid).filter(isAvailable).filter(p=>COURSE_MAP[p]);
            for(const p of pp) if(!state.takenCourses.has(p)) stack.push(p);
          }
        }
      }
    }
    state.takenCourses.add(node.id);
    saveSetToStorage(STORAGE_KEY_TAKEN, state.takenCourses);
    applyTakenCheckmarks();
    // If this node was selected, remove it from selection
    const wasSelected = state.selectedNodes.some(n=>n.id===node.id);
    if(wasSelected){
      state.selectedNodes = state.selectedNodes.filter(n=>n.id!==node.id);
    }
    // Rebuild plan to exclude taken courses
    if(state.selectedNodes.length){
      highlightAll();
      updateDetail();
      statSelected.textContent = state.selectedNodes.length;
      exportBar.style.display = 'block';
    } else {
      selectNode(null);
    }
  }
}

function applyTakenCheckmarks(){
  // Remove existing checkmarks
  g.selectAll('.taken-check').remove();
  // Re-add checkmarks on nodes that are taken
  g.selectAll('.ng').each(function(d){
    if(state.takenCourses.has(d.id)){
      const sel = d3.select(this);
      const r = d.radius;
      sel.append('text')
        .attr('class','taken-check')
        .attr('x',0).attr('y',r*0.7).attr('text-anchor','middle')
        .attr('fill','#51cf66').attr('font-size',`${r*2.5}px`).attr('font-weight','900')
        .attr('pointer-events','none').attr('stroke','#1a5c1a').attr('stroke-width',0.8)
        .text('✔');
    }
  });
}

// ========== SAVE / LOAD PLAN ==========
function getSavedPlans(){
  try { const d=localStorage.getItem(STORAGE_KEY_SAVED); return d ? JSON.parse(d) : []; } catch(e){ return []; }
}
function savePlanToStorage(name){
  const plans = getSavedPlans();
  const ids = state.selectedNodes.map(n=>n.id);
  // Remove existing plan with same name
  const filtered = plans.filter(p=>p.name!==name);
  filtered.push({name, courses:ids, date: new Date().toISOString()});
  localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(filtered));
  updateSavedPlansUI();
}
function loadPlan(name){
  const plans = getSavedPlans();
  const plan = plans.find(p=>p.name===name);
  if(!plan) return;
  state.selectedNodes = plan.courses.map(id=>{
    const cn = state.nodes.find(n=>n.id===id);
    return cn || {id, title:'', department:'', group:'other', color:'#888', level:[], features:[], radius:5};
  }).filter(n=>n);
  highlightAll();
  updateDetail();
  exportBar.style.display = state.selectedNodes.length ? 'block' : 'none';
  statSelected.textContent = state.selectedNodes.length;
}
function deletePlan(name){
  const plans = getSavedPlans().filter(p=>p.name!==name);
  localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(plans));
  updateSavedPlansUI();
}
function updateSavedPlansUI(){
  const container = document.getElementById('saved-plans-list');
  if(!container) return;
  const plans = getSavedPlans();
  if(!plans.length){
    container.innerHTML = `<div style="font-size:10px;color:var(--text3);padding:4px 0;">No saved plans yet.</div>`;
    return;
  }
  container.innerHTML = plans.map(p=>{
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;gap:6px;">
      <span style="font-size:11px;color:var(--text);cursor:pointer;flex:1;" class="load-plan-btn" data-name="${p.name.replace(/"/g,'"')}">📋 ${p.name} <span style="color:var(--text3);font-size:9px;">(${p.courses.length} courses)</span></span>
      <button class="del-plan-btn" data-name="${p.name.replace(/"/g,'"')}" style="padding:1px 6px;border-radius:3px;border:1px solid #ff6b6b;background:transparent;color:#ff6b6b;cursor:pointer;font-size:9px;">✕</button>
    </div>`;
  }).join('');
  container.querySelectorAll('.load-plan-btn').forEach(el=>{
    el.addEventListener('click',()=>loadPlan(el.dataset.name));
  });
  container.querySelectorAll('.del-plan-btn').forEach(el=>{
    el.addEventListener('click',(e)=>{e.stopPropagation();deletePlan(el.dataset.name);});
  });
}

// ========== LONE NODE TOGGLE ==========
const loneToggle = document.getElementById('lone-toggle');
const loneCheck = document.getElementById('lone-check');
loneToggle.addEventListener('click',()=>{
  state.hideLone = !state.hideLone;
  if(state.hideLone){
    loneCheck.style.background = 'var(--accent)';
    loneCheck.firstElementChild.style.left = '14px';
    loneCheck.firstElementChild.style.background = '#fff';
  } else {
    loneCheck.style.background = 'var(--surface3)';
    loneCheck.firstElementChild.style.left = '2px';
    loneCheck.firstElementChild.style.background = 'var(--text3)';
  }
  refresh();
});

// ========== PDF EXPORT ==========
btnExportPdf.addEventListener('click', ()=>{
  if(!state.selectedNodes.length) return;

  // Merge chains from all selected courses
  const selIds = new Set(state.selectedNodes.map(n=>n.id));
  const mergedChains = new Set();
  for(const node of state.selectedNodes){
    buildChain(node.id).forEach(id=>mergedChains.add(id));
  }

  // Sort chain topologically (prerequisites first)
  const sortedChain = [...mergedChains].sort((a,b)=>{
    const da = Math.min(...state.selectedNodes.map(s=>{const c=buildChain(s.id);const i=c.indexOf(a);return i>=0?i:999;}));
    const db = Math.min(...state.selectedNodes.map(s=>{const c=buildChain(s.id);const i=c.indexOf(b);return i>=0?i:999;}));
    return da-db;
  });

  const chainNodes = sortedChain.map(id=>COURSE_MAP[id]).filter(Boolean);
  const selTitles = state.selectedNodes.map(n=>`${n.id}: ${n.title}`).join(', ');
  const pathName = pathSelect.selectedOptions[0]?.textContent || 'Custom Plan';

  const printWin = window.open('','_blank','width=900,height=700');
  printWin.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>MIT OCW Learning Plan — ${state.selectedNodes.length} courses</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;padding:40px 60px;max-width:900px;margin:0 auto}
h1{font-size:24px;margin-bottom:4px;color:#7c5cfc}
h2{font-size:14px;color:#666;font-weight:400;margin-bottom:24px}
.path-flow{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:32px;padding:16px;background:#f5f3ff;border-radius:12px;overflow-x:auto}
.path-chip{padding:6px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;background:#e8e4ff;color:#5c3cf0;white-space:nowrap}
.path-arrow{color:#999;font-weight:700}
.path-chip.target{background:#7c5cfc;color:#fff}
.course-block{border:1px solid #e0e0e8;border-radius:12px;padding:20px;margin-bottom:16px;page-break-inside:avoid;background:#fafafa}
.course-block .cnum{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:#7c5cfc;margin-bottom:4px}
.course-block .ctitle{font-size:16px;font-weight:600;margin-bottom:8px}
.course-block .cmeta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.course-block .ctag{padding:3px 10px;border-radius:12px;font-size:10px;font-weight:500;background:#e8e4ff;color:#5c3cf0}
.course-block .ctag.dept{background:#fff0e0;color:#c06000}
.course-block .cdesc{font-size:12px;color:#555;line-height:1.6}
.course-block .cprereq{font-size:11px;color:#888;margin-top:8px}
.course-block .clinks{margin-top:10px}
.course-block .clinks a{font-size:11px;color:#7c5cfc;text-decoration:none;margin-right:12px}
.gateway-badge{display:inline-block;background:#ffe066;color:#8a6d00;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-left:6px}
.footer{text-align:center;margin-top:40px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:20px}
@media print{body{padding:20px 30px}}
</style></head><body>
<h1>📚 ${pathName}</h1>
<h2>Merged prerequisite plan for <strong>${state.selectedNodes.length} course${state.selectedNodes.length>1?'s':''}: ${selTitles}</strong></h2>
<div class="path-flow">${sortedChain.map((id,i)=>(i>0?'<span class="path-arrow">→</span>':'')+`<span class="path-chip${selIds.has(id)?' target':''}">${id}</span>`).join('')}</div>
<h2 style="margin-bottom:16px;">Course Details (${chainNodes.length} courses)</h2>
${
  chainNodes.map((c,i)=>{
    const pre = getPrerequisites(c.id).filter(isAvailable);
    const unl = (UNLOCKS[c.id]||[]).filter(isAvailable);
    const isGateway = GATEWAY_SET.has(c.id);
    return `<div class="course-block">
      <div class="cnum">${i+1}. ${c.id} ${selIds.has(c.id)?'<span class="gateway-badge" style="background:#7c5cfc;color:#fff;">🎯 Selected</span>':''} ${isGateway?'<span class="gateway-badge">⭐ Gateway</span>':''}</div>
      <div class="ctitle">${c.title}</div>
      <div class="cmeta"><span class="ctag dept">${c.department}</span>${(c.level||[]).map(l=>`<span class="ctag">${l}</span>`).join('')}${(c.features||[]).slice(0,3).map(f=>`<span class="ctag">${f}</span>`).join('')}</div>
      <div class="cdesc">${c.description||'No description available.'}</div>
      ${pre.length?`<div class="cprereq">⬆ Prerequisites: ${pre.join(', ')}</div>`:''}
      ${unl.length?`<div class="cprereq">⬇ Unlocks: ${unl.slice(0,8).join(', ')}${unl.length>8?' +'+(unl.length-8)+' more':''}</div>`:''}
      <div class="clinks"><a href="https://ocw.mit.edu/search/?q=${encodeURIComponent(c.id)}" target="_blank">OCW Search ↗</a></div>
    </div>`;
  }).join('\n')
}
<div class="footer" style="page-break-after:always;">MIT OCW Knowledge Map · ${new Date().toLocaleDateString()} · Click browser Print → Save as PDF</div>
${buildTreeGraphPage(sortedChain, selIds)}
</body></html>`);
  printWin.document.close();
  setTimeout(()=>printWin.print(), 400);
});

function buildTreeGraphPage(sortedChain, selIds){
  // Build reverse index: which courses depend on each prerequisite
  const children = {};
  for(const cid of sortedChain){
    children[cid] = [];
  }
  for(const cid of sortedChain){
    const preqs = getPrerequisites(cid).filter(id=>sortedChain.includes(id));
    for(const p of preqs){
      if(children[p]) children[p].push(cid);
    }
  }

  // Find roots (courses with no prerequisites in the chain)
  const roots = sortedChain.filter(cid=>{
    const preqs = getPrerequisites(cid).filter(id=>sortedChain.includes(id));
    return preqs.length===0;
  });
  if(!roots.length) return '';

  // BFS to assign layers (depth from roots)
  const layer = {};
  const queue = roots.map(r=>({id:r, d:0}));
  for(const qi of queue){
    if(layer[qi.id]!==undefined) continue;
    layer[qi.id] = qi.d;
    for(const ch of (children[qi.id]||[])){
      queue.push({id:ch, d:qi.d+1});
    }
  }
  // Ensure all nodes have a layer
  for(const cid of sortedChain){
    if(layer[cid]===undefined) layer[cid]=0;
  }

  // Group nodes by layer
  const maxLayer = Math.max(0, ...Object.values(layer));
  const layers = {};
  for(const cid of sortedChain){
    const l = layer[cid];
    if(!layers[l]) layers[l]=[];
    layers[l].push(cid);
  }

  // Layout params for landscape fit — top-to-bottom tree
  const nodeW = 70, nodeH = 24;
  const gapX = 18, gapY = 80; // swapped: horizontal gap is small, vertical gap is large
  const totLayers = maxLayer+1;
  // Calculate max nodes in any layer (now horizontal width)
  let maxPerLayer = 0;
  for(let l=0; l<=maxLayer; l++){
    maxPerLayer = Math.max(maxPerLayer, (layers[l]||[]).length);
  }
  const colW = nodeW+gapX;
  const svgW = maxPerLayer*colW+40;
  const svgH = totLayers*(nodeH+gapY)+60;

  // Helper to darken a hex color
  function darkenHex(hex, amt){
    let r=128,g=128,b=128;
    if(hex&&hex.length>=7){
      r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16);
    }
    r=Math.max(0,Math.round(r*(1-amt))); g=Math.max(0,Math.round(g*(1-amt))); b=Math.max(0,Math.round(b*(1-amt)));
    return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  // Build SVG — layers go top-to-bottom (y), nodes within layer spread horizontally (x)
  let svg = `<div class="tree-page" style="page-break-before:always;"><h2 style="color:#7c5cfc;margin-bottom:12px;">🌳 Prerequisite Tree</h2>`;
  svg += `<p style="font-size:11px;color:#666;margin-bottom:16px;">Read top-to-bottom: earlier courses at top, selected courses in <span style="background:#7c5cfc;color:#fff;padding:1px 6px;border-radius:3px;">purple</span>. Click any course for OCW Search.</p>`;
  svg += `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-height:100%;font-family:'JetBrains Mono',monospace;">`;

  // Position nodes: layers go top→bottom (y), nodes spread left→right (x)
  const positions = {};
  for(let l=0; l<=maxLayer; l++){
    const ids = layers[l]||[];
    const y = l*(nodeH+gapY)+30;
    const totalW = ids.length*colW;
    const startX = (svgW-totalW)/2 + colW/2;
    ids.forEach((cid,i)=>{
      positions[cid] = {x: startX+i*colW, y};
    });
  }

  // Draw edges (from parent layer to child layer)
  for(const cid of sortedChain){
    const preqs = getPrerequisites(cid).filter(id=>sortedChain.includes(id));
    for(const p of preqs){
      const from = positions[p], to = positions[cid];
      if(!from||!to) continue;
      svg += `<line x1="${from.x}" y1="${from.y+nodeH/2}" x2="${to.x}" y2="${to.y-nodeH/2}" stroke="#ccc" stroke-width="1" stroke-dasharray="4,2"/>`;
    }
  }

  // Draw nodes
  for(const cid of sortedChain){
    const pos = positions[cid];
    if(!pos) continue;
    const c = COURSE_MAP[cid];
    const color = c ? c.color : '#888';
    const isSel = selIds.has(cid);
    const bg = isSel ? '#7c5cfc' : color;
    const stroke = isSel ? '#5a3ce0' : darkenHex(bg, 0.4);
    const ocwUrl = `https://ocw.mit.edu/search/?q=${encodeURIComponent(cid)}`;
    svg += `<a href="${ocwUrl}" target="_blank"><rect x="${pos.x-nodeW/2}" y="${pos.y-nodeH/2}" width="${nodeW}" height="${nodeH}" rx="4" fill="${bg}" stroke="${stroke}" stroke-width="${isSel?2:1}"/><text x="${pos.x}" y="${pos.y+4}" text-anchor="middle" fill="#fff" font-size="9" font-weight="${isSel?'700':'500'}">${cid}</text></a>`;
  }

  svg += `</svg></div>`;

  return svg;
}

// ========== FILTERS TOGGLE ==========
let filtersExpanded = false;
btnToggleFilters.addEventListener('click', ()=>{
  filtersExpanded = !filtersExpanded;
  if(filtersExpanded){
    advancedFilters.style.maxHeight = '340px';
    filtersToggleIcon.textContent = '▾';
    btnToggleFilters.style.borderColor = 'var(--accent)';
    btnToggleFilters.style.color = 'var(--accent)';
  } else {
    advancedFilters.style.maxHeight = '0';
    filtersToggleIcon.textContent = '▸';
    btnToggleFilters.style.borderColor = 'var(--border)';
    btnToggleFilters.style.color = 'var(--text2)';
  }
});

// ========== CONTROLS ==========
document.getElementById('btn-zoom-in').addEventListener('click',()=>{svg.transition().duration(200).call(zoom.scaleBy,1.3);});
document.getElementById('btn-zoom-out').addEventListener('click',()=>{svg.transition().duration(200).call(zoom.scaleBy,0.77);});
document.getElementById('btn-reset').addEventListener('click',()=>{svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity);});
document.getElementById('btn-fit').addEventListener('click',()=>{
  const b = g.node().getBBox();
  if(!b.width) return;
  const pad = 60, scale = Math.min(W()/(b.width+pad*2),H()/(b.height+pad*2),2);
  svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity.translate(W()/2-scale*(b.x+b.width/2),H()/2-scale*(b.y+b.height/2)).scale(scale));
});

// ========== SAVE PLAN BUTTON ==========
const btnSavePlan = document.getElementById('btn-save-plan');
btnSavePlan.addEventListener('click', ()=>{
  const name = prompt('Plan name:', 'My Plan');
  if(name && name.trim()) savePlanToStorage(name.trim());
});

// ========== FILE EXPORT / IMPORT ==========
document.getElementById('btn-file-save').addEventListener('click', ()=>{
  const plans = getSavedPlans();
  const data = JSON.stringify(plans, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mit-ocw-plans-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-file-load').addEventListener('click', ()=>{
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.addEventListener('change', ()=>{
    const file = inp.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try {
        const plans = JSON.parse(reader.result);
        if(!Array.isArray(plans)) throw new Error('Invalid format');
        // Validate structure
        for(const p of plans){
          if(!p.name || !Array.isArray(p.courses)) throw new Error('Invalid plan structure');
        }
        if(confirm(`Load ${plans.length} plan(s) from file? This will replace all current saved plans.`)){
          localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(plans));
          updateSavedPlansUI();
        }
      } catch(e){
        alert('Invalid plan file format.');
      }
    };
    reader.readAsText(file);
  });
  inp.click();
});

// ========== INIT ==========
updateSavedPlansUI();
buildDeptFilters();
buildLevelFilters();
buildFeatureFilters();
buildPathOptions();
refresh();
setTimeout(()=>{loadingEl.style.display='none';svg.transition().duration(600).call(zoom.transform,d3.zoomIdentity.translate(W()/2,H()/2).scale(0.6));},500);

// Handle resize
window.addEventListener('resize',()=>{svg.attr('width','100%').attr('height','100%');});
})();