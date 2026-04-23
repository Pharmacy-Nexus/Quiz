
const JOURNEY_JSON_PATH = './hypertension_journey_data.json';
let journeyData = [];
let currentIndex = 0;
let completedNodes = new Set();
let isPanelOpen = false;
async function loadJourneyData() {
  const res = await fetch(JOURNEY_JSON_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load journey data');
  const payload = await res.json();
  journeyData = payload.nodes || [];
  document.getElementById('journeyTitle').textContent = payload.title || 'Topic Journey';
  document.getElementById('journeySubtitle').textContent = payload.subtitle || 'Learning Journey';
  document.getElementById('journeyDescription').textContent = payload.description || '';
}
function init() { renderNodes(); updateProgress(); drawPath(); animateEntrance(); }
function renderNodes() {
  const container = document.getElementById('nodesContainer');
  container.innerHTML = '';
  journeyData.forEach((node, index) => {
    const nodeEl = document.createElement('div');
    nodeEl.className = `node node-type-${node.type}`;
    nodeEl.dataset.index = index;
    if (index === currentIndex) nodeEl.classList.add('node-current');
    else if (completedNodes.has(index)) nodeEl.classList.add('node-completed');
    else if (index < currentIndex || index === 0) nodeEl.classList.add('node-unlocked');
    else nodeEl.classList.add('node-locked');
    const position = resolvePosition(node, index);
    if (position === 'left') nodeEl.classList.add('node-left');
    else if (position === 'right') nodeEl.classList.add('node-right');
    else nodeEl.classList.add('node-center');
    nodeEl.innerHTML = `<div class="node-circle"><span style="font-size:1.25rem;">${node.icon || '•'}</span><div class="node-number">${index + 1}</div></div><div class="node-label">${escapeHtml(node.title)}</div>`;
    nodeEl.addEventListener('click', () => handleNodeClick(index));
    container.appendChild(nodeEl);
  });
}
function resolvePosition(node, index) {
  if (['boss','finish','start','formula'].includes(node.type)) return 'center';
  return index % 2 === 0 ? 'left' : 'right';
}
function drawPath() {
  const nodes = document.querySelectorAll('.node');
  if (!nodes.length) return;
  const containerRect = document.getElementById('journeyContainer').getBoundingClientRect();
  const points = [];
  nodes.forEach((node) => {
    const circle = node.querySelector('.node-circle');
    const rect = circle.getBoundingClientRect();
    points.push({ x: rect.left + rect.width / 2 - containerRect.left, y: rect.top + rect.height / 2 - containerRect.top });
  });
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i], next = points[i + 1], midY = (curr.y + next.y) / 2;
    if (Math.abs(curr.x - next.x) < 8) d += ` L ${next.x} ${next.y}`;
    else d += ` C ${curr.x} ${midY - 20}, ${next.x} ${midY - 20}, ${next.x} ${next.y}`;
  }
  document.getElementById('pathLine').setAttribute('d', d);
  document.getElementById('pathLineActive').setAttribute('d', d);
  const progress = completedNodes.size / Math.max(1, journeyData.length - 1);
  const activePath = document.getElementById('pathLineActive');
  const length = activePath.getTotalLength();
  activePath.style.strokeDasharray = length;
  activePath.style.strokeDashoffset = length * (1 - progress);
}
function handleNodeClick(index) {
  if (index > currentIndex && !completedNodes.has(index)) {
    const node = document.querySelector(`[data-index="${index}"]`);
    if (!node) return;
    node.style.animation = 'none';
    setTimeout(() => { node.style.animation = 'shake 0.5s ease'; }, 10);
    return;
  }
  openPanel(index);
}
function getBadgeClass(type) {
  return {
    core:'panel-type-core', branch:'panel-type-branch', checkpoint:'panel-type-checkpoint',
    boss:'panel-type-boss', formula:'panel-type-formula', pearl:'panel-type-pearl',
    finish:'panel-type-finish', start:'panel-type-core'
  }[type] || 'panel-type-core';
}
function openPanel(index) {
  const node = journeyData[index];
  const content = document.getElementById('panelContent');
  const continueBtn = document.getElementById('continueBtn');
  const isLast = index === journeyData.length - 1;
  const isCurrent = index === currentIndex;
  content.innerHTML = `
    <div class="panel-header">
      <div class="panel-type-badge ${getBadgeClass(node.type)}">${escapeHtml(node.type)}</div>
      <h2 class="panel-title">${escapeHtml(node.title)}</h2>
      <p class="panel-summary">${escapeHtml(node.summary)}</p>
    </div>
    <div class="panel-section">
      <div class="panel-section-title">Key Concepts</div>
      <ul class="bullet-list">${(node.bullets || []).map(b => `<li class="bullet-item">${escapeHtml(b)}</li>`).join('')}</ul>
    </div>
    ${node.hint ? `<div class="memory-hint"><div class="memory-hint-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Memory Anchor</div><div class="memory-hint-text">${escapeHtml(node.hint)}</div></div>` : ''}
  `;
  if (isLast) {
    continueBtn.innerHTML = `Complete Journey <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
    continueBtn.onclick = completeJourney;
  } else if (isCurrent) {
    continueBtn.innerHTML = `Continue Journey <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    continueBtn.onclick = continueJourney;
  } else if (completedNodes.has(index)) {
    continueBtn.innerHTML = `Review Complete <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
    continueBtn.onclick = closePanel;
  } else {
    continueBtn.innerHTML = `Continue Journey <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    continueBtn.onclick = continueJourney;
  }
  document.getElementById('contentPanel').classList.add('active');
  isPanelOpen = true;
}
function closePanel() { document.getElementById('contentPanel').classList.remove('active'); isPanelOpen = false; }
function continueJourney() {
  if (currentIndex < journeyData.length - 1) {
    completedNodes.add(currentIndex);
    currentIndex++;
    renderNodes(); updateProgress(); drawPath(); closePanel();
    setTimeout(() => openPanel(currentIndex), 400);
  }
}
function completeJourney() {
  completedNodes.add(currentIndex); updateProgress(); closePanel();
  const preview = document.getElementById('completionMapPreview');
  preview.innerHTML = journeyData.map((node, i) => {
    const isDone = completedNodes.has(i) || i <= currentIndex;
    return `<span class="mini-node" style="${!isDone ? 'opacity:0.3; border-color:#334155; background:#1e293b; color:#475569;' : ''}">${i + 1}</span>`;
  }).join('');
  document.getElementById('completionOverlay').classList.add('active');
}
function restartJourney() {
  currentIndex = 0; completedNodes.clear();
  document.getElementById('completionOverlay').classList.remove('active');
  renderNodes(); updateProgress(); drawPath();
  setTimeout(() => openPanel(0), 300);
}
window.restartJourney = restartJourney;
function updateProgress() {
  const total = journeyData.length;
  const completed = completedNodes.size + (currentIndex > 0 ? 1 : 0);
  const percent = Math.round((completed / total) * 100);
  document.getElementById('progressBar').style.width = percent + '%';
  document.getElementById('progressText').textContent = percent + '% Complete';
}
function animateEntrance() {
  document.querySelectorAll('.node').forEach((node, index) => { node.style.animationDelay = `${index * 0.08}s`; });
}
function escapeHtml(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
let resizeTimeout;
window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(drawPath, 100); });
const style = document.createElement('style');
style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)} }`;
document.head.appendChild(style);
window.addEventListener('DOMContentLoaded', async () => {
  try { await loadJourneyData(); init(); setTimeout(() => openPanel(0), 800); }
  catch (e) { console.error(e); document.getElementById('nodesContainer').innerHTML = '<div style="color:#fca5a5;padding:24px;background:#1f2937;border-radius:16px;">Failed to load journey data.</div>'; }
});
