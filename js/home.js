let allSubjects = [];

async function initHome() {
  await loadSubjects();
  setupSearch();
}

async function loadSubjects() {
  const data = await loadDataFromGitHub();
  allSubjects = data.subjects || [];
  renderSubjects(allSubjects);
}

function renderSubjects(subjects) {
  const container = document.getElementById('subjectsContainer');
  if (subjects.length === 0) {
    container.innerHTML = '<div class="loading">No subjects available</div>';
    return;
  }

  container.innerHTML = subjects.map(subject => `
    <div class="card">
      <h3>${subject.name}</h3>
      <p>${subject.topics?.length || 0} topics available</p>
      <div class="card-meta">
        <span class="neutral-600">${subject.topics?.length || 0} Topics</span>
      </div>
      <button class="btn btn-primary" onclick="openSubject('${subject.id}')">Open Topics</button>
    </div>
  `).join('');
}

function openSubject(subjectId) {
  window.location.href = `subject.html?id=${subjectId}`;
}

function setupSearch() {
  const searchInput = document.getElementById('subjectSearch');
  searchInput.addEventListener('input', debounce(() => {
    const query = searchInput.value.toLowerCase();
    const filtered = allSubjects.filter(s =>
      s.name.toLowerCase().includes(query)
    );
    renderSubjects(filtered);
  }, 300));
}

document.addEventListener('DOMContentLoaded', initHome);

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    window.location.href = 'admin.html';
  }
});
