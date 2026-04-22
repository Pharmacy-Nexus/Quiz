const STORAGE_KEY = 'pn_journey_hypertension_demo';
const typeTone = {
  start: 'from-[#0a2630] to-[#114050]',
  core: 'from-[#0d3440] to-[#1a5669]',
  checkpoint: 'from-[#6b5307] to-[#9c7a08]',
  split: 'from-[#2c3e66] to-[#455f94]',
  branch: 'from-[#0f4957] to-[#16697c]',
  boss: 'from-[#7f1e1e] to-[#b13b3b]',
  formula: 'from-[#062f3a] to-[#143844]',
  ladder: 'from-[#755f00] to-[#c89d12]',
  pearl: 'from-[#47308f] to-[#6a57b8]',
  finish: 'from-[#11452b] to-[#1f7b4c]'
};

const app = {
  data: null,
  completed: [],
  currentIndex: 0,
};

function $(id) { return document.getElementById(id); }

async function loadData() {
  const res = await fetch('hypertension_journey_map.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load journey map JSON');
  return res.json();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: app.completed, currentIndex: app.currentIndex }));
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    app.completed = Array.isArray(raw.completed) ? raw.completed : [];
    app.currentIndex = Number.isInteger(raw.currentIndex) ? raw.currentIndex : 0;
  } catch {
    app.completed = [];
    app.currentIndex = 0;
  }
}

function resetJourney() {
  app.completed = [];
  app.currentIndex = 0;
  saveState();
  renderAll();
}
window.resetJourney = resetJourney;

function isCompleted(index) {
  return app.completed.includes(index);
}

function isUnlocked(index) {
  return index === 0 || isCompleted(index) || isCompleted(index - 1) || index <= app.currentIndex;
}

function getProgressPercent() {
  const totalPlayable = app.data.nodes.length - 1;
  const done = app.completed.length;
  return Math.max(0, Math.min(100, Math.round((done / totalPlayable) * 100)));
}

function getCurrentNode() {
  return app.data.nodes[app.currentIndex] || app.data.nodes[0];
}

function openNode(index) {
  if (!isUnlocked(index)) return;
  app.currentIndex = index;
  saveState();
  renderAll();
}
window.openNode = openNode;

function completeCurrentNode() {
  const idx = app.currentIndex;
  if (!app.completed.includes(idx)) app.completed.push(idx);
  if (idx < app.data.nodes.length - 1) app.currentIndex = idx + 1;
  saveState();
  renderAll();
}
window.completeCurrentNode = completeCurrentNode;

function renderHeader() {
  $('journey-title').textContent = app.data.title;
  $('journey-subtitle').textContent = app.data.subtitle;
  $('journey-description').textContent = app.data.description;
  $('journey-progress-text').textContent = `${app.completed.length} / ${app.data.nodes.length - 1} stages completed`;
  $('journey-progress-bar').style.width = `${getProgressPercent()}%`;
}

function nodeBadge(type) {
  return `<span class="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] font-black text-white/80">${type}</span>`;
}

function renderPanel() {
  const node = getCurrentNode();
  const tone = typeTone[node.type] || typeTone.core;
  $('panel-shell').innerHTML = `
    <div class="rounded-[2rem] border border-white/10 bg-gradient-to-br ${tone} p-6 md:p-7 text-white shadow-[0_26px_65px_rgba(0,21,27,0.22)] journey-panel-in">
      <div class="flex items-start justify-between gap-4 mb-5">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] font-black text-white/65 mb-2">Current Stop</p>
          <h2 class="text-2xl md:text-4xl font-black tracking-tight leading-tight">${node.title}</h2>
        </div>
        ${nodeBadge(node.type)}
      </div>

      <p class="text-white/88 text-base md:text-lg leading-relaxed max-w-3xl">${node.summary}</p>

      <ul class="mt-6 grid gap-3">
        ${(node.bullets || []).map((bullet, i) => `
          <li class="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm md:text-base opacity-0 translate-y-2" style="animation: bulletIn .35s ease forwards; animation-delay:${90 * (i + 1)}ms">${bullet}</li>
        `).join('')}
      </ul>

      <div class="mt-6 rounded-3xl border border-white/10 bg-white/10 px-5 py-4">
        <p class="text-xs uppercase tracking-[0.2em] font-black text-white/65 mb-2">Memory Hint</p>
        <p class="text-sm md:text-base text-white/95">${node.memoryHint || ''}</p>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <button onclick="completeCurrentNode()" class="rounded-2xl bg-white text-slate-900 px-5 py-3 text-sm font-black hover:scale-[0.98] transition-transform">${node.type === 'finish' ? 'Replay Next Time' : 'Complete This Stop'}</button>
        <button onclick="showFullMap()" class="rounded-2xl border border-white/12 bg-white/10 px-5 py-3 text-sm font-black">Show Full Map</button>
      </div>
    </div>
  `;
}

function renderMap() {
  const nodes = app.data.nodes;
  $('journey-map').innerHTML = nodes.map((node, index) => {
    const completed = isCompleted(index);
    const unlocked = isUnlocked(index);
    const current = app.currentIndex === index;
    const sideClass = index % 2 === 0 ? 'justify-start pr-10 md:pr-16' : 'justify-end pl-10 md:pl-16';
    const bodyAlign = index % 2 === 0 ? 'items-start text-left' : 'items-end text-right';
    const stateClass = current
      ? 'ring-4 ring-amber-300/55 scale-[1.04]'
      : completed
        ? 'ring-2 ring-emerald-300/50'
        : unlocked
          ? 'hover:scale-[1.03] cursor-pointer'
          : 'opacity-45 saturate-50 cursor-not-allowed';
    const chip = completed ? '✓' : unlocked ? index + 1 : '🔒';
    const fill = current ? 'bg-white text-slate-900' : completed ? 'bg-emerald-300 text-emerald-950' : unlocked ? 'bg-[#0f3a45] text-white' : 'bg-slate-500 text-white';
    return `
      <div class="relative flex ${sideClass}">
        <button ${unlocked ? `onclick="openNode(${index})"` : ''} class="group relative w-[250px] md:w-[290px] rounded-[1.8rem] border border-white/10 bg-white/90 backdrop-blur-sm px-5 py-4 shadow-[0_18px_40px_rgba(0,21,27,0.08)] transition-all ${stateClass}">
          <div class="flex ${bodyAlign} gap-4">
            <div class="${fill} shrink-0 w-11 h-11 rounded-2xl inline-flex items-center justify-center text-sm font-black shadow-sm">${chip}</div>
            <div class="flex flex-col ${bodyAlign} min-w-0">
              <p class="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500 mb-1">${node.type}</p>
              <h3 class="text-lg font-black text-slate-900 leading-tight">${node.title}</h3>
              <p class="text-sm text-slate-600 leading-relaxed mt-1 line-clamp-2">${node.summary}</p>
            </div>
          </div>
          ${current ? '<div class="absolute -inset-1 rounded-[1.9rem] pointer-events-none border border-amber-300/35"></div>' : ''}
        </button>
      </div>
    `;
  }).join('');
}

function showFullMap() {
  $('fullmap-body').innerHTML = app.data.nodes.map((node, idx) => `
    <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div>
          <p class="text-[10px] uppercase tracking-[0.22em] font-black text-slate-500">${node.type}</p>
          <h3 class="text-lg font-black text-slate-900 mt-1">${idx + 1}. ${node.title}</h3>
        </div>
        <span class="rounded-full ${isCompleted(idx) ? 'bg-emerald-100 text-emerald-700' : isUnlocked(idx) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'} px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-black">${isCompleted(idx) ? 'Completed' : isUnlocked(idx) ? 'Open' : 'Locked'}</span>
      </div>
      <p class="text-sm text-slate-600 leading-relaxed">${node.summary}</p>
    </div>
  `).join('');
  $('fullmap-dialog').showModal();
}
window.showFullMap = showFullMap;
function closeFullMap() { $('fullmap-dialog').close(); }
window.closeFullMap = closeFullMap;

function renderAll() {
  renderHeader();
  renderMap();
  renderPanel();
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    app.data = await loadData();
    loadState();
    renderAll();
  } catch (err) {
    $('panel-shell').innerHTML = '<div class="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-800">Failed to load the Topic Journey demo.</div>';
    console.error(err);
  }
});
