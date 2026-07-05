// MIT OCW Knowledge Map - Interactive D3.js Force Graph
(function() {
'use strict';

// ========== STATE ==========
const state = {
  nodes: [],
  links: [],
  selectedNode: null,
  activeDepts: new Set(),
  searchQuery: '',
  path: null,
  hideLone: false,
  activeLevels: new Set(),
  activeFeatures: new Set(),
  activeSort: 'num',
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

// Arrows
defs.append('marker').attr('id','arrow').attr('viewBox','0 -5 10 10').attr('refX',16).attr('refY',0).attr('markerWidth',5).attr('markerHeight',5).attr('orient','auto').append('path').attr('d','M0,-5L10,0L0,5').attr('fill','#2a2a45');
defs.append('marker').attr('id','arrow-hl').attr('viewBox','0 -5 10 10').attr('refX',16).attr('refY',0).attr('markerWidth',5).attr('markerHeight',5).attr('orient','auto').append('path').attr('d','M0,-5L10,0L0,5').attr('fill','#7c5cfc');

const g = svg.append('g');
const zoom = d3.zoom().scaleExtent([0.08,5]).on('zoom',(e)=>{g.attr('transform',e.transform);});
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
  statSelected.textContent = state.selectedNode?1:0;

  // Links
  g.selectAll('.lg').data(gd.links).join('g').attr('class','lg').append('line')
    .attr('stroke','#2a2a45').attr('stroke-width',0.7).attr('stroke-opacity',0.5).attr('marker-end','url(#arrow)');

  // Nodes
  const ng = g.selectAll('.ng').data(gd.nodes).join('g').attr('class','ng').attr('cursor','pointer');
  ng.append('circle').attr('r',d=>d.radius).attr('fill',d=>d.color).attr('stroke',d=>d3.color(d.color).darker(0.5)).attr('stroke-width',1).attr('stroke-opacity',0.4).attr('opacity',0.85);
  ng.append('text').text(d=>d.id).attr('x',0).attr('y',-9).attr('text-anchor','middle').attr('fill','#7070a0').attr('font-size','7px').attr('font-family','JetBrains Mono,monospace').attr('pointer-events','none').attr('opacity',0.65);

  ng.on('mouseover',(ev,d)=>{
    if(state.selectedNode&&state.selectedNode.id===d.id) return;
    d3.select(ev.currentTarget).select('circle').transition().duration(120).attr('r',d.radius*2.2).attr('filter','url(#glow)').attr('opacity',1);
    const pre = getPrerequisites(d.id).filter(isAvailable);
    const unl = getUnlocks(d.id).filter(isAvailable);
    const [mx,my] = d3.pointer(ev,svg.node());
    tooltip.innerHTML = `<div style="font-family:JetBrains Mono,monospace;font-weight:700;color:var(--accent);font-size:13px;">${d.id}</div><div style="font-weight:600;margin:3px 0;">${d.title}</div><div style="font-size:10px;color:var(--text3);">${d.department}${d.level.length?' · '+d.level.join(', '):''}</div>${d.desc?`<div style="font-size:10px;color:var(--text2);margin-top:4px;line-height:1.4;">${d.desc.slice(0,140)}…</div>`:''}${pre.length?`<div style="font-size:10px;color:#ff6b6b;margin-top:3px;">⬆ ${pre.slice(0,4).join(', ')}${pre.length>4?' +'+(pre.length-4):''}</div>`:''}${unl.length?`<div style="font-size:10px;color:#51cf66;margin-top:2px;">⬇ ${unl.slice(0,4).join(', ')}${unl.length>4?' +'+(unl.length-4):''}</div>`:''}`;
    tooltip.style.display='block'; tooltip.style.left=(mx+14)+'px'; tooltip.style.top=(my+14)+'px';
  });
  ng.on('mouseout',(ev,d)=>{
    if(state.selectedNode&&state.selectedNode.id===d.id) return;
    d3.select(ev.currentTarget).select('circle').transition().duration(120).attr('r',d.radius).attr('filter',null).attr('opacity',0.85);
    tooltip.style.display='none';
  });
  ng.on('click',(ev,d)=>{ev.stopPropagation();selectNode(d);});
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

  if(state.selectedNode) highlight(state.selectedNode);
}

// ========== HIGHLIGHT ==========
function highlight(node){
  // Reset all
  g.selectAll('.ng circle').transition().duration(200).attr('opacity',0.85).attr('r',d=>d.radius).attr('filter',null).attr('stroke',d=>d3.color(d.color).darker(0.5)).attr('stroke-width',1).attr('stroke-opacity',0.4);
  g.selectAll('.ng text').transition().duration(200).attr('opacity',0.65);
  g.selectAll('.lg line').transition().duration(200).attr('stroke','#2a2a45').attr('stroke-width',0.7).attr('stroke-opacity',0.5).attr('marker-end','url(#arrow)');
  if(!node) return;

  const nid = node.id;
  const pre = getPrerequisites(nid).filter(id=>COURSE_MAP[id]);
  const unl = getUnlocks(nid).filter(id=>COURSE_MAP[id]);
  const chain = buildChain(nid); // full ancestor chain from root to selected
  const chainSet = new Set(chain);
  const rel = new Set([nid,...pre,...unl]);

  // Position index in chain for gradient coloring (0=root, last=selected)
  const chainPos = {};
  chain.forEach((id,i)=>{ chainPos[id] = i; });
  const chainLen = chain.length;

  // Node sizing and coloring
  g.selectAll('.ng circle').transition().duration(200)
    .attr('opacity',d=>{
      if(d.id===nid) return 1;
      if(chainSet.has(d.id)) return 1;
      if(unl.includes(d.id)) return 0.7;
      return 0.08;
    })
    .attr('r',d=>{
      if(d.id===nid) return d.radius*3;
      if(chainSet.has(d.id)) return d.radius*2;
      if(unl.includes(d.id)) return d.radius*1.4;
      return d.radius;
    })
    .attr('filter',d=>d.id===nid?'url(#glow)':null)
    .attr('stroke',d=>{
      if(d.id===nid) return '#fff';
      if(chainSet.has(d.id)){
        // Gradient from orange (root) to gold (mid) to white (near selected)
        const t = chainPos[d.id] / Math.max(chainLen-1,1);
        const r = Math.round(255*t + 100*(1-t));
        const g = Math.round(180*t + 80*(1-t));
        const b = Math.round(80*t + 40*(1-t));
        return `rgb(${r},${g},${b})`;
      }
      if(unl.includes(d.id)) return '#51cf66';
      return d3.color(d.color).darker(0.5);
    })
    .attr('stroke-width',d=>{
      if(d.id===nid) return 3.5;
      if(chainSet.has(d.id)) return 2.5;
      if(unl.includes(d.id)) return 2;
      return 1;
    }).attr('stroke-opacity',1);

  // Labels
  g.selectAll('.ng text').transition().duration(200)
    .attr('opacity',d=>rel.has(d.id)?1:0.05)
    .attr('font-weight',d=>d.id===nid?'700':chainSet.has(d.id)?'600':unl.includes(d.id)?'500':'400');

  // Edges - highlight chain path edges specially
  const chainEdges = new Set();
  for(let i=0; i<chain.length-1; i++){
    chainEdges.add(chain[i]+'→'+chain[i+1]);
  }

  g.selectAll('.lg line').transition().duration(200)
    .attr('stroke',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return '#ffa040'; // chain path edge
      if(d.source.id===nid||d.target.id===nid) return '#7c5cfc';
      if(d.source.id===nid&&unl.includes(d.target.id)) return '#51cf66';
      if(pre.includes(d.source.id)&&d.target.id===nid) return '#ff6b6b';
      return '#2a2a45';
    })
    .attr('stroke-width',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return 3;
      if(d.source.id===nid||d.target.id===nid) return 2.2;
      return 0.7;
    })
    .attr('stroke-opacity',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return 1;
      if(d.source.id===nid||d.target.id===nid) return 0.9;
      return 0.2;
    })
    .attr('marker-end',d=>{
      const key = d.source.id+'→'+d.target.id;
      if(chainEdges.has(key)) return 'url(#arrow-hl)';
      if(d.source.id===nid||d.target.id===nid) return 'url(#arrow-hl)';
      return 'url(#arrow)';
    });
}

function selectNode(node){
  state.selectedNode = node;
  highlight(node);
  updateDetail(node);
}

// ========== DETAIL PANEL ==========
function updateDetail(node){
  if(!node){courseDetail.innerHTML=`<div class="empty-state"><div class="icon">📚</div><div>Click a course node<br>to see details & prerequisites</div></div>`;statSelected.textContent='0';return;}
  statSelected.textContent='1';
  const pre = getPrerequisites(node.id).filter(isAvailable);
  const unl = getUnlocks(node.id).filter(isAvailable);
  const chain = buildChain(node.id);
  let h = `<div class="course-card"><div class="cnum">${node.id}</div><div class="ctitle">${node.title}</div><div class="cmeta"><span class="ctag dept">${node.department}</span>`;
  node.level.forEach(l=>{h+=`<span class="ctag level">${l}</span>`;});
  node.features.slice(0,3).forEach(f=>{h+=`<span class="ctag">${f}</span>`;});
  h+=`</div>${node.desc?`<div class="cdesc">${node.desc}</div>`:''}`;
  if(pre.length){h+=`<div class="prereq-section"><div class="prereq-title">⬆ Prerequisites (${pre.length})</div><div class="prereq-flow">`;pre.forEach(p=>{h+=`<span class="prereq-node" data-id="${p}">${p}</span>`;});h+=`</div></div>`;}
  if(unl.length){h+=`<div class="prereq-section"><div class="prereq-title">⬇ Unlocks (${unl.length})</div><div class="prereq-flow">`;unl.slice(0,20).forEach(u=>{h+=`<span class="prereq-node" data-id="${u}">${u}</span>`;});if(unl.length>20)h+=`<span class="prereq-node">+${unl.length-20} more</span>`;h+=`</div></div>`;}
  h+=`<div class="prereq-section"><div class="prereq-title">🧭 Full Chain</div><div class="prereq-flow">`;
  chain.forEach((id,i)=>{if(i>0)h+=`<span class="prereq-arrow">→</span>`;h+=`<span class="prereq-node" data-id="${id}" style="${id===node.id?'background:var(--accent);color:#fff':''}">${id}</span>`;});
  h+=`</div></div><div class="clinks">`;
  const ocwUrl = `https://ocw.mit.edu/search/?q=${encodeURIComponent(node.id)}`;
  h+=`<a class="clink" href="${ocwUrl}" target="_blank">OCW Search ↗</a></div></div>`;
  courseDetail.innerHTML = h;
  courseDetail.querySelectorAll('.prereq-node').forEach(el=>{el.addEventListener('click',()=>{const id=el.dataset.id;if(!id)return;const n=state.nodes.find(x=>x.id===id);if(n){selectNode(n);centerOnNode(n);}});});
}

function buildChain(cid,visited=new Set(),depth=0){
  if(visited.has(cid)||depth>8) return [cid];
  visited.add(cid);
  const pre = getPrerequisites(cid).filter(isAvailable).filter(p=>COURSE_MAP[p]);
  const all = [];
  for(const p of pre) all.push(...buildChain(p,visited,depth+1));
  all.push(cid); return [...new Set(all)];
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
}

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
  if(state.selectedNode){
    const found = gd.nodes.find(n=>n.id===state.selectedNode.id);
    if(found) selectNode(found); else selectNode(null);
  }
}

// ========== LONE NODE TOGGLE ==========
const loneToggle = document.getElementById('lone-toggle');
const loneCheck = document.getElementById('lone-check');
loneToggle.addEventListener('click',()=>{
  state.hideLone = !state.hideLone;
  if(state.hideLone){
    loneCheck.style.background = 'var(--accent)';
    loneCheck.firstElementChild.style.left = '16px';
    loneCheck.firstElementChild.style.background = '#fff';
  } else {
    loneCheck.style.background = 'var(--surface3)';
    loneCheck.firstElementChild.style.left = '2px';
    loneCheck.firstElementChild.style.background = 'var(--text3)';
  }
  refresh();
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

// ========== INIT ==========
buildDeptFilters();
buildLevelFilters();
buildFeatureFilters();
buildPathOptions();
refresh();
setTimeout(()=>{loadingEl.style.display='none';svg.transition().duration(600).call(zoom.transform,d3.zoomIdentity.translate(W()/2,H()/2).scale(0.6));},500);

// Handle resize
window.addEventListener('resize',()=>{svg.attr('width','100%').attr('height','100%');});
})();