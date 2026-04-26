(function () {
  'use strict';

  if (!window.InternSupabase) {
    console.error('InternSupabase is not initialized. Check supabase-client.js and script order.');
    return;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async function fetchQuestionOptions(questionIds) {
    if (!questionIds.length) return [];

    const { data, error } = await InternSupabase
      .from('intern_question_options')
      .select('id, question_id, option_text, is_correct, sort_order')
      .in('question_id', questionIds)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  function attachOptionsToQuestions(questions, options) {
    const grouped = new Map();

    options.forEach((option) => {
      if (!grouped.has(option.question_id)) {
        grouped.set(option.question_id, []);
      }

      grouped.get(option.question_id).push({
        id: option.id,
        text: option.option_text,
        is_correct: option.is_correct,
        sort_order: option.sort_order
      });
    });

    return questions.map((question) => ({
      id: question.id,
      topic_id: question.topic_id,
      topic_title: question.intern_topics?.title || (question.bank_type === 'real_exam_recall' ? 'Real Exam Recall Bank' : ''),
      bank_type: question.bank_type || 'topic_bank',
      type: question.type,
      difficulty: question.difficulty,
      question_text: question.question_text,
      case_text: question.case_text || '',
      image_url: question.image_url || '',
      explanation: question.explanation || '',
      summary: question.summary || '',
      is_active: question.is_active,
      created_at: question.created_at,
      options: grouped.get(question.id) || []
    }));
  }

  async function getQuestionsByTopics({ topicIds = [], count = 10 }) {
    let query = InternSupabase
      .from('intern_questions')
      .select(`
        id,
        topic_id,
        bank_type,
        type,
        difficulty,
        question_text,
        case_text,
        image_url,
        explanation,
        summary,
        is_active,
        created_at,
        intern_topics(title)
      `)
      .eq('is_active', true)
      .eq('bank_type', 'topic_bank');

    if (topicIds.length) {
      query = query.in('topic_id', topicIds);
    }

    const { data: questions, error } = await query.limit(Math.max(count * 3, count));
    if (error) throw error;

    const shuffledQuestions = shuffle(questions || []).slice(0, count);
    const questionIds = shuffledQuestions.map((question) => question.id);
    const options = await fetchQuestionOptions(questionIds);

    return attachOptionsToQuestions(shuffledQuestions, shuffle(options));
  }

  const InternAPI = {
    async getTopics() {
      const { data, error } = await InternSupabase
        .from('intern_topics_with_counts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;

      return (data || []).map((topic) => ({
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        description: topic.description || '',
        section: topic.section || '',
        questions_count: Number(topic.questions_count || 0)
      }));
    },

    async getAllTopics() {
      const { data, error } = await InternSupabase
        .from('intern_topics_with_counts')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;

      return (data || []).map((topic) => ({
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        description: topic.description || '',
        section: topic.section || '',
        is_active: topic.is_active,
        sort_order: topic.sort_order,
        created_at: topic.created_at,
        questions_count: Number(topic.questions_count || 0)
      }));
    },

    async getQuestionsByTopic(topicId) {
      if (!topicId) return [];

      const { data: questions, error } = await InternSupabase
        .from('intern_questions')
        .select(`
          id,
          topic_id,
          bank_type,
          type,
          difficulty,
          question_text,
          case_text,
          image_url,
          explanation,
          summary,
          is_active,
          created_at,
          intern_topics(title)
        `)
        .eq('topic_id', topicId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const questionIds = (questions || []).map((question) => question.id);
      const options = await fetchQuestionOptions(questionIds);

      return attachOptionsToQuestions(questions || [], options);
    },

    async getPracticeQuestions({ topicIds = [], count = 10 }) {
      return getQuestionsByTopics({ topicIds, count });
    },

    async getExamQuestions({ topicIds = [], count = 20 }) {
      return getQuestionsByTopics({ topicIds, count });
    },

    async getRecallQuestionCount() {
      const { count, error } = await InternSupabase
        .from('intern_questions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('bank_type', 'real_exam_recall');

      if (error) throw error;
      return Number(count || 0);
    },

    async getRecallQuestions({ count = 20, excludeQuestionIds = [] }) {
      const safeCount = Math.max(1, Number(count || 20));
      const fetchLimit = Math.max(safeCount * 4, safeCount);

      const { data: questions, error } = await InternSupabase
        .from('intern_questions')
        .select(`
          id,
          topic_id,
          bank_type,
          type,
          difficulty,
          question_text,
          case_text,
          image_url,
          explanation,
          summary,
          is_active,
          created_at,
          intern_topics(title)
        `)
        .eq('is_active', true)
        .eq('bank_type', 'real_exam_recall')
        .order('created_at', { ascending: false })
        .limit(fetchLimit);

      if (error) throw error;

      const excluded = new Set(excludeQuestionIds || []);
      const filtered = (questions || []).filter((question) => !excluded.has(question.id));
      const shuffledQuestions = shuffle(filtered).slice(0, safeCount);
      const questionIds = shuffledQuestions.map((question) => question.id);
      const options = await fetchQuestionOptions(questionIds);

      return attachOptionsToQuestions(shuffledQuestions, shuffle(options));
    },

    async createExamSession({ mode, selectedTopicIds, questionCount, timerMinutes = null }) {
      const { data, error } = await InternSupabase
        .from('intern_exam_sessions')
        .insert({
          mode,
          selected_topic_ids: selectedTopicIds,
          question_count: questionCount,
          timer_minutes: timerMinutes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async saveExamAnswers({ sessionId, rows }) {
      if (!rows.length) return [];

      const payload = rows.map((row) => ({
        session_id: sessionId,
        question_id: row.question.id,
        topic_id: row.question.topic_id,
        selected_option_id: row.selectedOptionId || null,
        selected_value: row.selected || null,
        is_correct: !!row.isCorrect
      }));

      const { data, error } = await InternSupabase
        .from('intern_exam_answers')
        .insert(payload)
        .select();

      if (error) throw error;
      return data;
    },

    async completeExamSession({ sessionId, score, totalQuestions }) {
      const { data, error } = await InternSupabase
        .from('intern_exam_sessions')
        .update({
          score,
          total_questions: totalQuestions,
          status: 'completed',
          finished_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async createTopic({ title, slug, description, section = '', sortOrder = 0, isActive = true }) {
      const { data, error } = await InternSupabase
        .from('intern_topics')
        .insert({
          title,
          slug,
          description,
          section,
          sort_order: sortOrder,
          is_active: isActive
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateTopic(topicId, { title, slug, description, section = '', sortOrder = 0, isActive = true }) {
      const { data, error } = await InternSupabase
        .from('intern_topics')
        .update({
          title,
          slug,
          description,
          section,
          sort_order: sortOrder,
          is_active: isActive
        })
        .eq('id', topicId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteTopic(topicId) {
      const { error } = await InternSupabase
        .from('intern_topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;
      return true;
    },

    async createQuestion({
      topicId = null,
      bankType = 'topic_bank',
      type,
      difficulty,
      questionText,
      caseText = '',
      imageUrl = '',
      explanation = '',
      summary = '',
      isActive = true
    }) {
      const { data, error } = await InternSupabase
        .from('intern_questions')
        .insert({
          topic_id: topicId,
          bank_type: bankType,
          type,
          difficulty,
          question_text: questionText,
          case_text: caseText,
          image_url: imageUrl,
          explanation,
          summary,
          is_active: isActive
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateQuestion(questionId, {
      topicId = null,
      bankType = 'topic_bank',
      type,
      difficulty,
      questionText,
      caseText = '',
      imageUrl = '',
      explanation = '',
      summary = '',
      isActive = true
    }) {
      const { data, error } = await InternSupabase
        .from('intern_questions')
        .update({
          topic_id: topicId,
          bank_type: bankType,
          type,
          difficulty,
          question_text: questionText,
          case_text: caseText,
          image_url: imageUrl,
          explanation,
          summary,
          is_active: isActive
        })
        .eq('id', questionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async createQuestionOptions(options) {
      const { data, error } = await InternSupabase
        .from('intern_question_options')
        .insert(options)
        .select();

      if (error) throw error;
      return data || [];
    },

    async replaceQuestionOptions(questionId, options) {
      const { error: deleteError } = await InternSupabase
        .from('intern_question_options')
        .delete()
        .eq('question_id', questionId);

      if (deleteError) throw deleteError;

      if (!options.length) return [];

      const { data, error } = await InternSupabase
        .from('intern_question_options')
        .insert(options)
        .select();

      if (error) throw error;
      return data || [];
    },

 async deleteQuestion(questionId) {
  const { error } = await InternSupabase
    .from('intern_questions')
    .delete()
    .eq('id', questionId);

  if (error) throw error;
  return true;
}
};

window.InternAPI = InternAPI;
})();
