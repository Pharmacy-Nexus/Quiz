function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-');
}

function generateId() {
  return 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getQueryParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

function setQueryParam(key, value) {
  const params = new URLSearchParams(window.location.search);
  params.set(key, value);
  window.history.replaceState({}, '', `?${params.toString()}`);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getGithubToken() {
  return localStorage.getItem('github_token');
}

function setGithubToken(token) {
  localStorage.setItem('github_token', token);
}

function clearGithubToken() {
  localStorage.removeItem('github_token');
}

function isAdminAuthenticated() {
  return !!getGithubToken();
}

function calculateDifficulty(questions) {
  const breakdown = { Easy: 0, Medium: 0, Hard: 0 };
  questions.forEach(q => {
    if (breakdown.hasOwnProperty(q.difficulty)) {
      breakdown[q.difficulty]++;
    }
  });
  return breakdown;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

async function fetchJSON(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching JSON:', error);
    return null;
  }
}

function renderDifficultyBadge(difficulty) {
  const className = difficulty.toLowerCase();
  return `<span class="difficulty ${className}">${difficulty}</span>`;
}

function renderQuestionCard(question) {
  let html = `
    <div class="question-card">
      <div class="question-card-header">
        <div>
          <div class="question-card-meta">
            <span>${question.subject}</span>
            <span>•</span>
            <span>${question.topic}</span>
            <span>•</span>
            ${renderDifficultyBadge(question.difficulty)}
          </div>
        </div>
        <span class="question-type">${question.type}</span>
      </div>
      <div class="question-card-text">${question.question}</div>
  `;

  if (question.imageUrl) {
    html += `<img src="${question.imageUrl}" alt="Question" class="question-image" style="max-width: 100%; margin: 1rem 0;">`;
  }

  html += `<div class="question-card-options">`;

  if (Array.isArray(question.options)) {
    question.options.forEach((option, idx) => {
      const isCorrect = idx === question.correctAnswer;
      const checkmark = isCorrect ? '✓' : '';
      html += `<div class="option-item">${String.fromCharCode(65 + idx)}) ${option} ${checkmark}</div>`;
    });
  }

  html += `</div>`;

  if (question.explanation) {
    html += `
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--neutral-200);">
        <p><strong>Explanation:</strong> ${question.explanation}</p>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

function calculateScore(answers, questions) {
  let correct = 0;
  answers.forEach((answer, idx) => {
    if (answer === questions[idx].correctAnswer) {
      correct++;
    }
  });
  return { correct, total: answers.length, percentage: Math.round((correct / answers.length) * 100) };
}
