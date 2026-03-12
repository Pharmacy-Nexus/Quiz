let questions = [];
let currentQuestionIndex = 0;
let answered = false;

async function initStudy() {
  const subjectId = getQueryParam('subject');
  const topicId = getQueryParam('topic');

  if (!subjectId || !topicId) {
    window.location.href = 'index.html';
    return;
  }

  const topicData = await loadTopicQuestions(subjectId, topicId);
  questions = topicData.questions || [];

  if (questions.length === 0) {
    document.querySelector('.study-container').innerHTML = '<div class="loading">No questions available for this topic</div>';
    return;
  }

  const data = await loadDataFromGitHub();
  const subject = data.subjects?.find(s => s.id === subjectId);
  const topic = subject?.topics?.find(t => t.id === topicId);

  document.getElementById('topicDisplay').textContent = `${subject?.name} - ${topic?.name}`;

  displayQuestion();
  setupNavigation();
}

function displayQuestion() {
  const question = questions[currentQuestionIndex];

  document.getElementById('progressDisplay').textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;

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

  renderOptions(question);

  answered = false;
  document.getElementById('answerBlock').style.display = 'none';
  document.getElementById('revealBtn').style.display = 'block';
  document.getElementById('revealBtn').textContent = 'Reveal Answer';

  updateNavigationButtons();
}

function renderOptions(question) {
  const container = document.getElementById('optionsContainer');
  container.innerHTML = '';

  if (Array.isArray(question.options)) {
    question.options.forEach((option, idx) => {
      const label = String.fromCharCode(65 + idx);
      const optionEl = document.createElement('label');
      optionEl.className = 'option';
      optionEl.innerHTML = `
        <input type="radio" name="answer" value="${idx}">
        <span>${label}. ${option}</span>
      `;
      container.appendChild(optionEl);
    });
  }
}

function revealAnswer() {
  const question = questions[currentQuestionIndex];
  const correctAnswer = String.fromCharCode(65 + question.correctAnswer);
  const option = question.options[question.correctAnswer];

  document.getElementById('correctAnswerDisplay').textContent = `${correctAnswer}. ${option}`;
  document.getElementById('explanationDisplay').textContent = question.explanation || 'No explanation available';

  document.getElementById('answerBlock').style.display = 'block';
  document.getElementById('revealBtn').textContent = 'Answer Revealed';
  document.getElementById('revealBtn').disabled = true;

  answered = true;
}

function nextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
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

function setupNavigation() {
  document.getElementById('revealBtn').addEventListener('click', revealAnswer);
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
  document.getElementById('prevBtn').addEventListener('click', previousQuestion);
}

function updateNavigationButtons() {
  document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
  document.getElementById('nextBtn').disabled = currentQuestionIndex === questions.length - 1;

  if (currentQuestionIndex === questions.length - 1) {
    document.getElementById('nextBtn').textContent = 'Finished';
  } else {
    document.getElementById('nextBtn').textContent = 'Next';
  }
}

document.addEventListener('DOMContentLoaded', initStudy);
