
const JOURNEY_JSON_PATH = './hypertension_journey_v2.json';
let journeyData = [];
let journeyMeta = {};
let currentIndex = 0;
let completedNodes = new Set();

async function loadJourneyData() {
  const res = await fetch(JOURNEY_JSON_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load journey data');
  const payload = await res.json();
  journeyMeta = payload;
  journeyData = payload.nodes || [];
  document.getElementById('journeyTitle').textContent = payload.title || 'Topic Journey';
  document.getElementById('journeySubtitle').textContent = payload.subtitle || 'Learning Journey';
  document.getElementById('journeyDescription').textContent = payload.description || '';
}

function init() {
  renderNodes();
  updateProgress();
  drawPath();
  animateEntrance();
}

function resolvePosition(node, index) {
  if (['boss', 'finish', 'start', 'formula'].includes(node.type)) return 'center';
  return index % 2 === 0 ? 'left' : 'right';
}

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
    nodeEl.classList.add(`node-${position}`);

    nodeEl.innerHTML = `
      <div class="node-circle">
        <span style="font-size:1.25rem;">${node.icon || '•'}</span>
        <div class="node-number">${index + 1}</div>
      </div>
      <div class="node-label">${escapeHtml(node.title)}</div>
    `;
    nodeEl.addEventListener('click', () => handleNodeClick(index));
    container.appendChild(nodeEl);
  });
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
  const progress = completedNodes.size / Math.max(1, (journeyData.length - 1));
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
    setTimeout(() => node.style.animation = 'shake 0.5s ease', 10);
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

function renderSimpleBullets(content) {
  const bullets = content?.bullets || [];
  return `
    <div class="panel-section">
      <div class="panel-section-title">Key Concepts</div>
      <ul class="bullet-list">
        ${bullets.map(b => `<li class="bullet-item">${escapeHtml(b)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderDrugClassCard(content) {
  const snapshot = content?.snapshot ? `
    <div class="snapshot-card">
      <div class="panel-section-title">Drug Snapshot</div>
      <p class="snapshot-text">${escapeHtml(content.snapshot)}</p>
    </div>
  ` : '';
  const sections = (content?.sections || []).map(section => {
    if (section.value && !section.items) {
      return `
        <div class="section-card">
          <div class="section-label">${escapeHtml(section.label)}</div>
          <div class="section-value">${escapeHtml(section.value)}</div>
        </div>
      `;
    }
    return `
      <div class="section-card">
        <div class="section-label">${escapeHtml(section.label)}</div>
        <ul class="mini-list">
          ${(section.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    `;
  }).join('');
  return `<div class="content-grid">${snapshot}${sections}</div>`;
}

function renderComparisonSplit(content) {
  return `
    <div class="compare-grid">
      <div class="compare-card">
        <div class="compare-title">${escapeHtml(content?.left?.title || '')}</div>
        <ul class="mini-list">
          ${(content?.left?.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
      <div class="compare-card">
        <div class="compare-title">${escapeHtml(content?.right?.title || '')}</div>
        <ul class="mini-list">
          ${(content?.right?.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderStepLadder(content) {
  return `
    <div class="ladder-wrap">
      ${(content?.steps || []).map((step, idx) => `
        <div class="ladder-step">
          <div class="ladder-index">${idx + 1}</div>
          <div class="ladder-body">
            <div class="ladder-title">${escapeHtml(step.title)}</div>
            <div class="ladder-value">${escapeHtml(step.value)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMonitoringGrid(content) {
  return `
    <div class="monitor-grid">
      ${(content?.groups || []).map(group => `
        <div class="monitor-card">
          <div class="monitor-label">${escapeHtml(group.label)}</div>
          <ul class="mini-list">
            ${(group.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

function renderFormulaBlock(content) {
  return `
    <div class="formula-wrap">
      ${(content?.formulas || []).map(formula => `<div class="formula-card">${escapeHtml(formula)}</div>`).join('')}
      <div class="formula-notes">
        ${(content?.notes || []).map(note => `<div class="formula-note">${escapeHtml(note)}</div>`).join('')}
      </div>
    </div>
  `;
}

function renderPearlCards(content) {
  return `
    <div class="pearl-grid">
      ${(content?.cards || []).map(card => `<div class="pearl-card">${escapeHtml(card)}</div>`).join('')}
    </div>
  `;
}

function renderContentByStyle(node) {
  const style = node.contentStyle || 'simple_bullets';
  const content = node.content || {};
  switch (style) {
    case 'drug_class_card': return renderDrugClassCard(content);
    case 'comparison_split': return renderComparisonSplit(content);
    case 'step_ladder': return renderStepLadder(content);
    case 'monitoring_grid': return renderMonitoringGrid(content);
    case 'formula_block': return renderFormulaBlock(content);
    case 'pearl_cards': return renderPearlCards(content);
    case 'simple_bullets':
    default: return renderSimpleBullets(content);
  }
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
    <div class="dynamic-content">${renderContentByStyle(node)}</div>
    ${node.hint ? `
      <div class="memory-hint">
        <div class="memory-hint-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Memory Anchor
        </div>
        <div class="memory-hint-text">${escapeHtml(node.hint)}</div>
      </div>
    ` : ''}
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
}

function closePanel() {
  document.getElementById('contentPanel').classList.remove('active');
}

function continueJourney() {
  if (currentIndex < journeyData.length - 1) {
    completedNodes.add(currentIndex);
    currentIndex++;
    renderNodes();
    updateProgress();
    drawPath();
    closePanel();
    setTimeout(() => openPanel(currentIndex), 400);
  }
}

function completeJourney() {
  completedNodes.add(currentIndex);
  updateProgress();
  closePanel();
  const preview = document.getElementById('completionMapPreview');
  preview.innerHTML = journeyData.map((node, i) => {
    const isDone = completedNodes.has(i) || i <= currentIndex;
    return `<span class="mini-node" style="${!isDone ? 'opacity:0.3; border-color:#334155; background:#1e293b; color:#475569;' : ''}">${i + 1}</span>`;
  }).join('');
  document.getElementById('completionOverlay').classList.add('active');
}

function restartJourney() {
  currentIndex = 0;
  completedNodes.clear();
  document.getElementById('completionOverlay').classList.remove('active');
  renderNodes();
  updateProgress();
  drawPath();
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
  document.querySelectorAll('.node').forEach((node, index) => {
    node.style.animationDelay = `${index * 0.08}s`;
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(drawPath, 100);
});

const style = document.createElement('style');
style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)} }`;
document.head.appendChild(style);

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadJourneyData();
    init();
    setTimeout(() => openPanel(0), 800);
  } catch (e) {
    console.error(e);
    document.getElementById('nodesContainer').innerHTML = '<div style="color:#fca5a5;padding:24px;background:#1f2937;border-radius:16px;">Failed to load journey data.</div>';
  }
});
