let currentTopic = null;
let currentSubject = null;
let topicQuestions = [];
let topicQuizzes = [];

async function initTopic() {
  const subjectId = getQueryParam('subject');
  const topicId = getQueryParam('topic');

  if (!subjectId || !topicId) {
    window.location.href = 'index.html';
    return;
  }

  await loadTopic(subjectId, topicId);
}

async function loadTopic(subjectId, topicId) {
  const data = await loadDataFromGitHub();

  currentSubject = data.subjects?.find(s => s.id === subjectId);
  if (!currentSubject) {
    window.location.href = 'index.html';
    return;
  }

  currentTopic = currentSubject.topics?.find(t => t.id === topicId);
  if (!currentTopic) {
    window.location.href = 'subject.html?id=' + subjectId;
    return;
  }

  document.getElementById('topicName').textContent = currentTopic.name;
  document.getElementById('topicTitle').textContent = currentTopic.name;
  document.getElementById('subjectBreadcrumb').href = `subject.html?id=${subjectId}`;
  document.getElementById('subjectBreadcrumb').textContent = currentSubject.name;

  const topicData = await loadTopicQuestions(subjectId, topicId);
  topicQuestions = topicData.questions || [];

  const questionCount = topicQuestions.length;
  document.getElementById('topicMetadata').textContent = `${questionCount} questions available`;

  const difficulty = calculateDifficulty(topicQuestions);
  document.getElementById('easyCount').textContent = difficulty.Easy;
  document.getElementById('mediumCount').textContent = difficulty.Medium;
  document.getElementById('hardCount').textContent = difficulty.Hard;

  topicQuizzes = data.quizSets?.filter(q => q.topic === topicId && q.subject === subjectId) || [];

  setupButtons();
}

function setupButtons() {
  const studyBtn = document.getElementById('studyBtn');
  const quizBtn = document.getElementById('quizBtn');

  studyBtn.onclick = () => {
    window.location.href = `study.html?subject=${getQueryParam('subject')}&topic=${getQueryParam('topic')}`;
  };

  quizBtn.onclick = () => {
    if (topicQuizzes.length === 0) {
      alert('No quiz sets available for this topic');
      return;
    }
    showQuizzes();
  };
}

function showQuizzes() {
  const section = document.getElementById('quizzesSection');
  const container = document.getElementById('quizzesContainer');

  if (topicQuizzes.length === 0) {
    container.innerHTML = '<div class="loading">No quizzes available</div>';
  } else {
    container.innerHTML = topicQuizzes.map(quiz => `
      <div class="card">
        <h3>${quiz.name}</h3>
        <p>${quiz.questionIds?.length || 0} questions</p>
        <div class="card-meta">
          <span>${quiz.timeLimit ? quiz.timeLimit + ' minutes' : 'No time limit'}</span>
        </div>
        <button class="btn btn-primary" onclick="startQuiz('${quiz.id}')">Start Quiz</button>
      </div>
    `).join('');
  }

  section.style.display = 'block';
}

function startQuiz(quizId) {
  window.location.href = `quiz.html?quizId=${quizId}&subject=${getQueryParam('subject')}&topic=${getQueryParam('topic')}`;
}

document.addEventListener('DOMContentLoaded', initTopic);
