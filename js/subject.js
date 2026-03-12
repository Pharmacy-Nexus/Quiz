let currentSubject = null;
let allTopics = [];

async function initSubject() {
  const subjectId = getQueryParam('id');
  if (!subjectId) {
    window.location.href = 'index.html';
    return;
  }

  await loadSubject(subjectId);
  setupTopicSearch();
}

async function loadSubject(subjectId) {
  const data = await loadDataFromGitHub();
  currentSubject = data.subjects?.find(s => s.id === subjectId);

  if (!currentSubject) {
    document.getElementById('subjectsContainer').innerHTML = '<div class="loading">Subject not found</div>';
    return;
  }

  document.getElementById('subjectName').textContent = currentSubject.name;
  document.getElementById('subjectTitle').textContent = currentSubject.name;

  allTopics = currentSubject.topics || [];
  renderTopics(allTopics);
}

function renderTopics(topics) {
  const container = document.getElementById('topicsContainer');
  if (topics.length === 0) {
    container.innerHTML = '<div class="loading">No topics available</div>';
    return;
  }

  container.innerHTML = topics.map(topic => `
    <div class="card">
      <h3>${topic.name}</h3>
      <p>${topic.questionCount || 0} questions</p>
      <div class="card-meta">
        <span>${topic.questionCount || 0} Questions</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary" onclick="openStudy('${currentSubject.id}', '${topic.id}')">Study</button>
        <button class="btn btn-primary" onclick="openTopic('${currentSubject.id}', '${topic.id}')">View</button>
      </div>
    </div>
  `).join('');
}

function openTopic(subjectId, topicId) {
  window.location.href = `topic.html?subject=${subjectId}&topic=${topicId}`;
}

function openStudy(subjectId, topicId) {
  window.location.href = `study.html?subject=${subjectId}&topic=${topicId}`;
}

function setupTopicSearch() {
  const searchInput = document.getElementById('topicSearch');
  searchInput.addEventListener('input', debounce(() => {
    const query = searchInput.value.toLowerCase();
    const filtered = allTopics.filter(t =>
      t.name.toLowerCase().includes(query)
    );
    renderTopics(filtered);
  }, 300));
}

document.addEventListener('DOMContentLoaded', initSubject);
