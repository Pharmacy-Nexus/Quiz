
/* Pharmacy Nexus — Subjects 3D Clean V14
   Safe JS layer.
   It removes the broken V13 injected UI, then adds one clean section.
*/

(function () {
  "use strict";

  const WRAP_ID = "pn-subjects-clean-v14";

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function cleanupOldV13() {
    // Remove old injected recommended/stat blocks only.
    qsa("#pn-subjects-3d-polish-v13-recommended, #pn-subjects-clean-v14").forEach(el => el.remove());
    qsa(".pn-subjects-3d-shell").forEach(el => el.remove());

    // Remove old injected badges/progress from cards.
    qsa(".pn-subjects-status-badge, .pn-subjects-card-progress, .pn-coming-soon-copy").forEach(el => el.remove());

    // Remove old classes that caused hover/overlay issues.
    qsa(".pn-subjects-3d-enhanced-card").forEach(el => {
      el.classList.remove("pn-subjects-3d-enhanced-card");
      delete el.dataset.pn3dEnhanced;
      el.style.removeProperty("--pn-card-x");
      el.style.removeProperty("--pn-card-y");
    });
  }

  function getSubjectData() {
    const list = [];

    try {
      const subjectsMap = window.PN_DATA?.subjectsMap;
      const topicsMap = window.PN_DATA?.topicsMap;

      if (subjectsMap && typeof subjectsMap.forEach === "function") {
        subjectsMap.forEach((subject, id) => {
          const subjectId = subject?.id || id;
          const topicData = topicsMap?.get?.(subjectId);
          const topics = Array.isArray(topicData?.topics) ? topicData.topics : [];
          const questions = topics.reduce((sum, topic) => {
            return sum + Number(topic.questionsCount || topic.questions_count || topic.count || 0);
          }, 0);

          list.push({
            id: subjectId,
            name: subject?.name || subject?.title || String(subjectId),
            topics: topics.length || Number(subject?.topicsCount || subject?.topics_count || 0) || 0,
            questions: questions || Number(subject?.questionsCount || subject?.questions_count || 0) || 0
          });
        });
      }
    } catch (_) {}

    if (list.length) return list;

    // Conservative fallback from the visible cards only.
    const names = ["Pharmacology", "Biochemistry", "Pharmaceutics", "Clinical Pharmacy"];
    names.forEach(name => {
      const card = qsa("#page-subjects *").find(el => {
        const text = (el.textContent || "").trim();
        return text.includes(name) && /topics?|questions?/i.test(text) && text.length < 700;
      });

      const text = card?.textContent || "";
      const nums = (text.match(/\b\d+\b/g) || []).map(Number);

      list.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        topics: nums[0] || 0,
        questions: nums[1] || 0
      });
    });

    return list;
  }

  function getLastOrBestSubject(subjects) {
    const selected =
      window.appState?.selectedSubjectId ||
      window.appState?.currentTopicMeta?.subjectId ||
      window.appState?.examBuilder?.subjectId;

    const selectedSubject = subjects.find(s => String(s.id) === String(selected));
    if (selectedSubject && Number(selectedSubject.questions || 0) > 0) return selectedSubject;

    return subjects
      .filter(s => Number(s.questions || 0) > 0)
      .sort((a, b) => Number(b.questions || 0) - Number(a.questions || 0))[0] ||
      subjects[0] ||
      { id: null, name: "Pharmacology", topics: 0, questions: 0 };
  }

  function openSubject(subject) {
    if (subject?.id && typeof window.selectSubject === "function") {
      try {
        window.selectSubject(subject.id);
        return;
      } catch (_) {}
    }

    const clickable = qsa("#page-subjects [onclick], #page-subjects button, #page-subjects a")
      .find(el => (el.textContent || "").toLowerCase().includes(String(subject?.name || "").toLowerCase()));

    clickable?.click();
  }

  function findHero() {
    const page = qs("#page-subjects");
    if (!page) return null;

    return qsa("section, header, div", page)
      .filter(el => {
        const text = (el.textContent || "").trim();
        return /browse subjects/i.test(text) && text.length < 700;
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] || null;
  }

  function renderCleanSection() {
    const page = qs("#page-subjects");
    if (!page) return;

    cleanupOldV13();

    if (qs("#" + WRAP_ID, page)) return;

    const subjects = getSubjectData();
    const best = getLastOrBestSubject(subjects);

    const totalSubjects = subjects.length;
    const totalTopics = subjects.reduce((sum, s) => sum + Number(s.topics || 0), 0);
    const totalQuestions = subjects.reduce((sum, s) => sum + Number(s.questions || 0), 0);
    const active = subjects.filter(s => Number(s.questions || 0) > 0).length;

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.className = "pn-subjects-clean-wrap";
    wrap.innerHTML = `
      <div class="pn-subjects-clean-stats">
        <div class="pn-subjects-clean-stat"><span>Subjects</span><strong>${totalSubjects}</strong></div>
        <div class="pn-subjects-clean-stat"><span>Topics</span><strong>${totalTopics}</strong></div>
        <div class="pn-subjects-clean-stat"><span>Questions</span><strong>${totalQuestions}</strong></div>
        <div class="pn-subjects-clean-stat"><span>Active</span><strong>${active}</strong></div>
      </div>

      <section class="pn-subjects-clean-card">
        <div class="pn-subjects-clean-inner">
          <div>
            <span class="pn-subjects-clean-kicker">◆ Recommended next</span>
            <h3 class="pn-subjects-clean-title">Continue ${escapeHtml(best.name)}</h3>
            <p class="pn-subjects-clean-copy">
              ${Number(best.questions || 0) > 0
                ? `${Number(best.topics || 0)} topics and ${Number(best.questions || 0)} questions are ready.`
                : `This module is being organized and will be ready for new content soon.`}
            </p>
            <div class="pn-subjects-clean-actions">
              <button type="button" class="pn-subjects-clean-btn pn-subjects-clean-primary" data-pn-clean-continue>
                Continue module →
              </button>
              <button type="button" class="pn-subjects-clean-btn pn-subjects-clean-soft" data-pn-clean-browse>
                Browse all
              </button>
            </div>
          </div>

          <div class="pn-subjects-clean-stage" aria-hidden="true">
            <div class="pn-subjects-clean-ring"></div>
            <div class="pn-subjects-clean-mini one">
              <span>Recommended module</span>
              <strong>${escapeHtml(best.name)}</strong>
            </div>
            <div class="pn-subjects-clean-mini two">
              <span>Question bank</span>
              <strong>${Number(best.questions || 0)} questions</strong>
            </div>
          </div>
        </div>
      </section>
    `;

    const hero = findHero();
    if (hero && hero.parentNode) {
      hero.insertAdjacentElement("afterend", wrap);
    } else {
      page.prepend(wrap);
    }

    wrap.querySelector("[data-pn-clean-continue]")?.addEventListener("click", () => openSubject(best));
    wrap.querySelector("[data-pn-clean-browse]")?.addEventListener("click", () => {
      const firstCard = qsa("#page-subjects button, #page-subjects a, #page-subjects [onclick]")
        .find(el => /pharmacology|biochemistry|pharmaceutics|clinical/i.test(el.textContent || ""));
      firstCard?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function patchNavigation() {
    if (typeof window.navigateTo !== "function" || window.navigateTo.__pnSubjectsCleanV14) return;

    const original = window.navigateTo;
    window.navigateTo = function () {
      const result = original.apply(this, arguments);
      setTimeout(renderCleanSection, 100);
      setTimeout(renderCleanSection, 600);
      return result;
    };
    window.navigateTo.__pnSubjectsCleanV14 = true;
  }

  function init() {
    patchNavigation();
    setTimeout(renderCleanSection, 100);
    setTimeout(renderCleanSection, 800);
    setTimeout(renderCleanSection, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
