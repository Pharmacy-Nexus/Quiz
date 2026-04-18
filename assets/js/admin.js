const SESSION_KEY = 'pnAdminSession';
const DATA_ROOT = (window.PN_ADMIN_CONFIG && window.PN_ADMIN_CONFIG.dataRoot) || 'data';
const ADMIN_PASSWORD = (window.PN_ADMIN_CONFIG && window.PN_ADMIN_CONFIG.adminPassword) || 'changeme';

let session = loadSession();
let subjectsIndex = null;

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
function requireSession() {
  if (!session.owner || !session.repo || !session.branch || !session.token) {
    throw new Error('Save the GitHub session first.');
  }
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
  return res.json();
}
function decodeBase64Unicode(str) {
  return decodeURIComponent(escape(atob(str)));
}
function encodeBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
async function getRepoFile(path) {
  const file = await gh(path);
  return {
    sha: file.sha,
    json: JSON.parse(decodeBase64Unicode(file.content.replace(/\n/g, ''))),
    raw: decodeBase64Unicode(file.content.replace(/\n/g, ''))
  };
}
async function putRepoFile(path, contentObject, message, sha) {
  const body = {
    message,
    content: encodeBase64Unicode(JSON.stringify(contentObject, null, 2)),
    branch: session.branch
  };
  if (sha) body.sha = sha;
  return gh(path, { method: 'PUT', body: JSON.stringify(body) });
}
async function bootstrapData() {
  try {
    const file = await getRepoFile(`${DATA_ROOT}/subjects/index.json`);
    subjectsIndex = file.json;
  } catch (e) {
    subjectsIndex = { updatedAt: new Date().toISOString(), subjects: [] };
  }
  renderSubjectOptions();
}
function renderSubjectOptions() {
  const selects = [$('topic-subject-select'), $('question-subject-select')];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">Select subject</option>' + (subjectsIndex?.subjects || []).sort((a,b)=>(a.order||0)-(b.order||0)).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  });
  if ($('question-subject-select')) {
    $('question-subject-select').dispatchEvent(new Event('change'));
  }
}
async function loadTopicsForQuestionSubject() {
  const subjectId = $('question-subject-select').value;
  const select = $('question-topic-select');
  select.innerHTML = '<option value="">Select topic</option>';
  if (!subjectId) return;
  const subjectPath = `${DATA_ROOT}/subjects/${subjectId}.json`;
  const file = await getRepoFile(subjectPath);
  select.innerHTML = '<option value="">Select topic</option>' + (file.json.topics || []).sort((a,b)=>(a.order||0)-(b.order||0)).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
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
    await putRepoFile(`${DATA_ROOT}/subjects/${id}.json`, subjectData, `Create subject: ${name}`);

    const updatedIndexFile = await getRepoFile(`${DATA_ROOT}/subjects/index.json`);
    updatedIndexFile.json.updatedAt = new Date().toISOString();
    updatedIndexFile.json.subjects.push({
      id, name, description, icon, theme: 'primary', order,
      topicsCount: 0, questionsCount: 0,
      file: `${DATA_ROOT}/subjects/${id}.json`
    });
    await putRepoFile(`${DATA_ROOT}/subjects/index.json`, updatedIndexFile.json, `Add subject to index: ${name}`, updatedIndexFile.sha);
    subjectsIndex = updatedIndexFile.json;
    renderSubjectOptions();
    setMsg('subject-message', `Subject created: ${name}`);
  } catch (e) {
    setMsg('subject-message', e.message, false);
  }
}

async function addTopic() {
  try {
    requireSession();
    const subjectId = $('topic-subject-select').value;
    const subjectMeta = (subjectsIndex.subjects || []).find(s => s.id === subjectId);
    if (!subjectMeta) throw new Error('Select a subject first.');
    const name = $('topic-name').value.trim();
    const id = slugify($('topic-slug').value || name);
    const description = $('topic-description').value.trim();
    const order = Number($('topic-order').value || 1);
    if (!name || !id) throw new Error('Topic name and slug are required.');

    const subjectPath = `${DATA_ROOT}/subjects/${subjectId}.json`;
    const subjectFile = await getRepoFile(subjectPath);
    if ((subjectFile.json.topics || []).some(t => t.id === id)) throw new Error('Topic already exists.');

    const topicPath = `${DATA_ROOT}/topics/${subjectId}/${id}.json`;
    const topicData = {
      subjectId,
      topicId: id,
      topicName: name,
      updatedAt: new Date().toISOString(),
      questions: []
    };
    await putRepoFile(topicPath, topicData, `Create topic: ${name}`);

    subjectFile.json.topics.push({
      id, name, description, order,
      difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
      questionsCount: 0,
      file: topicPath
    });
    await putRepoFile(subjectPath, subjectFile.json, `Add topic: ${name}`, subjectFile.sha);

    const indexFile = await getRepoFile(`${DATA_ROOT}/subjects/index.json`);
    const subjectEntry = indexFile.json.subjects.find(s => s.id === subjectId);
    if (subjectEntry) subjectEntry.topicsCount = (subjectEntry.topicsCount || 0) + 1;
    indexFile.json.updatedAt = new Date().toISOString();
    await putRepoFile(`${DATA_ROOT}/subjects/index.json`, indexFile.json, `Update subject counts: ${subjectMeta.name}`, indexFile.sha);
    subjectsIndex = indexFile.json;
    renderSubjectOptions();
    setMsg('topic-message', `Topic created: ${name}`);
  } catch (e) {
    setMsg('topic-message', e.message, false);
  }
}

async function addQuestion() {
  try {
    requireSession();
    const subjectId = $('question-subject-select').value;
    const topicId = $('question-topic-select').value;
    if (!subjectId || !topicId) throw new Error('Choose subject and topic.');
    const type = $('question-type').value;
    const difficulty = $('question-difficulty').value;
    const questionText = $('question-text').value.trim();
    const caseText = $('question-case').value.trim();
    const imageUrl = $('question-image').value.trim();
    const explanation = $('question-explanation').value.trim();
    const correctRaw = Number($('correct-answer').value);
    if (!questionText || !explanation) throw new Error('Question text and explanation are required.');

    let options = [$('option-1').value.trim(), $('option-2').value.trim(), $('option-3').value.trim(), $('option-4').value.trim()].filter(Boolean);
    if (type === 'true_false') options = ['True', 'False'];
    if (type === 'case' || type === 'image') {
      if (!options.length) throw new Error('Case and image questions still need answer options.');
    }
    if (!options.length) throw new Error('Add answer options.');
    if (!correctRaw || correctRaw < 1 || correctRaw > options.length) throw new Error('Correct answer number is invalid.');

    const topicPath = `${DATA_ROOT}/topics/${subjectId}/${topicId}.json`;
    const topicFile = await getRepoFile(topicPath);
    const nextNumber = (topicFile.json.questions || []).length + 1;
    const qid = `${subjectId}-${topicId}-${String(nextNumber).padStart(3, '0')}`;
    topicFile.json.questions.push({
      id: qid,
      type,
      difficulty,
      questionText,
      options,
      correctAnswer: correctRaw - 1,
      explanation,
      caseText,
      imageUrl
    });
    topicFile.json.updatedAt = new Date().toISOString();
    await putRepoFile(topicPath, topicFile.json, `Add question: ${qid}`, topicFile.sha);

    const subjectPath = `${DATA_ROOT}/subjects/${subjectId}.json`;
    const subjectFile = await getRepoFile(subjectPath);
    const topicEntry = subjectFile.json.topics.find(t => t.id === topicId);
    if (topicEntry) {
      topicEntry.questionsCount = (topicEntry.questionsCount || 0) + 1;
      topicEntry.difficultyBreakdown = topicEntry.difficultyBreakdown || { easy: 0, medium: 0, hard: 0 };
      topicEntry.difficultyBreakdown[difficulty] = (topicEntry.difficultyBreakdown[difficulty] || 0) + 1;
    }
    await putRepoFile(subjectPath, subjectFile.json, `Update topic counts: ${topicId}`, subjectFile.sha);

    const indexFile = await getRepoFile(`${DATA_ROOT}/subjects/index.json`);
    const subjectEntry = indexFile.json.subjects.find(s => s.id === subjectId);
    if (subjectEntry) subjectEntry.questionsCount = (subjectEntry.questionsCount || 0) + 1;
    indexFile.json.updatedAt = new Date().toISOString();
    await putRepoFile(`${DATA_ROOT}/subjects/index.json`, indexFile.json, `Update question count: ${subjectId}`, indexFile.sha);
    subjectsIndex = indexFile.json;
    setMsg('question-message', `Question added: ${qid}`);
  } catch (e) {
    setMsg('question-message', e.message, false);
  }
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
  $('repo-owner').value = session.owner || '';
  $('repo-name').value = session.repo || '';
  $('repo-branch').value = session.branch || 'main';
  bootstrapData();
}

async function testConnection() {
  try {
    requireSession();
    await gh(`${DATA_ROOT}/subjects/index.json`);
    setMsg('connection-message', 'GitHub connection is working.');
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
  $('add-topic-btn').addEventListener('click', addTopic);
  $('add-question-btn').addEventListener('click', addQuestion);
  $('question-subject-select').addEventListener('change', () => {
    loadTopicsForQuestionSubject().catch(err => setMsg('question-message', err.message, false));
  });
});
