
async function loadFlow() {
  const response = await fetch('hypertension_smart_flow.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to load flow JSON');
  return response.json();
}
const app = { flow: null, currentIndex: 0, autoplayTimer: null, autoplayMs: 3500 };
const typeTheme = {
  core: 'from-slate-950 to-[#113844] text-white border-white/10',
  branch: 'from-[#0e4352] to-[#1b5f70] text-white border-white/10',
  compare: 'from-[#6a5407] to-[#9a7b08] text-white border-white/10',
  warning: 'from-[#7a1f1f] to-[#b03232] text-white border-white/10',
  formula: 'from-[#062f3a] to-[#0a2630] text-white border-white/10',
  checklist: 'from-[#17333b] to-[#214850] text-white border-white/10',
  checkpoint: 'from-[#00313c] to-[#0b5566] text-white border-white/10',
  ladder: 'from-[#735c00] to-[#c39400] text-white border-white/10',
  pearl: 'from-[#2f2c5d] to-[#4c46a1] text-white border-white/10',
};
function $(id){ return document.getElementById(id); }
function renderHeader() {
  $('flow-title').textContent = app.flow.title;
  $('flow-subtitle').textContent = app.flow.subtitle;
  $('flow-description').textContent = app.flow.description;
}
function renderProgress() {
  const total = app.flow.nodes.length;
  const current = app.currentIndex + 1;
  $('flow-step').textContent = `Step ${current} of ${total}`;
  $('flow-progress').style.width = `${(current / total) * 100}%`;
}
function createBulletList(node) {
  return node.bullets.map((bullet, i) => `
    <li class="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm md:text-base backdrop-blur-sm opacity-0 translate-y-2"
        style="animation: bulletIn .35s ease forwards; animation-delay: ${120 * (i + 1)}ms">
      ${bullet}
    </li>
  `).join('');
}
function createTags(node) {
  if (!node.tags?.length) return '';
  return `<div class="mt-5 flex flex-wrap gap-2">
    ${node.tags.map(tag => `<span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.16em] uppercase border border-white/10">${tag}</span>`).join('')}
  </div>`;
}
function createCheckpoint(node) {
  if (!node.checkpoint) return '';
  return `<div class="mt-6 rounded-3xl bg-white/10 border border-white/10 p-5">
    <p class="text-xs uppercase tracking-[0.24em] text-white/70 font-black mb-2">Checkpoint</p>
    <p class="font-bold text-lg mb-4">${node.checkpoint.question}</p>
    <button onclick="revealCheckpoint()" class="rounded-2xl bg-white text-slate-900 px-4 py-2 text-sm font-black">Reveal Answer</button>
    <p id="checkpoint-answer" class="mt-4 hidden text-white/90 leading-relaxed">${node.checkpoint.answer}</p>
  </div>`;
}
function createFormula(node) {
  if (node.type !== 'formula') return '';
  return `<div class="mt-6 grid gap-3">
    ${node.bullets.map(line => `<div class="rounded-3xl border border-white/10 bg-white/10 px-5 py-4 text-center text-lg md:text-xl font-black tracking-tight">${line}</div>`).join('')}
  </div>`;
}
function renderNode() {
  const node = app.flow.nodes[app.currentIndex];
  const theme = typeTheme[node.type] || typeTheme.core;
  $('flow-node-shell').innerHTML = `
    <div class="rounded-[2rem] border bg-gradient-to-br ${theme} p-6 md:p-8 shadow-[0_24px_60px_rgba(0,21,27,0.18)]" style="animation: cardIn .42s ease;">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] font-black text-white/70 mb-2">${node.type}</p>
          <h2 class="text-2xl md:text-4xl font-black tracking-tight leading-tight">${node.title}</h2>
        </div>
        <button onclick="showMap()" class="rounded-2xl border border-white/12 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] font-black">Show Full Map</button>
      </div>
      <p class="text-base md:text-lg leading-relaxed text-white/90 max-w-3xl">${node.summary}</p>
      ${createFormula(node)}
      ${node.type !== 'formula' ? `<ul class="mt-6 grid gap-3">${createBulletList(node)}</ul>` : ''}
      ${createTags(node)}
      <div class="mt-6 rounded-3xl border border-white/10 bg-white/10 px-5 py-4">
        <p class="text-xs uppercase tracking-[0.22em] font-black text-white/70 mb-2">Memory Hint</p>
        <p class="text-sm md:text-base text-white/95">${node.memoryHint || 'No memory hint available.'}</p>
      </div>
      ${createCheckpoint(node)}
    </div>`;
}
function renderMiniMap() {
  const currentId = app.flow.nodes[app.currentIndex].id;
  $('mini-map').innerHTML = app.flow.nodes.map((node, idx) => `
    <button onclick="jumpToNode(${idx})" class="w-full text-left rounded-2xl px-4 py-3 border transition-all ${
      node.id === currentId ? 'bg-[#00151b] text-white border-[#00151b]' : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
    }">
      <div class="flex items-center gap-3">
        <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          node.id === currentId ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'
        } text-xs font-black">${idx + 1}</span>
        <div class="min-w-0">
          <p class="font-black text-sm truncate">${node.title}</p>
          <p class="text-[11px] uppercase tracking-[0.16em] ${node.id === currentId ? 'text-white/70' : 'text-slate-500'}">${node.type}</p>
        </div>
      </div>
    </button>
  `).join('');
}
function renderAll() {
  renderHeader();
  renderProgress();
  renderNode();
  renderMiniMap();
  $('prev-btn').disabled = app.currentIndex === 0;
  $('next-btn').disabled = app.currentIndex === app.flow.nodes.length - 1;
}
function nextNode() {
  if (app.currentIndex < app.flow.nodes.length - 1) { app.currentIndex += 1; renderAll(); }
  else { showMap(); stopAutoplay(); }
}
function prevNode() { if (app.currentIndex > 0) { app.currentIndex -= 1; renderAll(); } }
function jumpToNode(index) { app.currentIndex = index; renderAll(); }
function revealCheckpoint() { const el = $('checkpoint-answer'); if (el) el.classList.remove('hidden'); }
function showMap() {
  const body = $('map-body');
  body.innerHTML = app.flow.nodes.map((node, idx) => `
    <div class="relative rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="absolute -top-3 left-5 inline-flex rounded-full bg-slate-950 text-white px-3 py-1 text-[10px] uppercase tracking-[0.22em] font-black">${idx + 1}</div>
      <p class="text-xs uppercase tracking-[0.22em] text-slate-500 font-black mt-3">${node.type}</p>
      <h3 class="text-lg font-black text-slate-900 mt-1">${node.title}</h3>
      <p class="text-sm text-slate-600 leading-relaxed mt-2">${node.summary}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        ${(node.next || []).length ? node.next.map(nextId => `<span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">→ ${nextId}</span>`).join('') : `<span class="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">End</span>`}
      </div>
    </div>
  `).join('');
  $('map-dialog').showModal();
}
function closeMap(){ $('map-dialog').close(); }
function toggleAutoplay(){ if (app.autoplayTimer) stopAutoplay(); else startAutoplay(); }
function startAutoplay() {
  $('autoplay-btn').textContent = 'Pause';
  app.autoplayTimer = setInterval(() => {
    if (app.currentIndex >= app.flow.nodes.length - 1) { stopAutoplay(); showMap(); return; }
    nextNode();
  }, app.autoplayMs);
}
function stopAutoplay() {
  clearInterval(app.autoplayTimer);
  app.autoplayTimer = null;
  $('autoplay-btn').textContent = 'Autoplay';
}
window.nextNode = nextNode; window.prevNode = prevNode; window.jumpToNode = jumpToNode;
window.revealCheckpoint = revealCheckpoint; window.showMap = showMap; window.closeMap = closeMap; window.toggleAutoplay = toggleAutoplay;
window.addEventListener('DOMContentLoaded', async () => {
  try { app.flow = await loadFlow(); renderAll(); }
  catch (e) {
    $('flow-node-shell').innerHTML = '<div class="rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-800">Failed to load the Smart Flow demo.</div>';
    console.error(e);
  }
});
