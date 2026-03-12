// js/admin.js

const STORAGE_KEYS = {
  token: 'pharmacy_nexus_github_token',
  subjects: 'pharmacy_nexus_subjects',
  topics: 'pharmacy_nexus_topics',
  questions: 'pharmacy_nexus_questions',
  quizzes: 'pharmacy_nexus_quizzes'
};

let appData = {
  subjects: [],
  topics: [],
  questions: [],
  quizzes: []
};

let githubApi = null;

/* ---------------------------
   Helpers
--------------------------- */

function $(id) {
  return document.getElementById(id);
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function showMessage(containerId, message, type = 'success') {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="${type === 'success' ? 'success-message' : 'error-message'}">
      ${message}
    </div>
  `;

  setTimeout(() => {
    if (container) container.innerHTML = '';
  }, 3000);
}

function setSyncStatus(message, type = 'success') {
  const el = $('syncStatus');
  if (!el) return;

  el.innerHTML = `
    <div class="${type === 'success' ? 'success-message' : 'error-message'}" style="margin:0;">
      ${message}
    </div>
  `;
}

function getLocal(key, fallback = []) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveAllToLocalStorage() {
  setLocal(STORAGE_KEYS.subjects, appData.subjects);
  setLocal(STORAGE_KEYS.topics, appData.topics);
  setLocal(STORAGE_KEYS.questions, appData.questions);
  setLocal(STORAGE_KEYS.quizzes, appData.quizzes);
}

function loadAllFromLocalStorage() {
  appData.subjects = getLocal(STORAGE_KEYS.subjects, []);
  appData.topics = getLocal(STORAGE_KEYS.topics, []);
  appData.questions = getLocal(STORAGE_KEYS.questions, []);
  appData.quizzes = getLocal(STORAGE_KEYS.quizzes, []);
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ---------------------------
   GitHub integration (optional)
--------------------------- */

function initGithubApi() {
  try {
    if (typeof GitHubAPI === 'function') {
      githubApi = new GitHubAPI();
    }
  } catch (e) {
    console.warn('GitHubAPI init failed:', e);
    githubApi = null;
  }
}

async function tryValidateToken(token) {
  if (!githubApi || typeof githubApi.setToken !== 'function') return true;

  try {
    githubApi.setToken(token);

    if (typeof githubApi.validateToken === 'function') {
      return await githubApi.validateToken(token);
    }

    return true;
  } catch (e) {
    console.warn('Token validation failed:', e);
    return false;
  }
}

async function tryLoadFromGitHub() {
  if (!githubApi) return false;

  try {
    const loaders = [
      { key: 'subjects', fallback: [], name: 'subjects.json' },
      { key: 'topics', fallback: [], name: 'topics.json' },
      { key: 'questions', fallback: [], name: 'questions.json' },
      { key: 'quizzes', fallback: [], name: 'quizzes.json' }
    ];

    let loadedAnything = false;

    for (const item of loaders) {
      let data = null;

      if (typeof githubApi.loadJSON === 'function') {
        data = await githubApi.loadJSON(item.name);
      } else if (typeof githubApi.getJSON === 'function') {
        data = await githubApi.getJSON(item.name);
      } else if (typeof githubApi.readJSON === 'function') {
        data = await githubApi.readJSON(item.name);
      }

      if (Array.isArray(data)) {
        appData[item.key] = data;
        loadedAnything = true;
      }
    }

    if (loadedAnything) {
      saveAllToLocalStorage();
      return true;
    }

    return false;
  } catch (e) {
    console.warn('GitHub load skipped:', e);
    return false;
  }
}

async function trySaveToGitHub() {
  if (!githubApi) return false;

  try {
    const payloads = [
      { name: 'subjects.json', data: appData.subjects },
      { name: 'topics.json', data: appData.topics },
      { name: 'questions.json', data: appData.questions },
      { name: 'quizzes.json', data: appData.quizzes }
    ];

    for (const file of payloads) {
      if (typeof githubApi.saveJSON === 'function') {
        await githubApi.saveJSON(file.name, file.data);
      } else if (typeof githubApi.updateJSON === 'function') {
        await githubApi.updateJSON(file.name, file.data);
      } else if (typeof githubApi.writeJSON === 'function') {
        await githubApi.writeJSON(file.name, file.data);
      } else {
        return false;
      }
    }

    return true;
  } catch (e) {
    console.warn('GitHub save skipped:', e);
    return false;
  }
}

async function persistData(successMessage = 'Saved successfully.') {
  saveAllToLocalStorage();

  const synced = await trySaveToGitHub();

  if (synced) {
    setSyncStatus(`${successMessage} Synced to GitHub.`, 'success');
  } else {
    setSyncStatus(`${successMessage} Saved locally.`, 'success');
  }
}

/* ---------------------------
   Login / Logout
--------------------------- */

async function loginAdmin() {
  const token = $('tokenInput').value.trim();

  if (!token) {
    alert('Please enter your GitHub token.');
    return;
  }

  setSyncStatus('Checking token...', 'success');

  const valid = await tryValidateToken(token);

  if (!valid) {
    setSyncStatus('Invalid token. Please check it and try again.', 'error');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.token, token);

  loadAllFromLocalStorage();
  await tryLoadFromGitHub();

  $('loginScreen').style.display = 'none';
  $('adminPanel').style.display = 'block';

  initializeAdminUI();
  setSyncStatus('Logged in successfully.', 'success');
}

function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEYS.token);
  $('adminPanel').style.display = 'none';
  $('loginScreen').style.display = 'block';
  $('tokenInput').value = '';
  setSyncStatus('Logged out.', 'success');
}

/* ---------------------------
   Tabs
--------------------------- */

function switchTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  const clicked = Array.from(document.querySelectorAll('.admin-tab'))
    .find(btn => btn.textContent.trim().toLowerCase().includes(tabId.toLowerCase().slice(0, 4)));

  if (clicked) clicked.classList.add('active');

  const tab = $(tabId);
  if (tab) tab.classList.add('active');
}

/* ---------------------------
   Subjects
--------------------------- */

async function addSubject() {
  const name = $('subjectName').value.trim();

  if (!name) {
    alert('Please enter subject name.');
    return;
  }

  const exists = appData.subjects.some(
    s => s.name.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    alert('This subject already exists.');
    return;
  }

  appData.subjects.push({
    id: generateId('sub'),
    name
  });

  $('subjectName').value = '';
  await persistData('Subject added.');
  renderAll();
}

async function deleteSubject(id) {
  const subject = appData.subjects.find(s => s.id === id);
  if (!subject) return;

  const hasTopics = appData.topics.some(t => t.subjectId === id);
  const hasQuestions = appData.questions.some(q => q.subjectId === id);

  if (hasTopics || hasQuestions) {
    alert('Delete related topics/questions first.');
    return;
  }

  appData.subjects = appData.subjects.filter(s => s.id !== id);
  await persistData('Subject deleted.');
  renderAll();
}

/* ---------------------------
   Topics
--------------------------- */

async function addTopic() {
  const subjectId = $('topicSubject').value;
  const name = $('topicName').value.trim();

  if (!subjectId || !name) {
    alert('Please select subject and enter topic name.');
    return;
  }

  const exists = appData.topics.some(
    t => t.subjectId === subjectId && t.name.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    alert('This topic already exists in this subject.');
    return;
  }

  appData.topics.push({
    id: generateId('top'),
    subjectId,
    name
  });

  $('topicName').value = '';
  await persistData('Topic added.');
  renderAll();
}

async function deleteTopic(id) {
  const hasQuestions = appData.questions.some(q => q.topicId === id);
  const hasQuizzes = appData.quizzes.some(qz => qz.topicId === id);

  if (hasQuestions || hasQuizzes) {
    alert('Delete related questions/quiz sets first.');
    return;
  }

  appData.topics = appData.topics.filter(t => t.id !== id);
  await persistData('Topic deleted.');
  renderAll();
}

/* ---------------------------
   Questions
--------------------------- */

function addOption() {
  const wrapper = $('optionsList');
  const div = document.createElement('div');
  div.className = 'option-item';
  div.innerHTML = `
    <input type="text" placeholder="New option" class="option-input">
    <button type="button" onclick="removeOption(this)">Remove</button>
  `;
  wrapper.appendChild(div);
}

function removeOption(button) {
  const wrapper = $('optionsList');
  if (wrapper.children.length <= 2) {
    alert('Question should have at least 2 options.');
    return;
  }
  button.parentElement.remove();
}

function getQuestionOptions() {
  return Array.from(document.querySelectorAll('.option-input'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

async function addQuestion() {
  const subjectId = $('qSubject').value;
  const topicId = $('qTopic').value;
  const type = $('qType').value;
  const text = $('qText').value.trim();
  const options = getQuestionOptions();
  const correctAnswer = Number($('qCorrect').value);
  const explanation = $('qExplanation').value.trim();
  const difficulty = $('qDifficulty').value;
  const caseScenario = $('qCase').value.trim();
  const imageUrl = $('qImage').value.trim();

  if (!subjectId || !topicId || !text) {
    alert('Please select subject, topic, and enter question text.');
    return;
  }

  if ((type === 'MCQ' || type === 'Image Question' || type === 'Clinical Case') && options.length < 2) {
    alert('Please provide at least 2 options.');
    return;
  }

  if (Number.isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
    alert('Correct answer index is invalid.');
    return;
  }

  appData.questions.push({
    id: generateId('q'),
    subjectId,
    topicId,
    type,
    text,
    options,
    correctAnswer,
    explanation,
    difficulty,
    caseScenario,
    imageUrl
  });

  clearQuestionForm();
  await persistData('Question added.');
  renderAll();
}

function clearQuestionForm() {
  $('qText').value = '';
  $('qCorrect').value = '';
  $('qExplanation').value = '';
  $('qCase').value = '';
  $('qImage').value = '';
  $('qDifficulty').value = 'Easy';
  $('qType').value = 'MCQ';

  $('optionsList').innerHTML = `
    <div class="option-item">
      <input type="text" placeholder="Option A" class="option-input">
      <button type="button" onclick="removeOption(this)">Remove</button>
    </div>
    <div class="option-item">
      <input type="text" placeholder="Option B" class="option-input">
      <button type="button" onclick="removeOption(this)">Remove</button>
    </div>
    <div class="option-item">
      <input type="text" placeholder="Option C" class="option-input">
      <button type="button" onclick="removeOption(this)">Remove</button>
    </div>
    <div class="option-item">
      <input type="text" placeholder="Option D" class="option-input">
      <button type="button" onclick="removeOption(this)">Remove</button>
    </div>
  `;
}

async function deleteQuestion(id) {
  appData.questions = appData.questions.filter(q => q.id !== id);

  appData.quizzes = appData.quizzes.map(qz => ({
    ...qz,
    questionIds: (qz.questionIds || []).filter(qid => qid !== id)
  }));

  await persistData('Question deleted.');
  renderAll();
}

/* ---------------------------
   Quiz Sets
--------------------------- */

function loadTopicQuestionsForQuiz() {
  const topicId = $('qzTopic').value;
  const box = $('questionsForQuiz');

  const questions = appData.questions.filter(q => q.topicId === topicId);

  if (!questions.length) {
    box.innerHTML = `<p>No questions found for this topic.</p>`;
    return;
  }

  box.innerHTML = questions.map(q => `
    <label style="display:block; margin-bottom:0.75rem;">
      <input type="checkbox" value="${q.id}" class="quiz-question-checkbox">
      <strong>${escapeHtml(q.type)}</strong> — ${escapeHtml(q.text.slice(0, 100))}
    </label>
  `).join('');
}

async function addQuizSet() {
  const name = $('qzName').value.trim();
  const subjectId = $('qzSubject').value;
  const topicId = $('qzTopic').value;
  const timeLimit = Number($('qzTime').value) || 0;

  const questionIds = Array.from(document.querySelectorAll('.quiz-question-checkbox:checked'))
    .map(cb => cb.value);

  if (!name || !subjectId || !topicId) {
    alert('Please fill quiz name, subject, and topic.');
    return;
  }

  if (!questionIds.length) {
    alert('Please select at least one question.');
    return;
  }

  appData.quizzes.push({
    id: generateId('quiz'),
    name,
    subjectId,
    topicId,
    questionIds,
    timeLimit
  });

  $('qzName').value = '';
  $('qzTime').value = '0';
  $('questionsForQuiz').innerHTML = '';

  await persistData('Quiz set created.');
  renderAll();
}

async function deleteQuizSet(id) {
  appData.quizzes = appData.quizzes.filter(q => q.id !== id);
  await persistData('Quiz set deleted.');
  renderAll();
}

/* ---------------------------
   Select updaters
--------------------------- */

function fillSelect(selectId, items, placeholder = 'Select') {
  const select = $(selectId);
  if (!select) return;

  select.innerHTML = '';

  if (!items.length) {
    select.innerHTML = `<option value="">No data available</option>`;
    return;
  }

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = placeholder;
  select.appendChild(defaultOption);

  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

function updateTopicSelectBySubject(subjectSelectId, topicSelectId) {
  const subjectId = $(subjectSelectId).value;
  const topics = appData.topics.filter(t => t.subjectId === subjectId);
  fillSelect(topicSelectId, topics, 'Select topic');
}

function updateQTopicSelect() {
  updateTopicSelectBySubject('qSubject', 'qTopic');
}

function updateQzTopicSelect() {
  updateTopicSelectBySubject('qzSubject', 'qzTopic');
  $('questionsForQuiz').innerHTML = '';
}

/* ---------------------------
   Renderers
--------------------------- */

function getSubjectName(subjectId) {
  return appData.subjects.find(s => s.id === subjectId)?.name || 'Unknown Subject';
}

function getTopicName(topicId) {
  return appData.topics.find(t => t.id === topicId)?.name || 'Unknown Topic';
}

function renderSubjects() {
  const list = $('subjectsList');

  if (!appData.subjects.length) {
    list.innerHTML = '<p>No subjects yet.</p>';
    return;
  }

  list.innerHTML = appData.subjects.map(subject => {
    const topicCount = appData.topics.filter(t => t.subjectId === subject.id).length;
    return `
      <div class="data-item">
        <div>
          <h4>${escapeHtml(subject.name)}</h4>
          <p>${topicCount} topic(s)</p>
        </div>
        <div class="data-actions">
          <button class="btn-delete" onclick="deleteSubject('${subject.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTopics() {
  const list = $('topicsList');

  if (!appData.topics.length) {
    list.innerHTML = '<p>No topics yet.</p>';
    return;
  }

  list.innerHTML = appData.topics.map(topic => {
    const questionCount = appData.questions.filter(q => q.topicId === topic.id).length;
    return `
      <div class="data-item">
        <div>
          <h4>${escapeHtml(topic.name)}</h4>
          <p>${escapeHtml(getSubjectName(topic.subjectId))}</p>
          <p>${questionCount} question(s)</p>
        </div>
        <div class="data-actions">
          <button class="btn-delete" onclick="deleteTopic('${topic.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderQuestions() {
  const questionsTab = $('questions');

  let holder = $('questionsList');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'questionsList';
    holder.className = 'data-list';
    questionsTab.appendChild(document.createElement('h2')).textContent = 'Existing Questions';
    questionsTab.appendChild(holder);
  }

  if (!appData.questions.length) {
    holder.innerHTML = '<p>No questions yet.</p>';
    return;
  }

  holder.innerHTML = appData.questions.map(q => `
    <div class="data-item">
      <div>
        <h4>${escapeHtml(q.type)} - ${escapeHtml(q.difficulty)}</h4>
        <p><strong>${escapeHtml(getSubjectName(q.subjectId))}</strong> / ${escapeHtml(getTopicName(q.topicId))}</p>
        <p>${escapeHtml(q.text.slice(0, 120))}${q.text.length > 120 ? '...' : ''}</p>
      </div>
      <div class="data-actions">
        <button class="btn-delete" onclick="deleteQuestion('${q.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderQuizzes() {
  const list = $('quizzesList');

  if (!appData.quizzes.length) {
    list.innerHTML = '<p>No quiz sets yet.</p>';
    return;
  }

  list.innerHTML = appData.quizzes.map(quiz => `
    <div class="data-item">
      <div>
        <h4>${escapeHtml(quiz.name)}</h4>
        <p>${escapeHtml(getSubjectName(quiz.subjectId))} / ${escapeHtml(getTopicName(quiz.topicId))}</p>
        <p>${(quiz.questionIds || []).length} question(s) • ${quiz.timeLimit || 0} min</p>
      </div>
      <div class="data-actions">
        <button class="btn-delete" onclick="deleteQuizSet('${quiz.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderAll() {
  fillSelect('topicSubject', appData.subjects, 'Select subject');
  fillSelect('qSubject', appData.subjects, 'Select subject');
  fillSelect('qzSubject', appData.subjects, 'Select subject');

  renderSubjects();
  renderTopics();
  renderQuestions();
  renderQuizzes();
}

/* ---------------------------
   Init
--------------------------- */

function initializeAdminUI() {
  renderAll();
}

document.addEventListener('DOMContentLoaded', async () => {
  initGithubApi();
  loadAllFromLocalStorage();

  const savedToken = localStorage.getItem(STORAGE_KEYS.token);

  if (savedToken) {
    if ($('tokenInput')) $('tokenInput').value = savedToken;
    $('loginScreen').style.display = 'none';
    $('adminPanel').style.display = 'block';

    await tryValidateToken(savedToken);
    await tryLoadFromGitHub();

    initializeAdminUI();
    setSyncStatus('Admin panel ready.', 'success');
  } else {
    $('loginScreen').style.display = 'block';
    $('adminPanel').style.display = 'none';
  }
});
