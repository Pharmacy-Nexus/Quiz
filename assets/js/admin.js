const SESSION_KEY = 'pnAdminSession';
const DATA_ROOT = (window.PN_ADMIN_CONFIG && window.PN_ADMIN_CONFIG.dataRoot) || 'data';
const ADMIN_PASSWORD = (window.PN_ADMIN_CONFIG && window.PN_ADMIN_CONFIG.adminPassword) || 'changeme';

let session = loadSession();
let subjectsIndex = { updatedAt: new Date().toISOString(), subjects: [] };
let currentQuestions = [];
let currentTopicFileSha = null;
let currentEditingQuestionId = '';
let currentQuestionsDraftMode = false;
let currentTopicJsonDraft = null;

function $(id) { return document.getElementById(id); }
function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'); } catch { return {}; }
}
function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function setMsg(id, text, ok = true) {
  const el = $(id); if (!el) return;
  el.textContent = text;
  el.className = `text-sm font-bold ${ok ? 'text-emerald-700' : 'text-red-700'}`;
}
function decodeBase64Unicode(str) { return decodeURIComponent(escape(atob(str))); }
function encodeBase64Unicode(str) { return btoa(unescape(encodeURIComponent(str))); }
function requireSession() {
  if (!session.owner || !session.repo || !session.branch || !session.token) {
    throw new Error('Save the GitHub session first.');
  }
}
function nowIso() { return new Date().toISOString(); }
function emptyTopicMeta(id, name, description = '', order = 1, file = '', section = '') {
  return {
    id, name, description, order, section,
    difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
    questionsCount: 0,
    file
  };
}
function normalizeQuestion(raw, fallbackId = '') {
  const type = raw.type || 'mcq';
  const difficulty = ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium';
  let options = Array.isArray(raw.options) ? raw.options.map(v => String(v ?? '').trim()).filter(Boolean) : [];
  if (type === 'true_false') options = ['True', 'False'];
  if (!options.length && (type === 'case' || type === 'image')) {
    throw new Error('Case/Image questions still need options.');
  }
  if (!options.length) throw new Error('Question options are required.');
  let correctAnswer = Number(raw.correctAnswer);
  if (Number.isNaN(correctAnswer)) throw new Error('correctAnswer is required.');
  if (correctAnswer >= 1) correctAnswer -= 1; // allow 1-based input
  if (correctAnswer < 0 || correctAnswer >= options.length) throw new Error('correctAnswer is out of range.');
  const questionText = String(raw.questionText || '').trim();
  const explanation = String(raw.explanation || '').trim();
  if (!questionText || !explanation) throw new Error('questionText and explanation are required.');
  return {
    id: raw.id || fallbackId,
    type,
    difficulty,
    questionText,
    options,
    correctAnswer,
    explanation,
    summary: String(raw.summary || '').trim(),
    caseText: String(raw.caseText || '').trim(),
    imageUrl: String(raw.imageUrl || '').trim()
  };
}
function recomputeTopicMetaFromQuestions(topicMeta, questions) {
  const breakdown = { easy: 0, medium: 0, hard: 0 };
  (questions || []).forEach(q => { breakdown[q.difficulty] = (breakdown[q.difficulty] || 0) + 1; });
  topicMeta.questionsCount = questions.length;
  topicMeta.difficultyBreakdown = breakdown;
  return topicMeta;
}
function fillConnectionInputs() {
  $('repo-owner').value = session.owner || '';
  $('repo-name').value = session.repo || '';
  $('repo-branch').value = session.branch || 'main';
  $('github-token').value = session.token || '';
}
async function gh(path, options = {}) {
  requireSession();
  const url = `${window.PN_ADMIN_CONFIG.githubApiBase}/repos/${session.owner}/${session.repo}/contents/${path}`;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${session.token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    let detail = '';
    try { const data = await res.json(); detail = data.message || ''; } catch {}
    throw new Error(detail || `GitHub request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}
async function getRepoFile(path) {
  const file = await gh(path);
  const raw = decodeBase64Unicode((file.content || '').replace(/\n/g, ''));
  return { sha: file.sha, json: JSON.parse(raw), raw };
}
async function putRepoJson(path, contentObject, message, sha) {
  const body = {
    message,
    content: encodeBase64Unicode(JSON.stringify(contentObject, null, 2)),
    branch: session.branch
  };
  if (sha) body.sha = sha;
  return gh(path, { method: 'PUT', body: JSON.stringify(body) });
}
async function deleteRepoFile(path, sha, message) {
  const body = { message, sha, branch: session.branch };
  return gh(path, { method: 'DELETE', body: JSON.stringify(body) });
}
async function bootstrapData() {
  try {
    requireSession();

    const file = await getRepoFile(`${DATA_ROOT}/index.json`);
    const rawSubjects = Array.isArray(file.json.subjects) ? file.json.subjects : [];
    const validSubjects = [];

    for (const subject of rawSubjects) {
      try {
        const meta = await getSubjectFile(subject.id);
        if (meta?.json) validSubjects.push(subject);
      } catch {
        // تجاهل المواد القديمة أو المكسورة
      }
    }

    subjectsIndex = {
      ...file.json,
      subjects: validSubjects.sort((a, b) => (a.order || 999) - (b.order || 999))
    };

    renderSubjectOptions();
    await loadTopicsForQuestionSubject();
    await syncTopicSelectors();
  } catch (e) {
    setMsg('connection-message', e.message, false);
  }
}

function renderSubjectOptions() {
  const html =
    '<option value="">Select subject</option>' +
    (subjectsIndex?.subjects || [])
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join('');

  ['topic-subject-select', 'question-subject-select', 'bulk-subject-select'].forEach(id => {
    if ($(id)) $(id).innerHTML = html;
  });
}
async function getSubjectFile(subjectId) {
  return getRepoFile(`${DATA_ROOT}/${subjectId}/meta.json`);
}

async function getTopicFile(subjectId, topicId) {
  return getRepoFile(`${DATA_ROOT}/${subjectId}/${topicId}.json`);
}

async function syncSubjectAndIndex(subjectId) {
  const subjectFile = await getSubjectFile(subjectId);
  let totalQuestions = 0;

  for (const topic of (subjectFile.json.topics || [])) {
    try {
      const topicFile = await getTopicFile(subjectId, topic.id);
      recomputeTopicMetaFromQuestions(topic, topicFile.json.questions || []);
      topic.file = `${DATA_ROOT}/${subjectId}/${topic.id}.json`;
      totalQuestions += topic.questionsCount || 0;
    } catch (e) {
      topic.file = `${DATA_ROOT}/${subjectId}/${topic.id}.json`;
      topic.questionsCount = topic.questionsCount || 0;
    }
  }

  subjectFile.json.updatedAt = nowIso();

  await putRepoJson(
    `${DATA_ROOT}/${subjectId}/meta.json`,
    subjectFile.json,
    `Sync subject metadata: ${subjectId}`,
    subjectFile.sha
  );

  const indexFile = await getRepoFile(`${DATA_ROOT}/index.json`);
  const entry = (indexFile.json.subjects || []).find(s => s.id === subjectId);

  if (entry) {
    entry.topicsCount = (subjectFile.json.topics || []).length;
    entry.questionsCount = totalQuestions;
    entry.file = `${DATA_ROOT}/${subjectId}/meta.json`;

    const localMeta = (subjectsIndex?.subjects || []).find(s => s.id === subjectId);
    if (localMeta) {
      entry.name = localMeta.name || entry.name;
      entry.description = localMeta.description || entry.description;
      entry.icon = localMeta.icon || entry.icon;
      entry.order = localMeta.order ?? entry.order;
      entry.theme = localMeta.theme || entry.theme;
    }
  }

  indexFile.json.updatedAt = nowIso();

  await putRepoJson(
    `${DATA_ROOT}/index.json`,
    indexFile.json,
    `Sync index: ${subjectId}`,
    indexFile.sha
  );

  subjectsIndex = {
    ...indexFile.json,
    subjects: [...(indexFile.json.subjects || [])].sort((a, b) => (a.order || 999) - (b.order || 999))
  };
}
async function syncTopicSelectors() {
  const subjectId = $('topic-subject-select').value || $('question-subject-select').value || $('bulk-subject-select').value || '';
  if (!subjectId) {
    ['topic-edit-select', 'question-topic-select', 'bulk-topic-select'].forEach(id => { if ($(id)) $(id).innerHTML = '<option value="">Select topic</option>'; });
    return;
  }
  const subjectFile = await getSubjectFile(subjectId);
  const options = '<option value="">Select topic</option>' + (subjectFile.json.topics || [])
    .sort((a,b)=>(a.order||0)-(b.order||0))
    .map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  if ($('topic-subject-select').value === subjectId) $('topic-edit-select').innerHTML = options;
  if ($('question-subject-select').value === subjectId) $('question-topic-select').innerHTML = options;
  if ($('bulk-subject-select').value === subjectId) $('bulk-topic-select').innerHTML = options;
}
async function loadTopicsForQuestionSubject() {
  await syncTopicSelectors();
  const topicId = $('question-topic-select').value;
  if (!topicId) {
    currentQuestions = [];
    currentTopicFileSha = null;
    renderQuestionResults([]);
    return;
  }
  await loadQuestionList();
}
function resetTopicForm() {
  $('topic-edit-select').value = '';
  $('topic-name').value = '';
  $('topic-slug').value = '';
  if ($('topic-section')) $('topic-section').value = '';
  $('topic-order').value = '';
  $('topic-description').value = '';
}
function resetQuestionForm() {
  currentEditingQuestionId = '';
  $('question-id').value = '';
  $('question-type').value = 'mcq';
  $('question-difficulty').value = 'easy';
  $('question-text').value = '';
  $('question-case').value = '';
  $('question-image').value = '';
  $('option-1').value = '';
  $('option-2').value = '';
  $('option-3').value = '';
  $('option-4').value = '';
  $('correct-answer').value = '';
  $('question-explanation').value = '';
}
function buildQuestionFromForm(subjectId, topicId, fallbackId) {
  let options = [$('option-1').value.trim(), $('option-2').value.trim(), $('option-3').value.trim(), $('option-4').value.trim()].filter(Boolean);
  const type = $('question-type').value;
  if (type === 'true_false') options = ['True', 'False'];
  return normalizeQuestion({
    id: currentEditingQuestionId || fallbackId,
    type,
    difficulty: $('question-difficulty').value,
    questionText: $('question-text').value.trim(),
    options,
    correctAnswer: Number($('correct-answer').value),
    explanation: $('question-explanation').value.trim(),
    caseText: $('question-case').value.trim(),
    imageUrl: $('question-image').value.trim()
  }, fallbackId);
}
async function addSubject() {
  try {
    requireSession();
    const name = $('subject-name').value.trim();
    const id = slugify($('subject-slug').value || name);
    const description = $('subject-description').value.trim();
    const icon = $('subject-icon').value.trim() || 'science';
    const order = Number($('subject-order').value || ((subjectsIndex?.subjects?.length || 0) + 1));
    if (!name || !id) throw new Error('Subject name and slug are required.');
    if ((subjectsIndex.subjects || []).some(s => s.id === id)) throw new Error('Subject already exists.');

    const subjectData = { id, name, description, order, topics: [] };
    await putRepoJson(`${DATA_ROOT}/${id}/meta.json`, subjectData, `Create subject: ${name}`);

    const indexFile = await getRepoFile(`${DATA_ROOT}/index.json`);
    indexFile.json.updatedAt = nowIso();
    indexFile.json.subjects.push({ id, name, description, icon, theme: 'primary', order, topicsCount: 0, questionsCount: 0, file: `${DATA_ROOT}/${id}/meta.json` });
    await putRepoJson(`${DATA_ROOT}/index.json`, indexFile.json, `Add subject to index: ${name}`, indexFile.sha);
    subjectsIndex = indexFile.json;
    renderSubjectOptions();
    $('subject-name').value = '';
    $('subject-slug').value = '';
    $('subject-description').value = '';
    $('subject-order').value = '';
    $('subject-icon').value = '';
    setMsg('subject-message', `Subject created: ${name}`);
  } catch (e) {
    setMsg('subject-message', e.message, false);
  }
}
async function saveTopic() {
  try {
    requireSession();
    const subjectId = $('topic-subject-select').value;
    if (!subjectId) throw new Error('Select a subject first.');
    const selectedExistingId = $('topic-edit-select').value;
    const name = $('topic-name').value.trim();
    const id = slugify($('topic-slug').value || name || selectedExistingId);
    const description = $('topic-description').value.trim();
    const section = $('topic-section') ? $('topic-section').value.trim() : '';
    const order = Number($('topic-order').value || 1);
    if (!name || !id) throw new Error('Topic name and slug are required.');

    const subjectFile = await getSubjectFile(subjectId);
    const topics = subjectFile.json.topics || [];
    const editing = topics.find(t => t.id === selectedExistingId);

    if (!editing) {
      if (topics.some(t => t.id === id)) throw new Error('Topic already exists.');
      const topicPath = `${DATA_ROOT}/${subjectId}/${id}.json`;
      const topicData = { subjectId, topicId: id, topicName: name, updatedAt: nowIso(), questions: [] };
      await putRepoJson(topicPath, topicData, `Create topic: ${name}`);
      topics.push(emptyTopicMeta(id, name, description, order, topicPath, section));
      await putRepoJson(`${DATA_ROOT}/${subjectId}/meta.json`, subjectFile.json, `Add topic: ${name}`, subjectFile.sha);
      await syncSubjectAndIndex(subjectId);
      subjectsIndex.subjects = subjectsIndex.subjects.map(s => s.id === subjectId ? { ...s, topicsCount: topics.length } : s);
      setMsg('topic-message', `Topic created: ${name}`);
    } else {
      const originalId = editing.id;
      const originalPath = `${DATA_ROOT}/${subjectId}/${originalId}.json`;
      const newPath = `${DATA_ROOT}/${subjectId}/${id}.json`;
      const topicFile = await getTopicFile(subjectId, originalId);
      topicFile.json.topicId = id;
      topicFile.json.topicName = name;
      topicFile.json.updatedAt = nowIso();
      if (id !== originalId) {
        await putRepoJson(newPath, topicFile.json, `Rename topic: ${originalId} -> ${id}`);
        await deleteRepoFile(originalPath, topicFile.sha, `Delete old topic file: ${originalId}`);
      } else {
        await putRepoJson(originalPath, topicFile.json, `Update topic: ${name}`, topicFile.sha);
      }
      editing.id = id;
      editing.name = name;
      editing.description = description;
      editing.section = section;
      editing.order = order;
      editing.file = newPath;
      recomputeTopicMetaFromQuestions(editing, topicFile.json.questions || []);
      await putRepoJson(`${DATA_ROOT}/${subjectId}/meta.json`, subjectFile.json, `Update topic meta: ${name}`, subjectFile.sha);
      await syncSubjectAndIndex(subjectId);
      setMsg('topic-message', `Topic saved: ${name}`);
    }
    await bootstrapData();
    $('topic-subject-select').value = subjectId;
    await syncTopicSelectors();
    resetTopicForm();
  } catch (e) {
    setMsg('topic-message', e.message, false);
  }
}
async function loadTopicIntoForm() {
  try {
    const subjectId = $('topic-subject-select').value;
    const topicId = $('topic-edit-select').value;
    if (!subjectId || !topicId) { resetTopicForm(); return; }
    const subjectFile = await getSubjectFile(subjectId);
    const meta = (subjectFile.json.topics || []).find(t => t.id === topicId);
    if (!meta) return;
    $('topic-name').value = meta.name || '';
    $('topic-slug').value = meta.id || '';
    if ($('topic-section')) $('topic-section').value = meta.section || '';
    $('topic-order').value = meta.order ?? '';
    $('topic-description').value = meta.description || '';
  } catch (e) {
    setMsg('topic-message', e.message, false);
  }
}
async function deleteTopic() {
  try {
    requireSession();
    const subjectId = $('topic-subject-select').value;
    const topicId = $('topic-edit-select').value;
    if (!subjectId || !topicId) throw new Error('Select a topic to delete.');
    const subjectFile = await getSubjectFile(subjectId);
    const topicMeta = (subjectFile.json.topics || []).find(t => t.id === topicId);
    if (!topicMeta) throw new Error('Topic not found.');
    const topicFile = await getTopicFile(subjectId, topicId);
    await deleteRepoFile(`${DATA_ROOT}/${subjectId}/${topicId}.json`, topicFile.sha, `Delete topic: ${topicId}`);
    subjectFile.json.topics = (subjectFile.json.topics || []).filter(t => t.id !== topicId);
    await putRepoJson(`${DATA_ROOT}/${subjectId}/meta.json`, subjectFile.json, `Remove topic from subject: ${topicId}`, subjectFile.sha);
    await syncSubjectAndIndex(subjectId);
    await bootstrapData();
    $('topic-subject-select').value = subjectId;
    await syncTopicSelectors();
    resetTopicForm();
    setMsg('topic-message', `Topic deleted: ${topicMeta.name}`);
  } catch (e) {
    setMsg('topic-message', e.message, false);
  }
}
async function loadQuestionList() {
  try {
    const subjectId = $('question-subject-select').value;
    const topicId = $('question-topic-select').value;
    if (!subjectId || !topicId) {
      currentQuestions = [];
      currentTopicFileSha = null;
      renderQuestionResults([]);
      return;
    }
    const topicFile = await getTopicFile(subjectId, topicId);
    currentQuestions = topicFile.json.questions || [];
    currentTopicFileSha = topicFile.sha;
    currentTopicJsonDraft = topicFile.json;
    currentQuestionsDraftMode = false;
    renderQuestionResults(currentQuestions);
    setMsg('question-json-message', `Loaded ${currentQuestions.length} questions from selected topic JSON.`);
  } catch (e) {
    setMsg('question-message', e.message, false);
  }
}
function renderQuestionResults(items) {
  const box = $('question-results');
  if (!box) return;
  const total = currentQuestions.length || 0;
  if (!items.length) {
    box.innerHTML = `<div class="text-sm text-slate-500 p-3">No questions found. ${total ? 'Try another search term.' : 'Load or import a topic JSON first.'}</div>`;
    return;
  }
  box.innerHTML = items.map(q => {
    const correctIndex = Number(q.correctAnswer);
    const optionsHtml = (q.options || []).map((opt, idx) => `
      <span class="option-pill ${idx === correctIndex ? 'correct' : ''}">${idx + 1}. ${escapeHtml(opt)}</span>
    `).join('');
    return `
      <div class="result-item ${q.id === currentEditingQuestionId ? 'is-active' : ''}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs font-black uppercase tracking-widest text-slate-500">${escapeHtml(q.id || 'Question')}</div>
            <div class="font-black text-slate-900 mt-1 leading-snug">${escapeHtml((q.questionText || '').slice(0, 140))}${(q.questionText || '').length > 140 ? '…' : ''}</div>
            <div class="text-xs text-slate-500 mt-2">${escapeHtml(q.type || 'mcq')} • ${escapeHtml(q.difficulty || 'medium')} • Correct: ${Number.isInteger(correctIndex) ? correctIndex + 1 : '—'}</div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button class="mini-btn btn-ghost" data-edit-question="${escapeHtml(q.id)}">Edit</button>
            <button class="mini-btn btn-danger" data-delete-question="${escapeHtml(q.id)}">Delete</button>
          </div>
        </div>
        <div class="grid gap-2 mt-3">${optionsHtml}</div>
        ${q.explanation ? `<div class="mt-3 text-xs leading-5 text-slate-600"><strong>Explanation:</strong> ${escapeHtml((q.explanation || '').slice(0, 180))}${(q.explanation || '').length > 180 ? '…' : ''}</div>` : ''}
      </div>
    `;
  }).join('');
  box.querySelectorAll('[data-edit-question]').forEach(btn => btn.addEventListener('click', () => loadQuestionIntoForm(btn.dataset.editQuestion)));
  box.querySelectorAll('[data-delete-question]').forEach(btn => btn.addEventListener('click', () => deleteQuestion(btn.dataset.deleteQuestion)));
}
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function loadQuestionIntoForm(qid) {
  const q = currentQuestions.find(item => item.id === qid);
  if (!q) return;
  currentEditingQuestionId = q.id;
  $('question-id').value = q.id || '';
  $('question-type').value = q.type || 'mcq';
  $('question-difficulty').value = q.difficulty || 'easy';
  $('question-text').value = q.questionText || '';
  $('question-case').value = q.caseText || '';
  $('question-image').value = q.imageUrl || '';
  $('option-1').value = q.options?.[0] || '';
  $('option-2').value = q.options?.[1] || '';
  $('option-3').value = q.options?.[2] || '';
  $('option-4').value = q.options?.[3] || '';
  $('correct-answer').value = Number.isInteger(q.correctAnswer) ? q.correctAnswer + 1 : '';
  $('question-explanation').value = q.explanation || '';
}
function filterQuestionResults() {
  const term = $('question-search').value.trim().toLowerCase();
  if (!term) { renderQuestionResults(currentQuestions); return; }
  const filtered = currentQuestions.filter(q => {
    const haystack = [
      q.id,
      q.type,
      q.difficulty,
      q.questionText,
      q.caseText,
      q.imageUrl,
      q.explanation,
      q.summary,
      ...(Array.isArray(q.options) ? q.options : [])
    ].join(' ').toLowerCase();
    return haystack.includes(term);
  });
  renderQuestionResults(filtered);
}

function extractQuestionsFromJsonPayload(payload) {
  if (Array.isArray(payload)) return { topicJson: null, questions: payload };
  if (payload && Array.isArray(payload.questions)) return { topicJson: payload, questions: payload.questions };
  throw new Error('JSON must be either a questions array or a topic object containing questions[].');
}

function normalizeQuestionListForTopic(rawQuestions, subjectId, topicId) {
  let seq = 0;
  return (rawQuestions || []).map((item) => {
    seq += 1;
    const fallbackId = `${subjectId || 'subject'}-${topicId || 'topic'}-${String(seq).padStart(3, '0')}`;
    return normalizeQuestion(item, item.id || fallbackId);
  });
}

async function saveCurrentQuestionsToSelectedTopic(message = 'Update topic questions JSON') {
  requireSession();
  const subjectId = $('question-subject-select').value;
  const topicId = $('question-topic-select').value;
  if (!subjectId || !topicId) throw new Error('Choose subject and topic first.');
  const topicFile = await getTopicFile(subjectId, topicId);
  const nextJson = {
    ...(topicFile.json || {}),
    ...(currentTopicJsonDraft || {}),
    subjectId,
    topicId,
    topicName: (currentTopicJsonDraft && currentTopicJsonDraft.topicName) || (topicFile.json && topicFile.json.topicName) || topicId,
    updatedAt: nowIso(),
    questions: currentQuestions
  };
  await putRepoJson(`${DATA_ROOT}/${subjectId}/${topicId}.json`, nextJson, message, topicFile.sha);
  await syncSubjectAndIndex(subjectId);
  currentTopicJsonDraft = nextJson;
  currentQuestionsDraftMode = false;
  await loadQuestionList();
}

async function saveLoadedQuestionJsonToTopic() {
  try {
    if (!currentQuestions.length) throw new Error('There are no loaded questions to save.');
    await saveCurrentQuestionsToSelectedTopic(`Replace topic questions JSON: ${$('question-topic-select').value}`);
    setMsg('question-json-message', `${currentQuestions.length} questions saved to the selected topic JSON.`);
  } catch (e) {
    setMsg('question-json-message', e.message, false);
  }
}

async function loadSelectedTopicJsonForAdmin() {
  try {
    await loadQuestionList();
  } catch (e) {
    setMsg('question-json-message', e.message, false);
  }
}

function importLocalQuestionJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const subjectId = $('question-subject-select').value;
      const topicId = $('question-topic-select').value;
      if (!subjectId || !topicId) throw new Error('Choose subject and topic before importing a JSON file.');
      const payload = JSON.parse(String(reader.result || ''));
      const extracted = extractQuestionsFromJsonPayload(payload);
      currentTopicJsonDraft = extracted.topicJson || { subjectId, topicId, topicName: topicId, questions: [] };
      currentQuestions = normalizeQuestionListForTopic(extracted.questions, subjectId, topicId);
      currentQuestionsDraftMode = true;
      currentEditingQuestionId = '';
      resetQuestionForm();
      renderQuestionResults(currentQuestions);
      setMsg('question-json-message', `Imported ${currentQuestions.length} questions from ${file.name}. Review/edit them, then click “Save current list to topic JSON”.`);
    } catch (e) {
      setMsg('question-json-message', e.message, false);
    } finally {
      $('question-json-file').value = '';
    }
  };
  reader.onerror = () => setMsg('question-json-message', 'Could not read the selected JSON file.', false);
  reader.readAsText(file);
}

function exportCurrentTopicJson() {
  try {
    const subjectId = $('question-subject-select').value || 'subject';
    const topicId = $('question-topic-select').value || 'topic';
    const payload = {
      ...(currentTopicJsonDraft || {}),
      subjectId,
      topicId,
      updatedAt: nowIso(),
      questions: currentQuestions || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topicId || 'topic'}-questions.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg('question-json-message', `Exported ${payload.questions.length} questions.`);
  } catch (e) {
    setMsg('question-json-message', e.message, false);
  }
}

async function saveQuestion() {
  try {
    requireSession();
    const subjectId = $('question-subject-select').value;
    const topicId = $('question-topic-select').value;
    if (!subjectId || !topicId) throw new Error('Choose subject and topic first.');
    if (!Array.isArray(currentQuestions)) currentQuestions = [];
    const nextNumber = currentQuestions.length + 1;
    const fallbackId = `${subjectId}-${topicId}-${String(nextNumber).padStart(3, '0')}`;
    const question = buildQuestionFromForm(subjectId, topicId, fallbackId);
    const idx = currentQuestions.findIndex(q => q.id === currentEditingQuestionId);
    if (idx >= 0) {
      question.id = currentEditingQuestionId;
      currentQuestions[idx] = question;
    } else {
      currentQuestions.push(question);
    }
    await saveCurrentQuestionsToSelectedTopic(`${idx >= 0 ? 'Update' : 'Add'} question: ${question.id}`);
    resetQuestionForm();
    setMsg('question-message', `Question saved: ${question.id}`);
  } catch (e) {
    setMsg('question-message', e.message, false);
  }
}
async function deleteQuestion(forcedId) {
  try {
    requireSession();
    const subjectId = $('question-subject-select').value;
    const topicId = $('question-topic-select').value;
    const qid = forcedId || currentEditingQuestionId;
    if (!subjectId || !topicId || !qid) throw new Error('Select a question to delete.');
    const before = (currentQuestions || []).length;
    currentQuestions = (currentQuestions || []).filter(q => q.id !== qid);
    if (currentQuestions.length === before) throw new Error('Question not found.');
    await saveCurrentQuestionsToSelectedTopic(`Delete question: ${qid}`);
    resetQuestionForm();
    setMsg('question-message', `Question deleted: ${qid}`);
  } catch (e) {
    setMsg('question-message', e.message, false);
  }
}
async function bulkImportQuestions() {
  try {
    requireSession();
    const subjectId = $('bulk-subject-select').value;
    const topicId = $('bulk-topic-select').value;
    if (!subjectId || !topicId) throw new Error('Choose subject and topic first.');
    const raw = $('bulk-json').value.trim();
    if (!raw) throw new Error('Paste a JSON array first.');
    const input = JSON.parse(raw);
    if (!Array.isArray(input) || !input.length) throw new Error('Bulk input must be a non-empty JSON array.');
    const topicFile = await getTopicFile(subjectId, topicId);
    const questions = topicFile.json.questions || [];
    let seq = questions.length;
    const prepared = input.map(item => {
      seq += 1;
      const id = `${subjectId}-${topicId}-${String(seq).padStart(3, '0')}`;
      return normalizeQuestion(item, id);
    });
    topicFile.json.questions = questions.concat(prepared);
    topicFile.json.updatedAt = nowIso();
    await putRepoJson(`${DATA_ROOT}/${subjectId}/${topicId}.json`, topicFile.json, `Bulk import ${prepared.length} questions into ${topicId}`, topicFile.sha);
    await syncSubjectAndIndex(subjectId);
    if ($('question-subject-select').value === subjectId) {
      $('question-topic-select').value = topicId;
      await loadQuestionList();
    }
    setMsg('bulk-message', `${prepared.length} questions imported successfully.`);
  } catch (e) {
    setMsg('bulk-message', e.message, false);
  }
}
function insertBulkTemplate() {
  $('bulk-json').value = JSON.stringify([
    {
      type: 'mcq',
      difficulty: 'easy',
      questionText: 'Which drug class inhibits bacterial cell wall synthesis?',
      options: ['Macrolides', 'Beta-lactams', 'Tetracyclines', 'Sulfonamides'],
      correctAnswer: 2,
      explanation: 'Beta-lactams inhibit bacterial cell wall synthesis.'
    },
    {
      type: 'true_false',
      difficulty: 'medium',
      questionText: 'Vancomycin is active against MRSA.',
      options: ['True', 'False'],
      correctAnswer: 1,
      explanation: 'True. Vancomycin is active against many MRSA isolates.'
    }
  ], null, 2);
}
function unlock() {
  const entered = $('admin-password-input').value;
  if (entered !== ADMIN_PASSWORD) {
    setMsg('gate-message', 'Wrong password.', false);
    return;
  }
  $('gate').classList.add('hidden');
  $('admin-shell').classList.remove('hidden');
  $('admin-shell').classList.add('flex');
  fillConnectionInputs();
  if (session.owner && session.repo && session.branch && session.token) bootstrapData();
}
async function testConnection() {
  try {
    requireSession();
    await gh(`${DATA_ROOT}/index.json`);
    setMsg('connection-message', 'GitHub connection is working.');
    await bootstrapData();
  } catch (e) {
    setMsg('connection-message', e.message, false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  $('unlock-btn').addEventListener('click', unlock);
  $('save-session-btn').addEventListener('click', () => {
    session.owner = $('repo-owner').value.trim();
    session.repo = $('repo-name').value.trim();
    session.branch = $('repo-branch').value.trim() || 'main';
    session.token = $('github-token').value.trim();
    saveSession();
    setMsg('connection-message', 'Session saved in this browser tab only.');
  });
  $('test-connection-btn').addEventListener('click', testConnection);
  $('reload-data-btn').addEventListener('click', bootstrapData);
  $('add-subject-btn').addEventListener('click', addSubject);

  $('topic-subject-select').addEventListener('change', async () => {
    await syncTopicSelectors();
    resetTopicForm();
  });
  $('topic-edit-select').addEventListener('change', loadTopicIntoForm);
  $('add-topic-btn').addEventListener('click', saveTopic);
  $('reset-topic-btn').addEventListener('click', resetTopicForm);
  $('delete-topic-btn').addEventListener('click', deleteTopic);

  $('question-subject-select').addEventListener('change', async () => {
    await syncTopicSelectors();
    renderQuestionResults([]);
    resetQuestionForm();
  });
  $('question-topic-select').addEventListener('change', async () => {
    await loadQuestionList();
    resetQuestionForm();
  });
  $('question-search').addEventListener('input', filterQuestionResults);
  $('load-topic-json-btn')?.addEventListener('click', loadSelectedTopicJsonForAdmin);
  $('choose-question-json-btn')?.addEventListener('click', () => $('question-json-file')?.click());
  $('question-json-file')?.addEventListener('change', (event) => importLocalQuestionJsonFile(event.target.files?.[0]));
  $('save-question-json-btn')?.addEventListener('click', saveLoadedQuestionJsonToTopic);
  $('export-question-json-btn')?.addEventListener('click', exportCurrentTopicJson);
  $('add-question-btn').addEventListener('click', saveQuestion);
  $('reset-question-btn').addEventListener('click', resetQuestionForm);
  $('delete-question-btn').addEventListener('click', () => deleteQuestion());

  $('bulk-subject-select').addEventListener('change', syncTopicSelectors);
  $('bulk-topic-select').addEventListener('change', () => {});
  $('bulk-import-btn').addEventListener('click', bulkImportQuestions);
  $('bulk-template-btn').addEventListener('click', insertBulkTemplate);
});
