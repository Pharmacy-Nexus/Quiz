(function () {
  'use strict';

const adminState = {
  topics: [],
  questions: [],
  selectedTopicId: '',
  editingTopicId: null,
  editingQuestionId: null,
  searchTerm: '',
  filterType: 'all',
  filterDifficulty: 'all',
  selectedQuestionTopicId: '',
  bulkDefaultType: 'mcq'
};

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderAdminPage() {
    const root = InternCore.qs('#internPageRoot');

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>Intern Admin Panel</h2>
          <p>Press <strong>Ctrl + Shift + 9</strong> from any intern page to open this panel.</p>
        </div>
      </section>

      <section class="analysis-grid">
        <article class="card">
          <h3 style="margin-top:0;">Topic Manager</h3>
          <div class="meta-row">
            <span class="badge" id="topicFormModeBadge">Create Topic</span>
          </div>

          <div class="input-row two">
            <div>
              <label class="muted">Topic title</label>
              <input class="input" id="adminTopicTitle" placeholder="e.g. Hypertension" />
            </div>
            <div>
              <label class="muted">Slug</label>
              <input class="input" id="adminTopicSlug" placeholder="auto-generated or custom" />
            </div>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Description</label>
            <textarea class="textarea" id="adminTopicDescription" placeholder="Short topic description"></textarea>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Section name</label>
            <input class="input" id="adminTopicSection" list="adminTopicSectionsList" placeholder="e.g. Clinical Core, CVS, Endocrine..." />
            <datalist id="adminTopicSectionsList"></datalist>
          </div>

          <div class="input-row two" style="margin-top:16px;">
            <div>
              <label class="muted">Sort order</label>
              <input class="input" id="adminTopicSortOrder" type="number" value="0" />
            </div>
            <div>
              <label class="muted">Status</label>
              <select class="select" id="adminTopicStatus">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div id="adminTopicMessage"></div>

          <div class="action-row" style="justify-content:flex-start;">
            <button class="btn btn-primary" id="saveTopicBtn" type="button">Save Topic</button>
            <button class="btn btn-light hidden" id="cancelTopicEditBtn" type="button">Cancel Edit</button>
          </div>
        </article>

        <article class="card">
          <h3 style="margin-top:0;">Question Manager</h3>
          <div class="meta-row">
            <span class="badge" id="questionFormModeBadge">Create Question</span>
          </div>

          <div class="input-row two">
            <div>
              <label class="muted">Topic</label>
              <select class="select" id="adminQuestionTopic"></select>
            </div>
            <div>
              <label class="muted">Question type</label>
              <select class="select" id="adminQuestionType">
                <option value="mcq">MCQ</option>
                <option value="true_false">True / False</option>
                <option value="image_mcq">Image with MCQ</option>
                <option value="case">Case</option>
              </select>
            </div>
          </div>

          <div class="input-row two" style="margin-top:16px;">
            <div>
              <label class="muted">Difficulty</label>
              <select class="select" id="adminQuestionDifficulty">
                <option value="easy">Easy</option>
                <option value="medium" selected>Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label class="muted">Status</label>
              <select class="select" id="adminQuestionStatus">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Question text</label>
            <textarea class="textarea" id="adminQuestionText" placeholder="Write the question here"></textarea>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Case text (optional)</label>
            <textarea class="textarea" id="adminCaseText" placeholder="Case scenario if question type is case"></textarea>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Image URL (optional)</label>
            <input class="input" id="adminImageUrl" placeholder="https://..." />
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Explanation</label>
            <textarea class="textarea" id="adminExplanation" placeholder="Explain why the correct answer is right"></textarea>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Summary</label>
            <textarea class="textarea" id="adminSummary" placeholder="Short summary for quick review"></textarea>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Options</label>
            <div class="input-row two">
              <input class="input admin-option-input" data-index="0" placeholder="Option 1" />
              <input class="input admin-option-input" data-index="1" placeholder="Option 2" />
              <input class="input admin-option-input" data-index="2" placeholder="Option 3" />
              <input class="input admin-option-input" data-index="3" placeholder="Option 4" />
            </div>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Correct option</label>
            <select class="select" id="adminCorrectOption">
              <option value="0">Option 1</option>
              <option value="1">Option 2</option>
              <option value="2">Option 3</option>
              <option value="3">Option 4</option>
            </select>
          </div>

          <div id="adminQuestionMessage"></div>

          <div class="action-row" style="justify-content:flex-start;">
            <button class="btn btn-primary" id="saveQuestionBtn" type="button">Save Question</button>
            <button class="btn btn-light hidden" id="cancelQuestionEditBtn" type="button">Cancel Edit</button>
          </div>
        </article>
      </section>

      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Bulk Upload Questions</h2>
            <p>Paste CSV rows here to create many questions at once without changing the current manual workflow.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="input-row three">
            <div>
              <label class="muted">Topic</label>
              <select class="select" id="adminBulkTopic"></select>
            </div>
            <div>
              <label class="muted">Default question type</label>
              <select class="select" id="adminBulkType">
                <option value="mcq">MCQ</option>
                <option value="true_false">True / False</option>
                <option value="image_mcq">Image with MCQ</option>
                <option value="case">Case</option>
              </select>
            </div>
            <div>
              <label class="muted">CSV header</label>
              <input class="input" value="question_text,difficulty,case_text,image_url,explanation,summary,is_active,option_1,option_2,option_3,option_4,correct_option[,type]" readonly />
            </div>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Paste CSV content</label>
            <textarea class="textarea" id="adminBulkCsv" style="min-height:240px;" placeholder='question_text,difficulty,case_text,image_url,explanation,summary,is_active,option_1,option_2,option_3,option_4,correct_option
What is the first-line treatment for hypertension?,medium,,,ACE inhibitors are commonly preferred...,ACEI summary,true,Lisinopril,Atenolol,Furosemide,Clonidine,1'></textarea>
          </div>

          <div class="meta-row" style="margin-top:12px;">
            <span class="tag">correct_option uses 1 to 4</span>
            <span class="tag">type column is optional</span>
            <span class="tag">true_false rows may use only first 2 options</span>
          </div>

          <div id="adminBulkMessage" style="margin-top:16px;"></div>

          <div class="action-row" style="justify-content:flex-start;">
            <button class="btn btn-primary" id="adminBulkUploadBtn" type="button">Upload Bulk Questions</button>
            <button class="btn btn-light" id="adminBulkClearBtn" type="button">Clear CSV</button>
          </div>
        </div>
      </section>


      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Real Exam Recall Bulk Upload</h2>
            <p>Upload mixed recall questions without assigning a topic. These questions go directly to the Real Exam Recall Bank.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="input-row two">
            <div>
              <label class="muted">Default question type</label>
              <select class="select" id="adminRecallBulkType">
                <option value="mcq">MCQ</option>
                <option value="true_false">True / False</option>
                <option value="image_mcq">Image with MCQ</option>
                <option value="case">Case</option>
              </select>
            </div>
            <div>
              <label class="muted">CSV header</label>
              <input class="input" value="question_text,difficulty,case_text,image_url,explanation,summary,is_active,option_1,option_2,option_3,option_4,correct_option[,type]" readonly />
            </div>
          </div>

          <div style="margin-top:16px;">
            <label class="muted">Paste CSV content</label>
            <textarea class="textarea" id="adminRecallBulkCsv" style="min-height:240px;" placeholder='question_text,difficulty,case_text,image_url,explanation,summary,is_active,option_1,option_2,option_3,option_4,correct_option
A patient misses a warfarin monitoring visit,medium,,,Follow-up is required...,INR follow-up pearl,true,Continue and review later,Ignore the issue,Stop all therapy,Increase dose immediately,1'></textarea>
          </div>

          <div class="meta-row" style="margin-top:12px;">
            <span class="tag">No topic required</span>
            <span class="tag">Stored in Real Exam Recall Bank</span>
            <span class="tag">Mixed exam use</span>
          </div>

          <div id="adminRecallBulkMessage" style="margin-top:16px;"></div>

          <div class="action-row" style="justify-content:flex-start;">
            <button class="btn btn-primary" id="adminRecallBulkUploadBtn" type="button">Upload Recall Questions</button>
            <button class="btn btn-light" id="adminRecallBulkClearBtn" type="button">Clear CSV</button>
          </div>
        </div>
      </section>

      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Current Topics</h2>
            <p>Quick overview of the topics currently stored in the database.</p>
          </div>
        </div>
        <div id="adminTopicsList"></div>
      </section>

      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Questions Browser</h2>
            <p>Choose a topic, then search and filter questions.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="input-row two">
            <div>
              <label class="muted">Browse by topic</label>
              <select class="select" id="adminBrowseTopic"></select>
            </div>
            <div style="display:flex; align-items:flex-end;">
              <button class="btn btn-dark" id="loadQuestionsBtn" type="button">Load Questions</button>
            </div>
          </div>

          <div class="input-row three" style="margin-top:16px;">
            <div>
              <label class="muted">Search question text</label>
              <input class="input" id="adminQuestionSearch" placeholder="Search..." />
            </div>
            <div>
              <label class="muted">Filter by type</label>
              <select class="select" id="adminFilterType">
                <option value="all">All types</option>
                <option value="mcq">MCQ</option>
                <option value="true_false">True / False</option>
                <option value="image_mcq">Image with MCQ</option>
                <option value="case">Case</option>
              </select>
            </div>
            <div>
              <label class="muted">Filter by difficulty</label>
              <select class="select" id="adminFilterDifficulty">
                <option value="all">All difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div id="adminQuestionsMessage"></div>
        </div>

        <div id="adminQuestionsList"></div>
      </section>
    `;
  }

  function resetTopicForm() {
    adminState.editingTopicId = null;
    InternCore.qs('#adminTopicTitle').value = '';
    InternCore.qs('#adminTopicSlug').value = '';
    InternCore.qs('#adminTopicSlug').dataset.userEdited = '';
    InternCore.qs('#adminTopicDescription').value = '';
    InternCore.qs('#adminTopicSection').value = '';
    InternCore.qs('#adminTopicSortOrder').value = '0';
    InternCore.qs('#adminTopicStatus').value = 'true';
    InternCore.qs('#topicFormModeBadge').textContent = 'Create Topic';
    InternCore.qs('#cancelTopicEditBtn').classList.add('hidden');
  }

  function resetQuestionForm() {
    adminState.editingQuestionId = null;
    InternCore.qs('#adminQuestionText').value = '';
    InternCore.qs('#adminCaseText').value = '';
    InternCore.qs('#adminImageUrl').value = '';
    InternCore.qs('#adminExplanation').value = '';
    InternCore.qs('#adminSummary').value = '';
    InternCore.qs('#adminQuestionType').value = 'mcq';
    InternCore.qs('#adminQuestionDifficulty').value = 'medium';
    InternCore.qs('#adminQuestionStatus').value = 'true';
    InternCore.qs('#adminCorrectOption').value = '0';
    InternCore.qsa('.admin-option-input').forEach((input) => { input.value = ''; });
    InternCore.qs('#questionFormModeBadge').textContent = 'Create Question';
    InternCore.qs('#cancelQuestionEditBtn').classList.add('hidden');
    updateQuestionFormByType();
  }

  function fillTopicForm(topic) {
    adminState.editingTopicId = topic.id;
    InternCore.qs('#adminTopicTitle').value = topic.title || '';
    InternCore.qs('#adminTopicSlug').value = topic.slug || '';
    InternCore.qs('#adminTopicSlug').dataset.userEdited = 'true';
    InternCore.qs('#adminTopicDescription').value = topic.description || '';
    InternCore.qs('#adminTopicSection').value = topic.section || '';
    InternCore.qs('#adminTopicSortOrder').value = topic.sort_order ?? 0;
    InternCore.qs('#adminTopicStatus').value = String(!!topic.is_active);
    InternCore.qs('#topicFormModeBadge').textContent = 'Edit Topic';
    InternCore.qs('#cancelTopicEditBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillQuestionForm(question) {
    adminState.editingQuestionId = question.id;
    InternCore.qs('#adminQuestionTopic').value = question.topic_id;
    InternCore.qs('#adminQuestionType').value = question.type || 'mcq';
    InternCore.qs('#adminQuestionDifficulty').value = question.difficulty || 'medium';
    InternCore.qs('#adminQuestionStatus').value = String(!!question.is_active);
    InternCore.qs('#adminQuestionText').value = question.question_text || '';
    InternCore.qs('#adminCaseText').value = question.case_text || '';
    InternCore.qs('#adminImageUrl').value = question.image_url || '';
    InternCore.qs('#adminExplanation').value = question.explanation || '';
    InternCore.qs('#adminSummary').value = question.summary || '';

    const inputs = InternCore.qsa('.admin-option-input');
    inputs.forEach((input) => { input.value = ''; });

    (question.options || []).forEach((option, index) => {
      if (inputs[index]) inputs[index].value = option.text || '';
    });

    updateQuestionFormByType();

    const correctIndex = Math.max(
      0,
      (question.options || []).findIndex((option) => option.is_correct)
    );

    InternCore.qs('#adminCorrectOption').value = String(correctIndex >= 0 ? correctIndex : 0);
    InternCore.qs('#questionFormModeBadge').textContent = 'Edit Question';
    InternCore.qs('#cancelQuestionEditBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateQuestionFormByType() {
    const type = InternCore.qs('#adminQuestionType')?.value;
    const optionInputs = InternCore.qsa('.admin-option-input');

    if (type === 'true_false') {
      optionInputs.forEach((input, index) => {
        if (index === 0) input.value = 'True';
        if (index === 1) input.value = 'False';
        if (index > 1) input.value = '';
        input.disabled = index > 1;
      });

      InternCore.qs('#adminCorrectOption').innerHTML = `
        <option value="0">True</option>
        <option value="1">False</option>
      `;
    } else {
      optionInputs.forEach((input, index) => {
        input.disabled = false;
        input.placeholder = `Option ${index + 1}`;
      });

      InternCore.qs('#adminCorrectOption').innerHTML = `
        <option value="0">Option 1</option>
        <option value="1">Option 2</option>
        <option value="2">Option 3</option>
        <option value="3">Option 4</option>
      `;
    }
  }

  function drawTopicsList() {
  const container = InternCore.qs('#adminTopicsList');
  const topicSelect = InternCore.qs('#adminQuestionTopic');
  const browseSelect = InternCore.qs('#adminBrowseTopic');
  const bulkTopicSelect = InternCore.qs('#adminBulkTopic');

  const optionsHtml = adminState.topics.length
    ? adminState.topics.map((topic) => `
        <option value="${topic.id}">${escapeHtml(topic.title)}</option>
      `).join('')
    : '<option value="">No topics found</option>';

  if (topicSelect) {
    topicSelect.innerHTML = optionsHtml;

    if (adminState.selectedQuestionTopicId) {
      topicSelect.value = adminState.selectedQuestionTopicId;
    }
  }

  if (browseSelect) {
    browseSelect.innerHTML = optionsHtml;
  }

  const sectionList = InternCore.qs('#adminTopicSectionsList');
  if (sectionList) {
    const sections = Array.from(new Set(
      adminState.topics
        .map((topic) => String(topic.section || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
    sectionList.innerHTML = sections.map((section) => `<option value="${escapeHtml(section)}"></option>`).join('');
  }

  if (bulkTopicSelect) {
    bulkTopicSelect.innerHTML = optionsHtml;

    if (adminState.selectedQuestionTopicId) {
      bulkTopicSelect.value = adminState.selectedQuestionTopicId;
    }
  }

  if (adminState.selectedTopicId && browseSelect) {
    browseSelect.value = adminState.selectedTopicId;
  }

  if (!container) return;

  if (!adminState.topics.length) {
    container.innerHTML = `<div class="intern-empty">No topics found yet.</div>`;
    return;
  }

    container.innerHTML = `
      <div class="review-list">
        ${adminState.topics.map((topic) => `
          <article class="review-card">
            <div class="question-top">
              <div>
                <div class="meta-row">
                  <span class="badge">${topic.is_active ? 'Active' : 'Inactive'}</span>
                  <span class="tag">Sort: ${topic.sort_order}</span>
                  <span class="tag">${escapeHtml(topic.slug)}</span>
                  <span class="tag">${escapeHtml(topic.section || 'Other')}</span>
                  <span class="tag">${topic.questions_count} Questions</span>
                </div>
                <h3 style="margin:10px 0 8px;">${escapeHtml(topic.title)}</h3>
                <div class="muted">${escapeHtml(topic.description || 'No description provided.')}</div>
              </div>
              <div class="small-actions">
                <button class="small-btn admin-edit-topic-btn" data-topic-id="${topic.id}" type="button">Edit Topic</button>
                <button class="small-btn danger admin-delete-topic-btn" data-topic-id="${topic.id}" data-topic-title="${escapeHtml(topic.title)}" type="button">Delete Topic</button>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    InternCore.qsa('.admin-edit-topic-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const topic = adminState.topics.find((item) => item.id === btn.dataset.topicId);
        if (topic) fillTopicForm(topic);
      });
    });

    InternCore.qsa('.admin-delete-topic-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const topicId = btn.dataset.topicId;
        const topicTitle = btn.dataset.topicTitle;
        const ok = window.confirm(`Delete topic "${topicTitle}"?\nThis will also delete its questions.`);
        if (!ok) return;

        try {
          await InternAPI.deleteTopic(topicId);
          await loadTopics();
          adminState.questions = [];
          drawQuestionsList();
          if (adminState.editingTopicId === topicId) resetTopicForm();
        } catch (error) {
          console.error(error);
          alert('Failed to delete topic.');
        }
      });
    });
  }

  function getFilteredQuestions() {
    return adminState.questions.filter((question) => {
      const matchesSearch = !adminState.searchTerm ||
        question.question_text.toLowerCase().includes(adminState.searchTerm.toLowerCase()) ||
        (question.explanation || '').toLowerCase().includes(adminState.searchTerm.toLowerCase()) ||
        (question.summary || '').toLowerCase().includes(adminState.searchTerm.toLowerCase());

      const matchesType =
        adminState.filterType === 'all' || question.type === adminState.filterType;

      const matchesDifficulty =
        adminState.filterDifficulty === 'all' || question.difficulty === adminState.filterDifficulty;

      return matchesSearch && matchesType && matchesDifficulty;
    });
  }

  function drawQuestionsList() {
    const container = InternCore.qs('#adminQuestionsList');

    if (!container) return;

    if (!adminState.selectedTopicId) {
      container.innerHTML = `<div class="intern-empty">Choose a topic first, then click Load Questions.</div>`;
      return;
    }

    const filteredQuestions = getFilteredQuestions();

    if (!filteredQuestions.length) {
      container.innerHTML = `<div class="intern-empty">No questions matched the current filters.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="review-list">
        ${filteredQuestions.map((question, index) => `
          <article class="review-card">
            <div class="question-top">
              <div>
                <div class="meta-row">
                  <span class="badge">${escapeHtml(question.type)}</span>
                  <span class="tag">${escapeHtml(question.difficulty)}</span>
                  <span class="tag">${question.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <h3 style="margin:10px 0 8px;">${index + 1}. ${escapeHtml(question.question_text)}</h3>
              </div>
              <div class="small-actions">
                <button class="small-btn admin-edit-question-btn" data-question-id="${question.id}" type="button">Edit Question</button>
                <button class="small-btn danger admin-delete-question-btn" data-question-id="${question.id}" type="button">Delete Question</button>
              </div>
            </div>

            ${question.case_text ? `
              <div class="case-box" style="margin-top:12px;">
                <strong>Case</strong>
                <div class="muted" style="margin-top:8px;">${escapeHtml(question.case_text)}</div>
              </div>
            ` : ''}

            ${question.image_url ? `
              <div class="review-answer"><strong>Image URL:</strong> ${escapeHtml(question.image_url)}</div>
            ` : ''}

            <div class="review-answer"><strong>Explanation:</strong> ${escapeHtml(question.explanation || '')}</div>
            <div class="review-answer"><strong>Summary:</strong> ${escapeHtml(question.summary || '')}</div>

            <div class="review-answer">
              <strong>Options:</strong>
              <div style="margin-top:10px;">
                ${(question.options || []).map((option) => `
                  <div class="metric-row" style="padding:8px 0;">
                    <span>${escapeHtml(option.text)}</span>
                    <strong>${option.is_correct ? 'Correct' : ''}</strong>
                  </div>
                `).join('')}
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    InternCore.qsa('.admin-edit-question-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const question = adminState.questions.find((item) => item.id === btn.dataset.questionId);
        if (question) fillQuestionForm(question);
      });
    });

    InternCore.qsa('.admin-delete-question-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const questionId = btn.dataset.questionId;
        const ok = window.confirm('Delete this question?');
        if (!ok) return;

        try {
          await InternAPI.deleteQuestion(questionId);
          await loadQuestionsByTopic(adminState.selectedTopicId);
          await loadTopics();
          if (adminState.editingQuestionId === questionId) resetQuestionForm();
        } catch (error) {
          console.error(error);
          alert('Failed to delete question.');
        }
      });
    });
  }

  async function loadTopics() {
    adminState.topics = await InternAPI.getAllTopics();
    drawTopicsList();
  }

  async function loadQuestionsByTopic(topicId) {
    adminState.selectedTopicId = topicId;
    adminState.questions = await InternAPI.getQuestionsByTopic(topicId);
    drawQuestionsList();
  }


  function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current);
    return cells.map((cell) => cell.trim());
  }

  function parseBulkCsv(text) {
    const lines = String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error('Please add a header row and at least one question row.');
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
    const rows = lines.slice(1).map((line, index) => {
      const cells = parseCsvLine(line);
      const row = { __rowNumber: index + 2 };

      headers.forEach((header, headerIndex) => {
        row[header] = cells[headerIndex] ?? '';
      });

      return row;
    });

    return { headers, rows };
  }

  function toBoolean(value, defaultValue = true) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return defaultValue;
  }

  function normalizeBulkRow(row, defaultType) {
    const type = String(row.type || defaultType || 'mcq').trim() || 'mcq';
    const difficulty = String(row.difficulty || 'medium').trim().toLowerCase() || 'medium';
    const questionText = String(row.question_text || '').trim();
    const caseText = String(row.case_text || '').trim();
    const imageUrl = String(row.image_url || '').trim();
    const explanation = String(row.explanation || '').trim();
    const summary = String(row.summary || '').trim();
    const isActive = toBoolean(row.is_active, true);
    const correctOption = Number(String(row.correct_option || '').trim());

    let optionValues = [
      String(row.option_1 || '').trim(),
      String(row.option_2 || '').trim(),
      String(row.option_3 || '').trim(),
      String(row.option_4 || '').trim()
    ].filter(Boolean);

    if (type === 'true_false') {
      optionValues = ['True', 'False'];
    }

    if (!questionText) {
      throw new Error(`Row ${row.__rowNumber}: question_text is required.`);
    }

    if (!['mcq', 'true_false', 'image_mcq', 'case'].includes(type)) {
      throw new Error(`Row ${row.__rowNumber}: type must be mcq, true_false, image_mcq, or case.`);
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new Error(`Row ${row.__rowNumber}: difficulty must be easy, medium, or hard.`);
    }

    if (optionValues.length < 2) {
      throw new Error(`Row ${row.__rowNumber}: at least 2 options are required.`);
    }

    if (!Number.isInteger(correctOption) || correctOption < 1 || correctOption > optionValues.length) {
      throw new Error(`Row ${row.__rowNumber}: correct_option must be a number from 1 to ${optionValues.length}.`);
    }

    const optionsPayload = optionValues.map((text, index) => ({
      option_text: text,
      is_correct: index === correctOption - 1,
      sort_order: index + 1
    }));

    return {
      rowNumber: row.__rowNumber,
      topicId: '',
      type,
      difficulty,
      questionText,
      caseText,
      imageUrl,
      explanation,
      summary,
      isActive,
      optionsPayload
    };
  }

  async function bindBulkUpload() {
    const uploadBtn = InternCore.qs('#adminBulkUploadBtn');
    const clearBtn = InternCore.qs('#adminBulkClearBtn');
    const csvInput = InternCore.qs('#adminBulkCsv');
    const msg = InternCore.qs('#adminBulkMessage');
    const topicSelect = InternCore.qs('#adminBulkTopic');
    const typeSelect = InternCore.qs('#adminBulkType');

    const recallUploadBtn = InternCore.qs('#adminRecallBulkUploadBtn');
    const recallClearBtn = InternCore.qs('#adminRecallBulkClearBtn');
    const recallCsvInput = InternCore.qs('#adminRecallBulkCsv');
    const recallMsg = InternCore.qs('#adminRecallBulkMessage');
    const recallTypeSelect = InternCore.qs('#adminRecallBulkType');

    typeSelect?.addEventListener('change', (event) => {
      adminState.bulkDefaultType = event.target.value;
    });

    recallTypeSelect?.addEventListener('change', (event) => {
      adminState.bulkDefaultType = event.target.value;
    });

    clearBtn?.addEventListener('click', () => {
      if (csvInput) csvInput.value = '';
      msg.innerHTML = '';
    });

    recallClearBtn?.addEventListener('click', () => {
      if (recallCsvInput) recallCsvInput.value = '';
      recallMsg.innerHTML = '';
    });

    uploadBtn?.addEventListener('click', async () => {
      const topicId = topicSelect?.value || '';
      const csvText = csvInput?.value || '';
      const defaultType = typeSelect?.value || 'mcq';

      if (!topicId) {
        msg.innerHTML = `<div class="message error">Please choose a topic for the bulk upload.</div>`;
        return;
      }

      if (!csvText.trim()) {
        msg.innerHTML = `<div class="message error">Please paste CSV content first.</div>`;
        return;
      }

      let parsedRows;
      try {
        const parsed = parseBulkCsv(csvText);
        parsedRows = parsed.rows.map((row) => {
          const normalized = normalizeBulkRow(row, defaultType);
          normalized.topicId = topicId;
          return normalized;
        });
      } catch (error) {
        msg.innerHTML = `<div class="message error">${escapeHtml(error.message)}</div>`;
        return;
      }

      const ok = window.confirm(`Upload ${parsedRows.length} questions to the selected topic?`);
      if (!ok) return;

      uploadBtn.disabled = true;
      clearBtn.disabled = true;
      msg.innerHTML = `<div class="message">Uploading ${parsedRows.length} questions...</div>`;

      const results = {
        uploaded: 0,
        failed: 0,
        errors: []
      };

      for (const row of parsedRows) {
        let createdQuestion = null;

        try {
          createdQuestion = await InternAPI.createQuestion({
            topicId: row.topicId,
            bankType: 'topic_bank',
            type: row.type,
            difficulty: row.difficulty,
            questionText: row.questionText,
            caseText: row.caseText,
            imageUrl: row.imageUrl,
            explanation: row.explanation,
            summary: row.summary,
            isActive: row.isActive
          });

          await InternAPI.createQuestionOptions(
            row.optionsPayload.map((option) => ({
              question_id: createdQuestion.id,
              option_text: option.option_text,
              is_correct: option.is_correct,
              sort_order: option.sort_order
            }))
          );

          results.uploaded += 1;
        } catch (error) {
          results.failed += 1;
          results.errors.push(`Row ${row.rowNumber}: ${error.message || 'Upload failed.'}`);

          if (createdQuestion?.id) {
            try {
              await InternAPI.deleteQuestion(createdQuestion.id);
            } catch (_) {}
          }
        }
      }

      uploadBtn.disabled = false;
      clearBtn.disabled = false;
      adminState.selectedQuestionTopicId = topicId;
      adminState.selectedTopicId = topicId;

      try {
        await loadTopics();
        await loadQuestionsByTopic(topicId);
      } catch (_) {}

      const browseSelect = InternCore.qs('#adminBrowseTopic');
      if (browseSelect) browseSelect.value = topicId;
      if (topicSelect) topicSelect.value = topicId;

      const reportParts = [
        `<div class="message success">Uploaded ${results.uploaded} question(s).${results.failed ? ` Failed: ${results.failed}.` : ''}</div>`
      ];

      if (results.errors.length) {
        reportParts.push(`
          <div class="message error" style="margin-top:12px;">
            <strong>Errors</strong>
            <div style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(results.errors.slice(0, 10).join('\n'))}</div>
            ${results.errors.length > 10 ? `<div style="margin-top:8px;">+ ${results.errors.length - 10} more error(s)</div>` : ''}
          </div>
        `);
      }

      msg.innerHTML = reportParts.join('');
    });

    recallUploadBtn?.addEventListener('click', async () => {
      const csvText = recallCsvInput?.value || '';
      const defaultType = recallTypeSelect?.value || 'mcq';

      if (!csvText.trim()) {
        recallMsg.innerHTML = `<div class="message error">Please paste CSV content first.</div>`;
        return;
      }

      let parsedRows;
      try {
        const parsed = parseBulkCsv(csvText);
        parsedRows = parsed.rows.map((row) => normalizeBulkRow(row, defaultType));
      } catch (error) {
        recallMsg.innerHTML = `<div class="message error">${escapeHtml(error.message)}</div>`;
        return;
      }

      const ok = window.confirm(`Upload ${parsedRows.length} recall question(s) to Real Exam Recall Bank?`);
      if (!ok) return;

      recallUploadBtn.disabled = true;
      recallClearBtn.disabled = true;
      recallMsg.innerHTML = `<div class="message">Uploading ${parsedRows.length} recall question(s)...</div>`;

      const results = {
        uploaded: 0,
        failed: 0,
        errors: []
      };

      for (const row of parsedRows) {
        let createdQuestion = null;

        try {
          createdQuestion = await InternAPI.createQuestion({
            topicId: null,
            bankType: 'real_exam_recall',
            type: row.type,
            difficulty: row.difficulty,
            questionText: row.questionText,
            caseText: row.caseText,
            imageUrl: row.imageUrl,
            explanation: row.explanation,
            summary: row.summary,
            isActive: row.isActive
          });

          await InternAPI.createQuestionOptions(
            row.optionsPayload.map((option) => ({
              question_id: createdQuestion.id,
              option_text: option.option_text,
              is_correct: option.is_correct,
              sort_order: option.sort_order
            }))
          );

          results.uploaded += 1;
        } catch (error) {
          results.failed += 1;
          results.errors.push(`Row ${row.rowNumber}: ${error.message || 'Upload failed.'}`);

          if (createdQuestion?.id) {
            try {
              await InternAPI.deleteQuestion(createdQuestion.id);
            } catch (_) {}
          }
        }
      }

      recallUploadBtn.disabled = false;
      recallClearBtn.disabled = false;

      const reportParts = [
        `<div class="message success">Uploaded ${results.uploaded} recall question(s).${results.failed ? ` Failed: ${results.failed}.` : ''}</div>`
      ];

      if (results.errors.length) {
        reportParts.push(`
          <div class="message error" style="margin-top:12px;">
            <strong>Errors</strong>
            <div style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(results.errors.slice(0, 10).join('\n'))}</div>
            ${results.errors.length > 10 ? `<div style="margin-top:8px;">+ ${results.errors.length - 10} more error(s)</div>` : ''}
          </div>
        `);
      }

      recallMsg.innerHTML = reportParts.join('');
    });
  }

  function bindTopicForm() {
    const titleInput = InternCore.qs('#adminTopicTitle');
    const slugInput = InternCore.qs('#adminTopicSlug');
    const saveBtn = InternCore.qs('#saveTopicBtn');
    const cancelBtn = InternCore.qs('#cancelTopicEditBtn');
    const msg = InternCore.qs('#adminTopicMessage');

    titleInput?.addEventListener('input', () => {
      if (!slugInput.dataset.userEdited) {
        slugInput.value = slugify(titleInput.value);
      }
    });

    slugInput?.addEventListener('input', () => {
      slugInput.dataset.userEdited = slugInput.value.trim() ? 'true' : '';
    });

    cancelBtn?.addEventListener('click', () => {
      resetTopicForm();
      msg.innerHTML = '';
    });

    saveBtn?.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const slug = slugInput.value.trim() || slugify(title);
      const description = InternCore.qs('#adminTopicDescription').value.trim();
      const section = InternCore.qs('#adminTopicSection').value.trim();
      const sortOrder = Number(InternCore.qs('#adminTopicSortOrder').value || '0');
      const isActive = InternCore.qs('#adminTopicStatus').value === 'true';

      if (!title) {
        msg.innerHTML = `<div class="message error">Topic title is required.</div>`;
        return;
      }

      if (!slug) {
        msg.innerHTML = `<div class="message error">Slug is required.</div>`;
        return;
      }

      try {
        if (adminState.editingTopicId) {
          await InternAPI.updateTopic(adminState.editingTopicId, {
            title,
            slug,
            description,
            section,
            sortOrder,
            isActive
          });
          msg.innerHTML = `<div class="message success">Topic updated successfully.</div>`;
        } else {
          await InternAPI.createTopic({
            title,
            slug,
            description,
            section,
            sortOrder,
            isActive
          });
          msg.innerHTML = `<div class="message success">Topic created successfully.</div>`;
        }

        resetTopicForm();
        await loadTopics();
      } catch (error) {
        console.error(error);
        msg.innerHTML = `<div class="message error">Failed to save topic.</div>`;
      }
    });
  }

function bindQuestionForm() {
  const saveBtn = InternCore.qs('#saveQuestionBtn');
  const cancelBtn = InternCore.qs('#cancelQuestionEditBtn');
  const msg = InternCore.qs('#adminQuestionMessage');
  const typeSelect = InternCore.qs('#adminQuestionType');
  const questionTopicSelect = InternCore.qs('#adminQuestionTopic');

  questionTopicSelect?.addEventListener('change', (event) => {
    adminState.selectedQuestionTopicId = event.target.value;
  });

  typeSelect?.addEventListener('change', updateQuestionFormByType);
  updateQuestionFormByType();

  cancelBtn?.addEventListener('click', () => {
    resetQuestionForm();
    msg.innerHTML = '';
  });

  saveBtn?.addEventListener('click', async () => {
    const topicId = InternCore.qs('#adminQuestionTopic').value;
    const type = InternCore.qs('#adminQuestionType').value;
    const difficulty = InternCore.qs('#adminQuestionDifficulty').value;
    const isActive = InternCore.qs('#adminQuestionStatus').value === 'true';
    const questionText = InternCore.qs('#adminQuestionText').value.trim();
    const caseText = InternCore.qs('#adminCaseText').value.trim();
    const imageUrl = InternCore.qs('#adminImageUrl').value.trim();
    const explanation = InternCore.qs('#adminExplanation').value.trim();
    const summary = InternCore.qs('#adminSummary').value.trim();
    const correctIndex = Number(InternCore.qs('#adminCorrectOption').value);

    let optionValues = InternCore.qsa('.admin-option-input').map((input) => input.value.trim());

    if (type === 'true_false') {
      optionValues = ['True', 'False'];
    }

    if (!topicId) {
      msg.innerHTML = `<div class="message error">Please select a topic.</div>`;
      return;
    }

    if (!questionText) {
      msg.innerHTML = `<div class="message error">Question text is required.</div>`;
      return;
    }

    const cleanedOptions = optionValues.filter(Boolean);

    if (cleanedOptions.length < 2) {
      msg.innerHTML = `<div class="message error">At least 2 options are required.</div>`;
      return;
    }

    if (correctIndex >= cleanedOptions.length) {
      msg.innerHTML = `<div class="message error">Correct option index does not match the filled options.</div>`;
      return;
    }

    try {
      let question;

      if (adminState.editingQuestionId) {
        question = await InternAPI.updateQuestion(adminState.editingQuestionId, {
          topicId,
          type,
          difficulty,
          questionText,
          caseText,
          imageUrl,
          explanation,
          summary,
          isActive
        });

        const optionsPayload = cleanedOptions.map((text, index) => ({
          question_id: question.id,
          option_text: text,
          is_correct: index === correctIndex,
          sort_order: index + 1
        }));

        await InternAPI.replaceQuestionOptions(question.id, optionsPayload);
        msg.innerHTML = `<div class="message success">Question updated successfully.</div>`;
      } else {
        question = await InternAPI.createQuestion({
          topicId,
          type,
          difficulty,
          questionText,
          caseText,
          imageUrl,
          explanation,
          summary,
          isActive
        });

        const optionsPayload = cleanedOptions.map((text, index) => ({
          question_id: question.id,
          option_text: text,
          is_correct: index === correctIndex,
          sort_order: index + 1
        }));

        await InternAPI.createQuestionOptions(optionsPayload);
        msg.innerHTML = `<div class="message success">Question created successfully.</div>`;
      }

      adminState.selectedQuestionTopicId = topicId;

      resetQuestionForm();
      await loadTopics();

      adminState.selectedTopicId = topicId;
      await loadQuestionsByTopic(topicId);

      const browseSelect = InternCore.qs('#adminBrowseTopic');
      if (browseSelect) browseSelect.value = topicId;

      const topicSelect = InternCore.qs('#adminQuestionTopic');
      if (topicSelect) topicSelect.value = topicId;
    } catch (error) {
      console.error(error);
      msg.innerHTML = `<div class="message error">Failed to save question.</div>`;
    }
  });
}

  function bindQuestionsBrowser() {
    const btn = InternCore.qs('#loadQuestionsBtn');
    const msg = InternCore.qs('#adminQuestionsMessage');
    const searchInput = InternCore.qs('#adminQuestionSearch');
    const typeFilter = InternCore.qs('#adminFilterType');
    const difficultyFilter = InternCore.qs('#adminFilterDifficulty');

    btn?.addEventListener('click', async () => {
      const topicId = InternCore.qs('#adminBrowseTopic').value;

      if (!topicId) {
        msg.innerHTML = `<div class="message error">Please choose a topic first.</div>`;
        return;
      }

      try {
        msg.innerHTML = '';
        await loadQuestionsByTopic(topicId);
      } catch (error) {
        console.error(error);
        msg.innerHTML = `<div class="message error">Failed to load questions.</div>`;
      }
    });

    searchInput?.addEventListener('input', (event) => {
      adminState.searchTerm = event.target.value.trim();
      drawQuestionsList();
    });

    typeFilter?.addEventListener('change', (event) => {
      adminState.filterType = event.target.value;
      drawQuestionsList();
    });

    difficultyFilter?.addEventListener('change', (event) => {
      adminState.filterDifficulty = event.target.value;
      drawQuestionsList();
    });
  }

async function initAdminPage() {
  const allowed = await InternCore.isAllowedAdmin();

  if (!allowed) {
    window.location.href = './admin-login.html';
    return;
  }

  InternCore.createShell();
  renderAdminPage();

  try {
    await loadTopics();
    bindTopicForm();
    bindQuestionForm();
    bindQuestionsBrowser();
    bindBulkUpload();
    drawQuestionsList();
    resetTopicForm();
    resetQuestionForm();
  } catch (error) {
    console.error(error);
    const root = InternCore.qs('#internPageRoot');
    root.innerHTML = `
      <section class="card center">
        <div class="meta-row" style="justify-content:center;">
          <span class="badge">Error</span>
        </div>
        <h2>Failed to load admin panel.</h2>
        <p class="muted">Please check your Supabase connection and table permissions.</p>
      </section>
    `;
  }
} 

  document.addEventListener('DOMContentLoaded', initAdminPage);
})();
