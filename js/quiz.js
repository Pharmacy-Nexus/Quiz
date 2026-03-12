let quizData = null;
let quizQuestions = [];
let userAnswers = [];
let currentQuestionIndex = 0;
let timeRemaining = 0;
let timerInterval = null;
let quizStartTime = null;
let quizEndTime = null;

async function initQuiz() {
  const quizId = getQueryParam('quizId');
  if (!quizId) {
    window.location.href = 'index.html';
    return;
  }

  const data = await loadDataFromGitHub();
  quizData = data.quizSets?.find(q => q.id === quizId);

  if (!quizData) {
    document.querySelector('.quiz-container').innerHTML = '<div class="loading">Quiz not found</div>';
    return;
  }

  await loadQuizQuestions();
  setupQuiz();
  displayQuestion();
}

async function loadQuizQuestions() {
  const subjectId = quizData.subject;
  const topicId = quizData.topic;

  const topicData = await loadTopicQuestions(subjectId, topicId);
  const allQuestions = topicData.questions || [];

  quizQuestions = allQuestions.filter(q => quizData.questionIds?.includes(q.id));

  userAnswers = new Array(quizQuestions.length).fill(null);
}

function setupQuiz() {
  document.getElementById('quizName').textContent = quizData.name;

  if (quizData.timeLimit) {
    timeRemaining = quizData.timeLimit * 60;
    document.getElementById('timerContainer').style.display = 'block';
    startTimer();
  }

  setupNavigation();
  quizStartTime = new Date();
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById('timeDisplay').textContent = formatTime(timeRemaining);
}

function displayQuestion() {
  const question = quizQuestions[currentQuestionIndex];

  document.getElementById('quizProgress').textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;

  document.getElementById('difficultyBadge').className = 'difficulty ' + question.difficulty?.toLowerCase();
  document.getElementById('difficultyBadge').textContent = question.difficulty;

  document.getElementById('typeBadge').textContent = question.type;
  document.getElementById('questionText').textContent = question.question;

  if (question.caseScenario) {
    document.getElementById('caseScenario').textContent = question.caseScenario;
    document.getElementById('caseScenarioContainer').style.display = 'block';
  } else {
    document.getElementById('caseScenarioContainer').style.display = 'none';
  }

  if (question.imageUrl) {
    document.getElementById('questionImage').src = question.imageUrl;
    document.getElementById('imageContainer').style.display = 'block';
  } else {
    document.getElementById('imageContainer').style.display = 'none';
  }

  renderQuizOptions(question);
  updateProgressBar();
  updateNavigationButtons();
}

function renderQuizOptions(question) {
  const container = document.getElementById('optionsContainer');
  container.innerHTML = '';

  if (Array.isArray(question.options)) {
    question.options.forEach((option, idx) => {
      const label = String.fromCharCode(65 + idx);
      const optionEl = document.createElement('div');
      optionEl.className = 'quiz-option' + (userAnswers[currentQuestionIndex] === idx ? ' selected' : '');
      optionEl.textContent = `${label}. ${option}`;
      optionEl.onclick = () => selectAnswer(idx);
      container.appendChild(optionEl);
    });
  }
}

function selectAnswer(idx) {
  userAnswers[currentQuestionIndex] = idx;
  renderQuizOptions(quizQuestions[currentQuestionIndex]);
}

function nextQuestion() {
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++;
    displayQuestion();
  }
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion();
  }
}

function updateProgressBar() {
  const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
  document.getElementById('progressBar').style.width = progress + '%';
}

function updateNavigationButtons() {
  document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
  document.getElementById('nextBtn').disabled = currentQuestionIndex === quizQuestions.length - 1;

  const submitBtn = document.getElementById('submitBtn');
  if (currentQuestionIndex === quizQuestions.length - 1) {
    submitBtn.style.display = 'block';
    document.getElementById('nextBtn').style.display = 'none';
  } else {
    submitBtn.style.display = 'none';
    document.getElementById('nextBtn').style.display = 'block';
  }
}

function submitQuiz() {
  quizEndTime = new Date();
  clearInterval(timerInterval);

  const score = calculateScore(userAnswers, quizQuestions);

  document.getElementById('scorePercentage').textContent = score.percentage + '%';
  document.getElementById('correctCount').textContent = score.correct;
  document.getElementById('totalCount').textContent = score.total;

  if (score.percentage >= 80) {
    document.getElementById('scoreMessage').textContent = 'Excellent performance!';
  } else if (score.percentage >= 60) {
    document.getElementById('scoreMessage').textContent = 'Good effort! Keep practicing.';
  } else {
    document.getElementById('scoreMessage').textContent = 'Review the material and try again.';
  }

  document.getElementById('resultsModal').style.display = 'flex';
}

function reviewAnswers() {
  sessionStorage.setItem('quizReview', JSON.stringify({
    questions: quizQuestions,
    userAnswers: userAnswers
  }));
  window.location.href = 'quiz-review.html?quizId=' + getQueryParam('quizId');
}

function returnHome() {
  window.location.href = 'index.html';
}

function setupNavigation() {
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
  document.getElementById('prevBtn').addEventListener('click', previousQuestion);
  document.getElementById('submitBtn').addEventListener('click', submitQuiz);
  document.getElementById('exitQuizBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the quiz?')) {
      if (timerInterval) clearInterval(timerInterval);
      window.history.back();
    }
  });
}

document.addEventListener('DOMContentLoaded', initQuiz);
