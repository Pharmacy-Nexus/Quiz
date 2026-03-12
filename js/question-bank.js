let allQuestions = [];
let filteredQuestions = [];
let currentPage = 1;
const QUESTIONS_PER_PAGE = 30;

async function initQuestionBank() {
  await loadAllQuestions();
  setupFilters();
  displayQuestions();
}

async function loadAllQuestions() {
  const data = await loadDataFromGitHub();
  allQuestions = [];

  for (const subject of (data.subjects || [])) {
    for (const topic of (subject.topics || [])) {
      const topicData = await loadTopicQuestions(subject.id, topic.id);
      if (topicData.questions) {
        allQuestions.push(...topicData.questions);
      }
    }
  }

  filteredQuestions = [...allQuestions];
  populateFilters(data);
}

function populateFilters(data) {
  const subjectSelect = document.getElementById('subjectFilter');
  data.subjects?.forEach(subject => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.textContent = subject.name;
    subjectSelect.appendChild(option);
  });

  subjectSelect.addEventListener('change', () => {
    const topicSelect = document.getElementById('topicFilter');
    const selectedSubjectId = subjectSelect.value;
    topicSelect.innerHTML = '<option value="">All Topics</option>';

    if (selectedSubjectId) {
      const subject = data.subjects?.find(s => s.id === selectedSubjectId);
      subject?.topics?.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic.id;
        option.textContent = topic.name;
        topicSelect.appendChild(option);
      });
    }

    applyFilters();
  });
}

function setupFilters() {
  document.getElementById('subjectFilter').addEventListener('change', applyFilters);
  document.getElementById('topicFilter').addEventListener('change', applyFilters);
  document.getElementById('difficultyFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  document.getElementById('prevPageBtn').addEventListener('click', previousPage);
  document.getElementById('nextPageBtn').addEventListener('click', nextPage);
}

function applyFilters() {
  const subjectFilter = document.getElementById('subjectFilter').value;
  const topicFilter = document.getElementById('topicFilter').value;
  const difficultyFilter = document.getElementById('difficultyFilter').value;
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();

  filteredQuestions = allQuestions.filter(q => {
    const matchSubject = !subjectFilter || q.subject === subjectFilter;
    const matchTopic = !topicFilter || q.topic === topicFilter;
    const matchDifficulty = !difficultyFilter || q.difficulty === difficultyFilter;
    const matchSearch = !searchQuery || q.question.toLowerCase().includes(searchQuery);

    return matchSubject && matchTopic && matchDifficulty && matchSearch;
  });

  currentPage = 1;
  displayQuestions();
}

function resetFilters() {
  document.getElementById('subjectFilter').value = '';
  document.getElementById('topicFilter').value = '';
  document.getElementById('difficultyFilter').value = '';
  document.getElementById('searchInput').value = '';
  filteredQuestions = [...allQuestions];
  currentPage = 1;
  displayQuestions();
}

function displayQuestions() {
  const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
  const end = start + QUESTIONS_PER_PAGE;
  const paginatedQuestions = filteredQuestions.slice(start, end);

  const container = document.getElementById('questionsContainer');
  if (paginatedQuestions.length === 0) {
    container.innerHTML = '<div class="loading">No questions found</div>';
  } else {
    container.innerHTML = paginatedQuestions.map(renderQuestionCard).join('');
  }

  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE);
  const pageInfo = document.getElementById('pageInfo');
  pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${filteredQuestions.length} total)`;

  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  prevBtn.style.display = currentPage > 1 ? 'block' : 'none';
  nextBtn.style.display = currentPage < totalPages ? 'block' : 'none';
}

function nextPage() {
  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    displayQuestions();
    window.scrollTo(0, 0);
  }
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    displayQuestions();
    window.scrollTo(0, 0);
  }
}

document.addEventListener('DOMContentLoaded', initQuestionBank);
