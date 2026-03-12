let examQuestions = [];
let userAnswers = [];
let currentQuestionIndex = 0;
let timeRemaining = 0;
let timerInterval = null;
let examData = null;
let examStartTime = null;
let examEndTime = null;
let allData = null;

async function initFinalExam() {
  allData = await loadDataFromGitHub();
  setupExamModes();
}

function selectExamMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

  if (mode === 'multiple') {
    document.getElementById('multipleSubjectSetup').style.display = 'block';
    document.getElementById('singleSubjectSetup').style.display = 'none';
    setupMultipleSubjectMode();
  } else {
    document.getElementById('multipleSubjectSetup').style.display = 'none';
    document.getElementById('singleSubjectSetup').style.display = 'block';
    setupSingleSubjectMode();
  }
}

function setupExamModes() {
  const multiSubjectSelect = document.getElementById('multiSubjectSelect');
  const singleSubjectSelect = document.getElementById('singleSubjectSelect');

  allData.subjects?.forEach(subject => {
    const option1 = document.createElement('option');
    option1.value = subject.id;
    option1.textContent = subject.name;
    multiSubjectSelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = subject.id;
    option2.textContent = subject.name;
    singleSubjectSelect.appendChild(option2);
  });

  singleSubjectSelect.addEventListener('change', () => {
    const subjectId = singleSubjectSelect.value;
    if (subjectId) {
      showTopicsForSubject(subjectId);
    }
  });
}

function setupMultipleSubjectMode() {}

function setupSingleSubjectMode() {
  const subjectId = document.getElementById('singleSubjectSelect').value;
  if (subjectId) {
    showTopicsForSubject(subjectId);
  }
}

function showTopicsForSubject(subjectId) {
  const subject = allData.subjects?.find(s => s.id === subjectId);
  const container = document.getElementById('topicsChecklist');
  const checklistContainer = document.getElementById('topicsChecklistContainer');

  container.innerHTML = '';
  subject?.topics?.forEach(topic => {
    const checkbox = document.createElement('div');
    checkbox.className = 'topic-checkbox';
    checkbox.innerHTML = `
      <input type="checkbox" value="${topic.id}" class="topic-select" onchange="updateStartButton()">
      <label>${topic.name}</label>
    `;
    container.appendChild(checkbox);
  });

  checklistContainer.style.display = 'block';
  updateStartButton();
}

function updateStartButton() {
  const selected = document.querySelectorAll('.topic-select:checked');
  const btn = document.getElementById('startSingleBtn');
  btn.style.display = selected.length > 0 ? 'block' : 'none';
}

async function startMultipleSubjectExam() {
  const subjectId = document.getElementById('multiSubjectSelect').value;
  const difficulty = document.getElementById('multiDifficulty').value;
  const questionCount = parseInt(document.getElementById('multiQuestionCount').value);
  const timeLimit = parseInt(document.getElementById('multiTimeLimit').value);

  await prepareExamQuestions(subjectId, null, difficulty, questionCount, timeLimit, 'All Subjects');
}

async function startSingleSubjectExam() {
  const subjectId = document.getElementById('singleSubjectSelect').value;
  const selectedTopics = Array.from(document.querySelectorAll('.topic-select:checked')).map(cb => cb.value);

  if (selectedTopics.length === 0) {
    alert('Please select at least one topic');
    return;
  }

  const difficulty = document.getElementById('singleDifficulty').value;
  const questionCount = parseInt(document.getElementById('singleQuestionCount').value);
  const timeLimit = parseInt(document.getElementById('singleTimeLimit').value);

  await prepareExamQuestions(subjectId, selectedTopics, difficulty, questionCount, timeLimit, 'Single Subject');
}

async function prepareExamQuestions(subjectId, topicIds, difficulty, questionCount, timeLimit, examMode) {
  let questions = [];

  const subject = allData.subjects?.find(s => s.id === subjectId);

  for (const topic of (subject?.topics || [])) {
    if (topicIds && !topicIds.includes(topic.id)) continue;

    const topicData = await loadTopicQuestions(subject.id, topic.id);
    let topicQuestions = topicData.questions || [];

    if (difficulty !== 'all') {
      topicQuestions = topicQuestions.filter(q => q.difficulty === difficulty);
    }

    questions.push(...topicQuestions);
  }

  if (questions.length === 0) {
    alert('No questions found with the selected criteria');
    return;
  }

  examQuestions = getRandomElements(questions, questionCount);
  userAnswers = new Array(examQuestions.length).fill(null);

  examData = {
    mode: examMode,
    subject: subject?.name,
    timeLimit,
    questionCount: examQuestions.length
  };

  displayExamScreen();
}

function displayExamScreen() {
  document.getElementById('examSetupScreen').style.display = 'none';
  document.getElementById('examScreen').style.display = 'block';

  document.getElementById('examTitle').textContent = `Final Exam - ${examData.mode}`;

  if (examData.timeLimit > 0) {
    timeRemaining = examData.timeLimit * 60;
    startTimer();
  }

  examStartTime = new Date();
  displayQuestion();
  setupExamNavigation();
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      submitExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById('timeDisplay').textContent = formatTime(timeRemaining);
}

function displayQuestion() {
  const question = examQuestions[currentQuestionIndex];

  document.getElementById('examProgress').textContent = `Question ${currentQuestionIndex + 1} of ${examQuestions.length}`;

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

  renderExamOptions(question);
  updateExamProgressBar();
  updateExamNavigationButtons();
}

function renderExamOptions(question) {
  const container = document.getElementById('optionsContainer');
  container.innerHTML = '';

  if (Array.isArray(question.options)) {
    question.options.forEach((option, idx) => {
      const label = String.fromCharCode(65 + idx);
      const optionEl = document.createElement('div');
      optionEl.className = 'quiz-option' + (userAnswers[currentQuestionIndex] === idx ? ' selected' : '');
      optionEl.textContent = `${label}. ${option}`;
      optionEl.onclick = () => selectExamAnswer(idx);
      container.appendChild(optionEl);
    });
  }
}

function selectExamAnswer(idx) {
  userAnswers[currentQuestionIndex] = idx;
  renderExamOptions(examQuestions[currentQuestionIndex]);
}

function nextExamQuestion() {
  if (currentQuestionIndex < examQuestions.length - 1) {
    currentQuestionIndex++;
    displayQuestion();
  }
}

function previousExamQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion();
  }
}

function updateExamProgressBar() {
  const progress = ((currentQuestionIndex + 1) / examQuestions.length) * 100;
  document.getElementById('progressBar').style.width = progress + '%';
}

function updateExamNavigationButtons() {
  document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
  document.getElementById('nextBtn').disabled = currentQuestionIndex === examQuestions.length - 1;

  const submitBtn = document.getElementById('submitBtn');
  if (currentQuestionIndex === examQuestions.length - 1) {
    submitBtn.style.display = 'block';
    document.getElementById('nextBtn').style.display = 'none';
  } else {
    submitBtn.style.display = 'none';
    document.getElementById('nextBtn').style.display = 'block';
  }
}

function submitExam() {
  examEndTime = new Date();
  if (timerInterval) clearInterval(timerInterval);

  const score = calculateScore(userAnswers, examQuestions);
  const timeTaken = Math.round((examEndTime - examStartTime) / 1000);

  document.getElementById('scorePercentage').textContent = score.percentage + '%';
  document.getElementById('correctCount').textContent = score.correct;
  document.getElementById('totalCount').textContent = score.total;
  document.getElementById('timeTaken').textContent = formatTime(timeTaken);

  if (score.percentage >= 80) {
    document.getElementById('scoreMessage').textContent = 'Outstanding! You passed the exam!';
  } else if (score.percentage >= 60) {
    document.getElementById('scoreMessage').textContent = 'Good effort! Review weak areas.';
  } else {
    document.getElementById('scoreMessage').textContent = 'Review the material and try again.';
  }

  document.getElementById('resultsModal').style.display = 'flex';
}

function reviewExamAnswers() {
  sessionStorage.setItem('examReview', JSON.stringify({
    questions: examQuestions,
    userAnswers: userAnswers
  }));
  window.location.href = 'exam-review.html';
}

function setupExamNavigation() {
  document.getElementById('nextBtn').onclick = nextExamQuestion;
  document.getElementById('prevBtn').onclick = previousExamQuestion;
  document.getElementById('submitBtn').onclick = submitExam;
  document.getElementById('exitExamBtn').onclick = () => {
    if (confirm('Are you sure? Your progress will be lost.')) {
      if (timerInterval) clearInterval(timerInterval);
      window.location.href = 'index.html';
    }
  };
}

document.addEventListener('DOMContentLoaded', initFinalExam);
