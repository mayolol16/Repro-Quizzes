// IMC535 Neuroscience & Behavior USMLE Step 1 QBank Core Engine
(function() {
  "use strict";

  // Comprehensive Math and LaTeX Formatter & KaTeX Bridge
  function formatMathText(str) {
    if (!str) return "";
    let s = String(str);

    // Replace common LaTeX math symbols and operators with clean Unicode
    s = s.replace(/\\ge\b/g, "≥")
         .replace(/\\le\b/g, "≤")
         .replace(/\\beta\b/g, "β")
         .replace(/\\alpha\b/g, "α")
         .replace(/\\gamma\b/g, "γ")
         .replace(/\\delta\b/g, "δ")
         .replace(/\\Delta\b/g, "Δ")
         .replace(/\\sigma\b/g, "σ")
         .replace(/\\kappa\b/g, "κ")
         .replace(/\\mu\b/g, "µ")
         .replace(/\\approx\b/g, "≈")
         .replace(/\\times\b/g, "×")
         .replace(/\\pm\b/g, "±")
         .replace(/\\circ\b/g, "°")
         .replace(/\\uparrow\b/g, "↑")
         .replace(/\\downarrow\b/g, "↓")
         .replace(/\\rightarrow\b/g, "→")
         .replace(/\\leftrightarrow\b/g, "↔")
         .replace(/\\sim\b/g, "~")
         .replace(/\\quad\b/g, " ")
         .replace(/\\text\{([^}]+)\}/g, "$1")
         .replace(/\\mathrm\{([^}]+)\}/g, "$1")
         .replace(/\\textbf\{([^}]+)\}/g, "<strong>$1</strong>")
         .replace(/\\textit\{([^}]+)\}/g, "<em>$1</em>")
         .replace(/\\mathbf\{([^}]+)\}/g, "<strong>$1</strong>");

    // Standard medical neuro subscripts and scientific notation
    s = s.replace(/\$E_k\$/gi, "E_K")
         .replace(/\$Na\^\+\$/gi, "Na⁺")
         .replace(/\$K\^\+\$/gi, "K⁺")
         .replace(/\$Ca\^\{2\+\}\$/gi, "Ca²⁺")
         .replace(/\$Cl\^-\$/gi, "Cl⁻")
         .replace(/\$GABA_A\$/gi, "GABA_A")
         .replace(/\$GABA_B\$/gi, "GABA_B");

    // Unwrap simple numbers or units wrapped in dollar signs
    s = s.replace(/\$([^$]+)\$/g, (match, p1) => {
      if (!/[\\{}^_]/.test(p1)) return p1;
      return match;
    });

    return s;
  }

  function renderKaTeX(elem) {
    if (!elem) return;
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(elem, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
          ],
          throwOnError: false
        });
      } catch (e) {
        // Fallback already rendered by formatMathText
      }
    }
  }

  // Application State
  const State = {
    allQuestions: [],
    learningObjectives: [],
    lecturesMap: {}, // key -> { name, exam, week, count, questions: [] }
    topicsMap: {},   // topic -> { topic, exam, week, lecture, attempts: 0, correct: 0, questions: [] }
    userHistory: {
      attempts: {}, // qId -> { choice, isCorrect, timestamp }
      flagged: {},  // qId -> true
      notes: {}     // qId -> text
    },
    activeQuiz: {
      mode: "tutor", // "tutor", "timed", "untimed"
      questions: [],
      currentIndex: 0,
      userAnswers: {}, // index -> chosenLetter
      revealed: {},    // index -> boolean (for tutor mode)
      strikethroughs: {}, // index -> Set of letters
      stemHighlights: {}, // index -> innerHTML with marks
      autoHighlightMode: false,
      startTime: null,
      timerInterval: null,
      elapsedSeconds: 0,
      isPaused: false
    },
    filterExam: "all",
    filterWeek: "all",
    theme: "light"
  };

  // LocalStorage Keys
  const STORAGE_KEY = "imc535_neuro_qbank_user_data_v1";
  const THEME_KEY = "imc535_neuro_qbank_theme";

  // Initialization
  async function init() {
    loadUserHistory();
    loadTheme();
    setupNavigation();
    setupThemeToggle();
    setupGlobalShortcuts();
    setupClinicalModals();

    // 1. Load learning objectives
    try {
      const respLO = await fetch("learning_objectives.json");
      State.learningObjectives = await respLO.json();
      console.log("Loaded Learning Objectives:", State.learningObjectives.length);
    } catch (e) {
      console.warn("Could not fetch learning_objectives.json:", e);
    }

    // 2. Load questions from window global (questions_data.js) or fetch json fallback
    if (window.ALL_QUESTIONS && Array.isArray(window.ALL_QUESTIONS)) {
      State.allQuestions = window.ALL_QUESTIONS;
      console.log("Loaded questions from global:", State.allQuestions.length);
      onDataLoaded();
    } else {
      try {
        const resp = await fetch("questions.json");
        State.allQuestions = await resp.json();
        console.log("Loaded questions from fetch:", State.allQuestions.length);
        onDataLoaded();
      } catch (err) {
        console.warn("No questions loaded yet or fetch failed:", err);
        State.allQuestions = [];
        onDataLoaded();
      }
    }
  }

  function onDataLoaded() {
    const badge = document.getElementById("total-q-badge");
    if (badge) badge.textContent = State.allQuestions.length;
    const dashBadge = document.getElementById("dash-total-badge");
    if (dashBadge) dashBadge.textContent = `Total ${State.allQuestions.length}`;

    buildMetadataMaps();
    initDashboard();
    initQuizBuilder();
    initBrowseView();
    updateHeaderStats();
  }

  function loadUserHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        State.userHistory = {
          attempts: parsed.attempts || {},
          flagged: parsed.flagged || {},
          notes: parsed.notes || {}
        };
      }
    } catch (e) {
      console.warn("Could not load user history:", e);
    }
  }

  function saveUserHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(State.userHistory));
    } catch (e) {
      console.warn("Could not save user history:", e);
    }
  }

  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    State.theme = saved;
    applyTheme(saved);
  }

  function applyTheme(theme) {
    if (theme === "light") {
      document.body.classList.remove("theme-dark");
      document.body.classList.add("theme-light");
    } else {
      document.body.classList.remove("theme-light");
      document.body.classList.add("theme-dark");
    }
  }

  function setupThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        State.theme = State.theme === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, State.theme);
        applyTheme(State.theme);
      });
    }
  }

  // Build lectures and topics maps for structured analytics
  function buildMetadataMaps() {
    State.lecturesMap = {};
    State.topicsMap = {};

    // 1. Seed from institutional learning objectives so curriculum is immediately populated
    if (State.learningObjectives && Array.isArray(State.learningObjectives)) {
      State.learningObjectives.forEach(lo => {
        if (!State.lecturesMap[lo.lecture]) {
          State.lecturesMap[lo.lecture] = {
            name: lo.lecture,
            exam: lo.exam || "E1",
            week: lo.week || "E1-W1",
            questions: []
          };
        }

        const topicKey = `${lo.exam || "E1"}::${lo.lecture}::${lo.id}`;
        if (!State.topicsMap[topicKey]) {
          State.topicsMap[topicKey] = {
            key: topicKey,
            id: lo.id,
            topic: lo.text,
            lecture: lo.lecture,
            exam: lo.exam || "E1",
            week: lo.week || "E1-W1",
            questions: []
          };
        }
      });
    }

    // 2. Map loaded questions
    State.allQuestions.forEach(q => {
      const lectureName = q.lecture || "General Neuroscience";
      const examName = q.exam || (q.week && q.week.startsWith("E") ? q.week.split("-")[0] : "E1");
      const weekName = q.week || "E1-W1";

      if (!State.lecturesMap[lectureName]) {
        State.lecturesMap[lectureName] = {
          name: lectureName,
          exam: examName,
          week: weekName,
          questions: []
        };
      }
      State.lecturesMap[lectureName].questions.push(q);

      // Link to LOs
      const qLOs = q.learning_objectives || [];
      if (qLOs.length > 0) {
        qLOs.forEach(loRef => {
          const loId = typeof loRef === "string" ? loRef : (loRef.id || loRef.text);
          const foundKey = Object.keys(State.topicsMap).find(k => k.endsWith("::" + loId));
          if (foundKey) {
            State.topicsMap[foundKey].questions.push(q);
          }
        });
      } else {
        const fallbackTopic = q.topic || lectureName;
        const topicKey = `${examName}::${lectureName}::${fallbackTopic}`;
        if (!State.topicsMap[topicKey]) {
          State.topicsMap[topicKey] = {
            key: topicKey,
            id: topicKey,
            topic: fallbackTopic,
            lecture: lectureName,
            exam: examName,
            week: weekName,
            questions: []
          };
        }
        State.topicsMap[topicKey].questions.push(q);
      }
    });
  }

  // Navigation Tabs Switching
  function setupNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const targetView = tab.getAttribute("data-view");
        switchView(targetView);
      });
    });

    const logo = document.querySelector(".app-logo");
    if (logo) {
      logo.addEventListener("click", () => {
        switchView("dashboard");
      });
    }
  }

  function switchView(viewName) {
    document.querySelectorAll(".nav-tab").forEach(t => {
      t.classList.toggle("active", t.getAttribute("data-view") === viewName);
    });
    document.querySelectorAll(".view-panel").forEach(p => {
      p.classList.remove("active");
    });
    const target = document.getElementById("view-" + viewName);
    if (target) {
      target.classList.add("active");
    }

    if (viewName === "dashboard") {
      updateDashboardStats();
    } else if (viewName === "create-quiz") {
      updateBuilderCounts();
    }
  }

  // Header quick statistics
  function updateHeaderStats() {
    const attemptedKeys = Object.keys(State.userHistory.attempts);
    const attemptedCount = attemptedKeys.length;
    const totalCount = State.allQuestions.length;

    let correctCount = 0;
    attemptedKeys.forEach(k => {
      if (State.userHistory.attempts[k] && State.userHistory.attempts[k].isCorrect) correctCount++;
    });

    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

    const accEl = document.getElementById("hdr-accuracy");
    if (accEl) accEl.textContent = attemptedCount > 0 ? accuracy + "%" : "0%";
    const compEl = document.getElementById("hdr-completed");
    if (compEl) compEl.textContent = `${attemptedCount} / ${totalCount}`;
  }

  // 1. DASHBOARD & WEAKNESS ENGINE
  function initDashboard() {
    const quickDrill = document.getElementById("btn-quick-drill");
    if (quickDrill) {
      quickDrill.addEventListener("click", () => drillWeaknesses(20));
    }

    const quickRandom = document.getElementById("btn-quick-random");
    if (quickRandom) {
      quickRandom.addEventListener("click", () => {
        if (State.allQuestions.length === 0) {
          alert("No questions loaded in QBank repository yet. Upload or generate questions to start drilling!");
          return;
        }
        const shuffled = [...State.allQuestions].sort(() => 0.5 - Math.random()).slice(0, 10);
        startQuizWithQuestions(shuffled, "tutor", "Quick 10Q Random Tutor");
      });
    }

    const linkFlagged = document.getElementById("link-drill-flagged");
    if (linkFlagged) {
      linkFlagged.addEventListener("click", (e) => {
        e.preventDefault();
        startFlaggedQuiz();
      });
    }

    // Exam module drill buttons
    document.querySelectorAll(".btn-start-exam-drill").forEach(btn => {
      btn.addEventListener("click", () => {
        const exam = btn.getAttribute("data-exam");
        startExamQuiz(exam, 20);
      });
    });

    // Learning Objectives Table Filters
    const examFilter = document.getElementById("lo-filter-exam");
    const statusFilter = document.getElementById("lo-filter-status");
    const searchInput = document.getElementById("lo-search");

    if (examFilter) examFilter.addEventListener("change", renderLOTable);
    if (statusFilter) statusFilter.addEventListener("change", renderLOTable);
    if (searchInput) searchInput.addEventListener("input", renderLOTable);

    updateDashboardStats();
  }

  function updateDashboardStats() {
    updateHeaderStats();

    const attemptedKeys = Object.keys(State.userHistory.attempts);
    const attemptedCount = attemptedKeys.length;
    const totalCount = State.allQuestions.length;

    let correctCount = 0;
    attemptedKeys.forEach(k => {
      if (State.userHistory.attempts[k] && State.userHistory.attempts[k].isCorrect) correctCount++;
    });

    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const coverage = totalCount > 0 ? ((attemptedCount / totalCount) * 100).toFixed(1) : 0.0;

    const accEl = document.getElementById("dash-accuracy");
    if (accEl) accEl.textContent = attemptedCount > 0 ? `${accuracy}%` : "--%";
    const accFill = document.getElementById("dash-acc-fill");
    if (accFill) accFill.style.width = `${accuracy}%`;
    const accBadge = document.getElementById("dash-acc-badge");
    if (accBadge) {
      accBadge.textContent = attemptedCount > 0 ? (accuracy >= 75 ? "Strong" : accuracy >= 60 ? "Average" : "Needs Work") : "No data";
      accBadge.className = `stat-card-badge ${accuracy >= 75 ? "success" : accuracy >= 60 ? "warning" : "danger"}`;
    }

    const subEl = document.getElementById("dash-correct-sub");
    if (subEl) subEl.textContent = `${correctCount} correct out of ${attemptedCount} attempted`;

    const covEl = document.getElementById("dash-coverage");
    if (covEl) covEl.textContent = `${coverage}%`;
    const covFill = document.getElementById("dash-cov-fill");
    if (covFill) covFill.style.width = `${coverage}%`;
    const covSub = document.getElementById("dash-cov-sub");
    if (covSub) covSub.textContent = `${attemptedCount} of ${totalCount} questions`;

    // Flagged count
    const flaggedCount = Object.keys(State.userHistory.flagged).filter(k => State.userHistory.flagged[k]).length;
    const flagEl = document.getElementById("dash-flagged-count");
    if (flagEl) flagEl.textContent = flaggedCount;

    // High weakness count (< 70% accuracy)
    let weakCount = 0;
    Object.values(State.topicsMap).forEach(top => {
      let topAttempted = 0;
      let topCorrect = 0;
      top.questions.forEach(q => {
        if (State.userHistory.attempts[q.id]) {
          topAttempted++;
          if (State.userHistory.attempts[q.id].isCorrect) topCorrect++;
        }
      });
      if (topAttempted > 0 && (topCorrect / topAttempted) < 0.70) {
        weakCount++;
      }
    });

    const weakEl = document.getElementById("dash-weak-count");
    if (weakEl) weakEl.textContent = weakCount;
    const weakBadge = document.getElementById("dash-weak-badge");
    if (weakBadge) weakBadge.textContent = `${weakCount} flagged`;

    // Update Exam Modules breakdown cards
    ["E1", "E2", "E3", "E4"].forEach(exam => {
      const examQs = State.allQuestions.filter(q => (q.exam === exam) || (q.week && q.week.startsWith(exam)));
      const examAttempted = examQs.filter(q => State.userHistory.attempts[q.id]);
      const examCorrect = examAttempted.filter(q => State.userHistory.attempts[q.id].isCorrect);
      const examAcc = examAttempted.length > 0 ? Math.round((examCorrect.length / examAttempted.length) * 100) : null;

      const countEl = document.getElementById(`mod-${exam.toLowerCase()}-count`);
      if (countEl) countEl.textContent = `${examAttempted.length} / ${examQs.length} Qs`;

      const accModEl = document.getElementById(`mod-${exam.toLowerCase()}-acc`);
      if (accModEl) accModEl.textContent = examAcc !== null ? `${examAcc}%` : "--%";
    });

    renderLOTable();
  }

  // Render the Learning Objectives Diagnostic Table
  function renderLOTable() {
    const tbody = document.getElementById("lo-table-body");
    if (!tbody) return;

    const filterExam = document.getElementById("lo-filter-exam").value;
    const filterStatus = document.getElementById("lo-filter-status").value;
    const query = document.getElementById("lo-search").value.toLowerCase().trim();

    tbody.innerHTML = "";

    const topicsArray = Object.values(State.topicsMap).map(top => {
      let attempted = 0;
      let correct = 0;
      top.questions.forEach(q => {
        if (State.userHistory.attempts[q.id]) {
          attempted++;
          if (State.userHistory.attempts[q.id].isCorrect) correct++;
        }
      });
      const acc = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
      return {
        ...top,
        attempted,
        correct,
        accuracy: acc
      };
    });

    // Sort: weak topics first (lowest accuracy with >=1 attempt), then untested, then mastered
    topicsArray.sort((a, b) => {
      if (a.accuracy !== null && b.accuracy !== null) return a.accuracy - b.accuracy;
      if (a.accuracy !== null) return -1;
      if (b.accuracy !== null) return 1;
      return (a.exam || "").localeCompare(b.exam || "") || (a.lecture || "").localeCompare(b.lecture || "");
    });

    let renderedCount = 0;

    topicsArray.forEach(item => {
      // Filter by Exam
      if (filterExam !== "all" && item.exam !== filterExam) return;

      // Filter by text search
      if (query && !item.topic.toLowerCase().includes(query) && !item.lecture.toLowerCase().includes(query)) {
        return;
      }

      // Filter by status
      if (filterStatus === "weak" && (item.accuracy === null || item.accuracy >= 70)) return;
      if (filterStatus === "mastered" && (item.accuracy === null || item.accuracy < 70)) return;
      if (filterStatus === "untested" && item.attempted > 0) return;

      renderedCount++;
      const tr = document.createElement("tr");

      let statusHtml = "";
      if (item.questions.length === 0) {
        statusHtml = `<span class="status-badge status-muted">Awaiting Qs</span>`;
      } else if (item.attempted === 0) {
        statusHtml = `<span class="status-badge status-muted">Untested</span>`;
      } else if (item.accuracy < 60) {
        statusHtml = `<span class="status-badge status-danger">⚠️ High Weakness</span>`;
      } else if (item.accuracy < 75) {
        statusHtml = `<span class="status-badge status-warning">Review Needed</span>`;
      } else {
        statusHtml = `<span class="status-badge status-success">✓ Mastered</span>`;
      }

      const accText = item.accuracy !== null ? `${item.accuracy}% (${item.correct}/${item.attempted})` : "--";

      tr.innerHTML = `
        <td><span class="badge badge-subtle">${item.exam || "E1"}</span></td>
        <td style="font-weight: 600; font-size: 0.85rem;">${item.lecture}</td>
        <td><div style="font-size: 0.9rem; line-height: 1.4;">${item.topic}</div></td>
        <td style="font-family: var(--font-mono); font-size: 0.85rem;">${item.questions.length} Qs</td>
        <td style="font-family: var(--font-mono); font-size: 0.85rem;">${item.attempted} / ${item.questions.length}</td>
        <td style="font-family: var(--font-mono); font-weight: 700;">${accText}</td>
        <td>${statusHtml}</td>
        <td>
          <button class="btn btn-xs btn-outline btn-drill-topic" data-topic-key="${encodeURIComponent(item.key)}">
            ${item.questions.length > 0 ? "Practice" : "View"}
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Topic drill button event delegation
    tbody.querySelectorAll(".btn-drill-topic").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = decodeURIComponent(btn.getAttribute("data-topic-key"));
        const top = State.topicsMap[key];
        if (top && top.questions.length > 0) {
          startQuizWithQuestions(top.questions, "tutor", `Targeted Drill: ${top.lecture}`);
        } else {
          alert(`Objective: "${top.topic}"\n\nQuestions for this specific objective have not been ingested into the QBank yet. When Week 1 questions are compiled, you will be able to launch custom drills directly from here!`);
        }
      });
    });

    if (renderedCount === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No learning objectives match your criteria.</td>`;
      tbody.appendChild(tr);
    }
  }

  // 2. QUIZ BUILDER & LAUNCHERS
  function initQuizBuilder() {
    renderLectureChecklist();

    // Exam Filter buttons
    const examFilterBtns = document.querySelectorAll("#builder-exam-filter .btn-filter");
    examFilterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        examFilterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        State.filterExam = btn.getAttribute("data-exam");
        filterChecklist();
      });
    });

    // Week Filter buttons
    const weekFilterBtns = document.querySelectorAll("#builder-week-filter .btn-filter");
    weekFilterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        weekFilterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        State.filterWeek = btn.getAttribute("data-week");
        filterChecklist();
      });
    });

    // Select/Clear all lectures
    const btnSelectAll = document.getElementById("btn-select-all-lectures");
    if (btnSelectAll) {
      btnSelectAll.addEventListener("click", () => {
        document.querySelectorAll(".chk-lecture").forEach(chk => {
          if (chk.closest(".lecture-item").style.display !== "none") {
            chk.checked = true;
          }
        });
        updateBuilderCounts();
      });
    }

    const btnClearAll = document.getElementById("btn-clear-all-lectures");
    if (btnClearAll) {
      btnClearAll.addEventListener("click", () => {
        document.querySelectorAll(".chk-lecture").forEach(chk => {
          chk.checked = false;
        });
        updateBuilderCounts();
      });
    }

    // Question pool radio listeners
    document.querySelectorAll("input[name='pool-filter']").forEach(radio => {
      radio.addEventListener("change", updateBuilderCounts);
    });

    // Question count presets
    document.querySelectorAll(".count-presets .btn-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-count");
        const input = document.getElementById("quiz-q-count");
        if (val === "max") {
          const matchCount = parseInt(document.getElementById("builder-matching-count").textContent) || 20;
          input.value = Math.max(1, matchCount);
        } else {
          input.value = val;
        }
      });
    });

    // Launch Configured Quiz
    const launchBtn = document.getElementById("btn-start-configured-quiz");
    if (launchBtn) {
      launchBtn.addEventListener("click", launchConfiguredQuiz);
    }
  }

  function renderLectureChecklist() {
    const container = document.getElementById("lecture-checklist");
    if (!container) return;
    container.innerHTML = "";

    const lectures = Object.values(State.lecturesMap);
    if (lectures.length === 0) {
      container.innerHTML = `<div style="padding: 1.5rem; color: var(--text-muted); text-align: center;">No lectures or topics loaded yet.</div>`;
      return;
    }

    lectures.forEach(lec => {
      const item = document.createElement("div");
      item.className = "lecture-item";
      item.setAttribute("data-exam", lec.exam || "E1");
      item.setAttribute("data-week", lec.week || "E1-W1");

      item.innerHTML = `
        <label class="checkbox-label">
          <input type="checkbox" class="chk-lecture" value="${lec.name}" checked>
          <div class="lecture-meta">
            <span class="lecture-name">${lec.name}</span>
            <span class="lecture-count">${lec.questions.length} Qs • ${lec.week || "E1-W1"}</span>
          </div>
        </label>
      `;

      container.appendChild(item);
    });

    container.querySelectorAll(".chk-lecture").forEach(chk => {
      chk.addEventListener("change", updateBuilderCounts);
    });

    filterChecklist();
  }

  function filterChecklist() {
    const exam = State.filterExam;
    const week = State.filterWeek;

    document.querySelectorAll(".lecture-item").forEach(item => {
      const lExam = item.getAttribute("data-exam");
      const lWeek = item.getAttribute("data-week");

      let visible = true;
      if (exam !== "all" && lExam !== exam) visible = false;
      if (week !== "all" && lWeek !== week) visible = false;

      item.style.display = visible ? "flex" : "none";
    });

    updateBuilderCounts();
  }

  function getSelectedLectures() {
    const selected = [];
    document.querySelectorAll(".chk-lecture:checked").forEach(chk => {
      const item = chk.closest(".lecture-item");
      if (item && item.style.display !== "none") {
        selected.push(chk.value);
      }
    });
    return selected;
  }

  function updateBuilderCounts() {
    const selectedLectures = getSelectedLectures();
    const poolFilterEl = document.querySelector("input[name='pool-filter']:checked");
    const poolFilter = poolFilterEl ? poolFilterEl.value : "all";

    let matching = State.allQuestions.filter(q => selectedLectures.includes(q.lecture));

    // Pool filtering
    if (poolFilter === "unused") {
      matching = matching.filter(q => !State.userHistory.attempts[q.id]);
    } else if (poolFilter === "incorrect") {
      matching = matching.filter(q => State.userHistory.attempts[q.id] && !State.userHistory.attempts[q.id].isCorrect);
    } else if (poolFilter === "flagged") {
      matching = matching.filter(q => State.userHistory.flagged[q.id]);
    }

    const badge = document.getElementById("builder-matching-count");
    if (badge) badge.textContent = matching.length;

    const startBtn = document.getElementById("btn-start-configured-quiz");
    if (startBtn) {
      if (matching.length === 0) {
        startBtn.disabled = true;
        startBtn.style.opacity = "0.5";
      } else {
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
      }
    }

    return matching;
  }

  function launchConfiguredQuiz() {
    const matching = updateBuilderCounts();
    if (matching.length === 0) {
      alert("No questions match your current filter settings. Ingest or upload questions to launch a practice exam!");
      return;
    }

    const mode = document.querySelector("input[name='test-mode']:checked").value;
    const requestedCount = parseInt(document.getElementById("quiz-q-count").value) || 20;
    const count = Math.min(matching.length, Math.max(1, requestedCount));

    // Shuffle and pick subset
    const shuffled = [...matching].sort(() => 0.5 - Math.random()).slice(0, count);
    startQuizWithQuestions(shuffled, mode, `Custom Practice Exam (${shuffled.length} Qs)`);
  }

  function drillWeaknesses(count = 20) {
    // Find questions corresponding to weakest topics (< 70% accuracy or untested)
    const weakTopics = Object.values(State.topicsMap).filter(t => {
      let att = 0, corr = 0;
      t.questions.forEach(q => {
        if (State.userHistory.attempts[q.id]) {
          att++;
          if (State.userHistory.attempts[q.id].isCorrect) corr++;
        }
      });
      return att > 0 && (corr / att) < 0.70;
    });

    let weakQuestions = [];
    weakTopics.forEach(t => {
      t.questions.forEach(q => {
        if (!weakQuestions.includes(q)) weakQuestions.push(q);
      });
    });

    if (weakQuestions.length === 0) {
      // Fallback: untested questions
      weakQuestions = State.allQuestions.filter(q => !State.userHistory.attempts[q.id]);
    }

    if (weakQuestions.length === 0) {
      alert("No weakness or unattempted questions found! Explore the Browse tab or configure a custom exam.");
      return;
    }

    const shuffled = weakQuestions.sort(() => 0.5 - Math.random()).slice(0, count);
    startQuizWithQuestions(shuffled, "tutor", `Weakness Diagnostic Drill (${shuffled.length} Qs)`);
  }

  function startExamQuiz(exam, count = 20) {
    const examQs = State.allQuestions.filter(q => (q.exam === exam) || (q.week && q.week.startsWith(exam)));
    if (examQs.length === 0) {
      alert(`No questions loaded for ${exam} yet. Week-by-week questions will be ingested here!`);
      return;
    }
    const shuffled = examQs.sort(() => 0.5 - Math.random()).slice(0, count);
    startQuizWithQuestions(shuffled, "tutor", `${exam} Targeted Practice (${shuffled.length} Qs)`);
  }

  function startFlaggedQuiz() {
    const flaggedQs = State.allQuestions.filter(q => State.userHistory.flagged[q.id]);
    if (flaggedQs.length === 0) {
      alert("You have not flagged any questions yet.");
      return;
    }
    startQuizWithQuestions(flaggedQs, "tutor", `Flagged Questions Review (${flaggedQs.length} Qs)`);
  }

  // Highlighting Core Engine
  function applyHighlight(color = "yellow") {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const stemEl = document.getElementById("q-stem-text");
    if (!stemEl || !stemEl.contains(range.commonAncestorContainer)) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    try {
      const mark = document.createElement("mark");
      mark.className = `user-highlight ${color}`;
      mark.title = "Click to remove highlight";
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        removeHighlight(mark);
      });

      try {
        range.surroundContents(mark);
      } catch (e) {
        const contents = range.extractContents();
        mark.appendChild(contents);
        range.insertNode(mark);
      }

      selection.removeAllRanges();
      saveCurrentHighlights();
      hideFloatingBubble();
    } catch (err) {
      console.warn("Could not apply highlight:", err);
    }
  }

  function removeHighlight(mark) {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    saveCurrentHighlights();
  }

  function saveCurrentHighlights() {
    const idx = State.activeQuiz.currentIndex;
    const stemEl = document.getElementById("q-stem-text");
    if (stemEl) {
      State.activeQuiz.stemHighlights[idx] = stemEl.innerHTML;
      updateClearHighlightsBtn();
    }
  }

  function updateClearHighlightsBtn() {
    const btn = document.getElementById("btn-clear-highlights");
    const stemEl = document.getElementById("q-stem-text");
    if (!btn || !stemEl) return;
    const count = stemEl.querySelectorAll("mark.user-highlight").length;
    btn.style.display = count > 0 ? "inline-flex" : "none";
  }

  function clearAllCurrentHighlights() {
    const stemEl = document.getElementById("q-stem-text");
    if (!stemEl) return;
    const marks = stemEl.querySelectorAll("mark.user-highlight");
    marks.forEach(m => removeHighlight(m));
    saveCurrentHighlights();
  }

  function showFloatingBubble(range) {
    const bubble = document.getElementById("floating-highlight-bubble");
    if (!bubble) return;

    const rect = range.getBoundingClientRect();
    const viewport = document.querySelector(".quiz-viewport");
    if (!viewport) return;
    const vpRect = viewport.getBoundingClientRect();

    const top = rect.top - vpRect.top - 46;
    const left = rect.left - vpRect.left + (rect.width / 2);

    bubble.style.top = `${Math.max(10, top)}px`;
    bubble.style.left = `${left}px`;
    bubble.style.display = "flex";
  }

  function hideFloatingBubble() {
    const bubble = document.getElementById("floating-highlight-bubble");
    if (bubble) bubble.style.display = "none";
  }

  function rebindHighlightListeners() {
    const stemEl = document.getElementById("q-stem-text");
    if (!stemEl) return;
    stemEl.querySelectorAll("mark.user-highlight").forEach(mark => {
      mark.onclick = (e) => {
        e.stopPropagation();
        removeHighlight(mark);
      };
    });
    updateClearHighlightsBtn();
  }

  // 3. ACTIVE QUIZ EXECUTION ENGINE
  function shuffleChoicesForQuestion(q) {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const originalChoices = q.choices || {};
    const keys = Object.keys(originalChoices).sort(); // A, B, C, D, E
    if (keys.length === 0) return q;

    // Shuffle the keys to determine the new order of values
    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
    
    const newChoices = {};
    let newCorrect = q.correct;

    keys.forEach((letter, index) => {
      // The new position 'letter' gets the value from 'shuffledKeys[index]'
      const sourceLetter = shuffledKeys[index];
      newChoices[letter] = originalChoices[sourceLetter];
      
      // If the source letter was the correct answer, record its new position
      if (sourceLetter === q.correct) {
        newCorrect = letter;
      }
    });

    return {
      ...q,
      choices: newChoices,
      correct: newCorrect
    };
  }

  function startQuizWithQuestions(questions, mode, title, preRevealMode = false) {
    if (!questions || questions.length === 0) return;

    // Deep clone and shuffle choices if not in review mode
    const processedQuestions = questions.map(q => {
      // If we're pre-revealing (reviewing past attempts), we probably shouldn't shuffle 
      // because the user's past answer letter wouldn't match. 
      // Actually, if we deep clone, we preserve original state. But since past answers 
      // are stored by letter, we must NOT shuffle if we are reviewing a past test.
      if (preRevealMode) {
        return q; 
      }
      return shuffleChoicesForQuestion(q);
    });

    State.activeQuiz = {
      mode: mode, // "tutor", "timed", "untimed"
      questions: processedQuestions,
      currentIndex: 0,
      userAnswers: {},
      revealed: {},
      strikethroughs: {},
      stemHighlights: {},
      autoHighlightMode: false,
      startTime: Date.now(),
      timerInterval: null,
      elapsedSeconds: 0,
      isPaused: false
    };

    if (preRevealMode) {
      questions.forEach((q, idx) => {
        State.activeQuiz.revealed[idx] = true;
        const attempt = State.userHistory.attempts[q.id];
        if (attempt) {
          State.activeQuiz.userAnswers[idx] = attempt.choice;
        } else {
          State.activeQuiz.userAnswers[idx] = null;
        }
      });
    }

    const navTab = document.getElementById("nav-active-quiz");
    if (navTab) navTab.style.display = "inline-flex";

    const badge = document.getElementById("quiz-badge-mode");
    if (badge) {
      badge.textContent = mode === "timed" ? "Timed Exam (75s/Q)" : (mode === "untimed" ? "Untimed Exam" : "Tutor Mode");
    }

    switchView("active-quiz");
    initQuizTimer();
    initQuizNavigationControls();
    loadQuestion(0);
  }

  function initQuizTimer() {
    if (State.activeQuiz.timerInterval) {
      clearInterval(State.activeQuiz.timerInterval);
    }

    const timerDisplay = document.getElementById("quiz-timer-display");
    const pauseBtn = document.getElementById("btn-timer-pause");
    if (!timerDisplay) return;

    const isTimed = State.activeQuiz.mode === "timed";
    const totalTimeAllowed = State.activeQuiz.questions.length * 75; // 75s per USMLE question

    State.activeQuiz.timerInterval = setInterval(() => {
      if (State.activeQuiz.isPaused) return;

      State.activeQuiz.elapsedSeconds++;

      let displaySec = 0;
      if (isTimed) {
        displaySec = Math.max(0, totalTimeAllowed - State.activeQuiz.elapsedSeconds);
        if (displaySec <= 0) {
          clearInterval(State.activeQuiz.timerInterval);
          alert("Time has expired! Submitting exam for scoring.");
          finishQuiz();
          return;
        }
      } else {
        displaySec = State.activeQuiz.elapsedSeconds;
      }

      const m = Math.floor(displaySec / 60);
      const s = displaySec % 60;
      timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);

    if (pauseBtn) {
      pauseBtn.onclick = () => {
        State.activeQuiz.isPaused = !State.activeQuiz.isPaused;
        pauseBtn.textContent = State.activeQuiz.isPaused ? "▶️" : "⏸️";
        const viewport = document.querySelector(".quiz-viewport");
        if (viewport) {
          viewport.style.filter = State.activeQuiz.isPaused ? "blur(12px)" : "none";
        }
      };
    }
  }

  function initQuizNavigationControls() {
    const prevBtn = document.getElementById("btn-nav-prev");
    const nextBtn = document.getElementById("btn-nav-next");
    const directNextBtn = document.getElementById("btn-next-question-direct");
    const finishBtn = document.getElementById("btn-nav-finish");
    const submitBtn = document.getElementById("btn-submit-answer");
    const flagBtn = document.getElementById("btn-flag-toggle");

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (State.activeQuiz.currentIndex > 0) {
          loadQuestion(State.activeQuiz.currentIndex - 1);
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        if (State.activeQuiz.currentIndex < State.activeQuiz.questions.length - 1) {
          loadQuestion(State.activeQuiz.currentIndex + 1);
        } else {
          finishQuiz();
        }
      };
    }

    if (directNextBtn) {
      directNextBtn.onclick = () => {
        if (State.activeQuiz.currentIndex < State.activeQuiz.questions.length - 1) {
          loadQuestion(State.activeQuiz.currentIndex + 1);
        } else {
          finishQuiz();
        }
      };
    }

    if (finishBtn) {
      finishBtn.onclick = () => {
        if (confirm("Are you sure you want to end this exam and view your score report?")) {
          finishQuiz();
        }
      };
    }

    if (submitBtn) {
      submitBtn.onclick = () => submitCurrentAnswer();
    }

    if (flagBtn) {
      flagBtn.onclick = () => toggleFlag();
    }

    // Tools: Strikethrough & Highlighting
    const strikeBtn = document.getElementById("btn-strike-toggle");
    if (strikeBtn) {
      strikeBtn.onclick = () => {
        strikeBtn.classList.toggle("active-tool");
      };
    }

    const highlightToggleBtn = document.getElementById("btn-highlight-toggle");
    if (highlightToggleBtn) {
      highlightToggleBtn.onclick = () => {
        State.activeQuiz.autoHighlightMode = !State.activeQuiz.autoHighlightMode;
        highlightToggleBtn.classList.toggle("active-tool", State.activeQuiz.autoHighlightMode);
      };
    }

    const clearHighlightsBtn = document.getElementById("btn-clear-highlights");
    if (clearHighlightsBtn) {
      clearHighlightsBtn.onclick = () => clearAllCurrentHighlights();
    }

    // Grid Jumper Modal
    const toggleGridBtn = document.getElementById("btn-toggle-grid");
    const gridModal = document.getElementById("quiz-grid-modal");
    const closeGridBtn = document.getElementById("btn-close-grid");

    if (toggleGridBtn && gridModal) {
      toggleGridBtn.onclick = () => {
        renderNavGrid();
        gridModal.style.display = gridModal.style.display === "none" ? "block" : "none";
      };
    }

    if (closeGridBtn && gridModal) {
      closeGridBtn.onclick = () => {
        gridModal.style.display = "none";
      };
    }

    // Floating Highlight Bubble Selection Listener
    const stemEl = document.getElementById("q-stem-text");
    const bubble = document.getElementById("floating-highlight-bubble");
    if (stemEl && bubble) {
      stemEl.addEventListener("mouseup", (e) => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          hideFloatingBubble();
          return;
        }

        if (State.activeQuiz.autoHighlightMode) {
          applyHighlight("yellow");
          return;
        }

        showFloatingBubble(sel.getRangeAt(0));
      });

      bubble.querySelectorAll(".bubble-color").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const color = btn.getAttribute("data-color");
          applyHighlight(color);
        };
      });

      document.addEventListener("mousedown", (e) => {
        if (!bubble.contains(e.target) && !stemEl.contains(e.target)) {
          hideFloatingBubble();
        }
      });
    }
  }

  function setupGlobalShortcuts() {
    document.addEventListener("keydown", (e) => {
      const activePanel = document.querySelector(".view-panel.active");
      if (!activePanel || activePanel.id !== "view-active-quiz") return;

      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const key = e.key.toUpperCase();

      if (key === "H") {
        const hBtn = document.getElementById("btn-highlight-toggle");
        if (hBtn) hBtn.click();
      } else if (key === "S") {
        const sBtn = document.getElementById("btn-strike-toggle");
        if (sBtn) sBtn.click();
      } else if (key === "F") {
        const fBtn = document.getElementById("btn-flag-toggle");
        if (fBtn) fBtn.click();
      } else if (["A", "B", "C", "D", "E"].includes(key)) {
        selectChoice(key);
      } else if (e.key === "Enter") {
        const submitBtn = document.getElementById("btn-submit-answer");
        const nextDirect = document.getElementById("btn-next-question-direct");
        if (submitBtn && submitBtn.style.display !== "none") {
          submitBtn.click();
        } else if (nextDirect && nextDirect.style.display !== "none") {
          nextDirect.click();
        }
      } else if (e.key === "ArrowRight") {
        const nextBtn = document.getElementById("btn-nav-next");
        if (nextBtn) nextBtn.click();
      } else if (e.key === "ArrowLeft") {
        const prevBtn = document.getElementById("btn-nav-prev");
        if (prevBtn) prevBtn.click();
      }
    });
  }

  function loadQuestion(index) {
    State.activeQuiz.currentIndex = index;
    const q = State.activeQuiz.questions[index];
    if (!q) return;

    // 1. Update Header Badges & Counter
    const counterEl = document.getElementById("quiz-q-counter");
    if (counterEl) counterEl.textContent = `Question ${index + 1} of ${State.activeQuiz.questions.length}`;

    const idEl = document.getElementById("quiz-q-id");
    if (idEl) idEl.textContent = `ID: ${q.id}`;

    const metaLec = document.getElementById("q-meta-lecture");
    if (metaLec) metaLec.textContent = q.lecture || "Neuroscience";

    const metaYield = document.getElementById("q-meta-yield");
    if (metaYield) metaYield.textContent = `${q.yield_level || "High"} Yield`;

    // 2. Update Flag Button State
    const flagBtn = document.getElementById("btn-flag-toggle");
    if (flagBtn) {
      flagBtn.classList.toggle("flagged", !!State.userHistory.flagged[q.id]);
    }

    // 3. Render Stem & Saved Highlights
    const stemEl = document.getElementById("q-stem-text");
    if (stemEl) {
      if (State.activeQuiz.stemHighlights[index]) {
        stemEl.innerHTML = State.activeQuiz.stemHighlights[index];
        rebindHighlightListeners();
      } else {
        stemEl.innerHTML = formatMathText(q.stem || "");
        renderKaTeX(stemEl);
      }
    }

    // 4. Render Media
    const mediaBox = document.getElementById("q-media-box");
    const mediaImg = document.getElementById("q-media-img");
    if (mediaBox && mediaImg) {
      if (q.media) {
        mediaImg.src = q.media;
        mediaBox.style.display = "block";
      } else {
        mediaBox.style.display = "none";
      }
    }

    // 5. Render Choices
    renderChoices(q, index);

    // 6. Update Explanation Box
    const isRevealed = !!State.activeQuiz.revealed[index];
    const expBox = document.getElementById("quiz-explanation");
    const submitBtn = document.getElementById("btn-submit-answer");
    const directNext = document.getElementById("btn-next-question-direct");

    if (isRevealed) {
      renderExplanation(q, index);
      if (expBox) expBox.style.display = "block";
      if (submitBtn) submitBtn.style.display = "none";
      if (directNext) directNext.style.display = "inline-flex";
    } else {
      if (expBox) expBox.style.display = "none";
      if (submitBtn) submitBtn.style.display = State.activeQuiz.userAnswers[index] ? "inline-flex" : "none";
      if (directNext) directNext.style.display = "none";
    }

    // 7. Update Footer Navigation Button States
    const prevBtn = document.getElementById("btn-nav-prev");
    const nextBtn = document.getElementById("btn-nav-next");
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) {
      nextBtn.textContent = index === State.activeQuiz.questions.length - 1 ? "Finish & Score" : "Next →";
    }

    // 8. Update Grid Counts
    updateGridCounts();
  }

  function renderChoices(q, index) {
    const list = document.getElementById("q-choices-list");
    if (!list) return;
    list.innerHTML = "";

    const userPick = State.activeQuiz.userAnswers[index];
    const isRevealed = !!State.activeQuiz.revealed[index];
    const strikes = State.activeQuiz.strikethroughs[index] || new Set();

    const letters = ["A", "B", "C", "D", "E"];
    const choices = q.choices || {};

    letters.forEach(letter => {
      if (!choices[letter]) return;

      const item = document.createElement("div");
      item.className = "choice-item";
      item.setAttribute("data-letter", letter);

      if (strikes.has(letter)) {
        item.classList.add("struck");
      }

      if (userPick === letter) {
        item.classList.add("selected");
      }

      if (isRevealed) {
        if (letter === q.correct) {
          item.classList.add("correct-revealed");
        } else if (userPick === letter) {
          item.classList.add("incorrect-revealed");
        }
      }

      item.innerHTML = `
        <div class="choice-prefix">${letter}</div>
        <div class="choice-text">${formatMathText(choices[letter])}</div>
      `;

      item.addEventListener("click", () => {
        const isStrikeMode = document.getElementById("btn-strike-toggle").classList.contains("active-tool");
        if (isStrikeMode) {
          toggleStrikethrough(letter);
        } else if (!isRevealed) {
          selectChoice(letter);
        }
      });

      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        toggleStrikethrough(letter);
      });

      renderKaTeX(item);
      list.appendChild(item);
    });
  }

  function selectChoice(letter) {
    const idx = State.activeQuiz.currentIndex;
    if (State.activeQuiz.revealed[idx]) return;

    State.activeQuiz.userAnswers[idx] = letter;
    renderChoices(State.activeQuiz.questions[idx], idx);

    const submitBtn = document.getElementById("btn-submit-answer");
    if (submitBtn) submitBtn.style.display = "inline-flex";

    // In Untimed or Timed exams, automatically advance or record
    if (State.activeQuiz.mode !== "tutor") {
      submitCurrentAnswer();
    }
  }

  function toggleStrikethrough(letter) {
    const idx = State.activeQuiz.currentIndex;
    if (!State.activeQuiz.strikethroughs[idx]) {
      State.activeQuiz.strikethroughs[idx] = new Set();
    }
    const strikes = State.activeQuiz.strikethroughs[idx];
    if (strikes.has(letter)) {
      strikes.delete(letter);
    } else {
      strikes.add(letter);
    }
    renderChoices(State.activeQuiz.questions[idx], idx);
  }

  function submitCurrentAnswer() {
    const idx = State.activeQuiz.currentIndex;
    const q = State.activeQuiz.questions[idx];
    const pick = State.activeQuiz.userAnswers[idx];

    if (!pick) {
      alert("Please select an answer choice first.");
      return;
    }

    const isCorrect = pick === q.correct;

    // Record attempt in user history
    State.userHistory.attempts[q.id] = {
      choice: pick,
      isCorrect: isCorrect,
      timestamp: Date.now()
    };
    saveUserHistory();
    updateHeaderStats();

    if (State.activeQuiz.mode === "tutor") {
      State.activeQuiz.revealed[idx] = true;
      renderChoices(q, idx);
      renderExplanation(q, idx);

      const expBox = document.getElementById("quiz-explanation");
      if (expBox) {
        expBox.style.display = "block";
        expBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      const submitBtn = document.getElementById("btn-submit-answer");
      if (submitBtn) submitBtn.style.display = "none";

      const directNext = document.getElementById("btn-next-question-direct");
      if (directNext) directNext.style.display = "inline-flex";
    }

    updateGridCounts();
  }

  function renderExplanation(q, index) {
    const pick = State.activeQuiz.userAnswers[index];
    const isCorrect = pick === q.correct;

    const badge = document.getElementById("exp-result-badge");
    if (badge) {
      badge.textContent = isCorrect ? "✓ Correct" : "✗ Incorrect";
      badge.className = `exp-badge ${isCorrect ? "success" : "danger"}`;
    }

    const keyEl = document.getElementById("exp-correct-key");
    if (keyEl) keyEl.textContent = `Correct Answer: (${q.correct})`;

    const ratEl = document.getElementById("exp-rationale-text");
    if (ratEl) {
      ratEl.innerHTML = formatMathText(q.rationale || "No detailed rationale provided for this question.");
      renderKaTeX(ratEl);
    }

    // High yield pearl
    const pearlBox = document.getElementById("exp-pearl-box");
    const pearlText = document.getElementById("exp-pearl-text");
    if (pearlBox && pearlText) {
      if (q.pearl) {
        pearlText.innerHTML = formatMathText(q.pearl);
        renderKaTeX(pearlText);
        pearlBox.style.display = "block";
      } else {
        pearlBox.style.display = "none";
      }
    }

    // Linked Learning Objectives
    const loBox = document.getElementById("exp-lo-box");
    const loList = document.getElementById("exp-lo-list");
    if (loBox && loList) {
      const los = q.learning_objectives || [];
      if (los.length > 0) {
        loList.innerHTML = los.map(lo => {
          const text = typeof lo === "string" ? lo : (lo.text || lo.id);
          return `<li class="lo-item">${text}</li>`;
        }).join("");
        loBox.style.display = "block";
      } else {
        loBox.style.display = "none";
      }
    }
  }

  function toggleFlag() {
    const idx = State.activeQuiz.currentIndex;
    const q = State.activeQuiz.questions[idx];
    if (!q) return;

    if (State.userHistory.flagged[q.id]) {
      delete State.userHistory.flagged[q.id];
    } else {
      State.userHistory.flagged[q.id] = true;
    }
    saveUserHistory();

    const flagBtn = document.getElementById("btn-flag-toggle");
    if (flagBtn) {
      flagBtn.classList.toggle("flagged", !!State.userHistory.flagged[q.id]);
    }
    updateGridCounts();
  }

  function updateGridCounts() {
    const answeredCount = Object.keys(State.activeQuiz.userAnswers).length;
    const totalCount = State.activeQuiz.questions.length;

    const ansEl = document.getElementById("grid-answered-count");
    if (ansEl) ansEl.textContent = answeredCount;

    const totEl = document.getElementById("grid-total-count");
    if (totEl) totEl.textContent = totalCount;
  }

  function renderNavGrid() {
    const container = document.getElementById("quiz-grid-buttons");
    if (!container) return;
    container.innerHTML = "";

    State.activeQuiz.questions.forEach((q, idx) => {
      const btn = document.createElement("button");
      btn.className = "grid-q-btn";
      btn.textContent = idx + 1;

      if (idx === State.activeQuiz.currentIndex) {
        btn.classList.add("current");
      }

      if (State.activeQuiz.userAnswers[idx]) {
        btn.classList.add("answered");
      }

      if (State.userHistory.flagged[q.id]) {
        btn.classList.add("flagged");
      }

      btn.addEventListener("click", () => {
        loadQuestion(idx);
        document.getElementById("quiz-grid-modal").style.display = "none";
      });

      container.appendChild(btn);
    });
  }

  function finishQuiz() {
    if (State.activeQuiz.timerInterval) {
      clearInterval(State.activeQuiz.timerInterval);
    }

    // Ensure all answered questions are marked revealed
    State.activeQuiz.questions.forEach((q, idx) => {
      State.activeQuiz.revealed[idx] = true;
    });

    renderScoreReport();
    switchView("score-report");
  }

  // 4. SCORE REPORT
  function renderScoreReport() {
    const questions = State.activeQuiz.questions;
    let correct = 0;
    let answered = 0;

    questions.forEach((q, idx) => {
      const pick = State.activeQuiz.userAnswers[idx];
      if (pick) {
        answered++;
        if (pick === q.correct) correct++;
      }
    });

    const scorePct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const elapsed = State.activeQuiz.elapsedSeconds || 1;
    const avgPace = questions.length > 0 ? Math.round(elapsed / questions.length) : 0;

    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    const pctEl = document.getElementById("score-pct");
    if (pctEl) pctEl.textContent = `${scorePct}%`;

    const rawEl = document.getElementById("score-raw");
    if (rawEl) rawEl.textContent = `${correct} / ${questions.length}`;

    const timeEl = document.getElementById("score-time");
    if (timeEl) timeEl.textContent = timeStr;

    const paceEl = document.getElementById("score-pace");
    if (paceEl) paceEl.textContent = `${avgPace}s / Q`;

    // Action handlers
    const revAll = document.getElementById("btn-review-all");
    if (revAll) {
      revAll.onclick = () => {
        startQuizWithQuestions(questions, "tutor", "Review Exam Questions", true);
      };
    }

    const revIncorrect = document.getElementById("btn-review-incorrect");
    if (revIncorrect) {
      revIncorrect.onclick = () => {
        const incorrects = questions.filter((q, idx) => {
          const pick = State.activeQuiz.userAnswers[idx];
          return !pick || pick !== q.correct;
        });
        if (incorrects.length === 0) {
          alert("Congratulations! You answered all questions correctly in this exam!");
          return;
        }
        startQuizWithQuestions(incorrects, "tutor", `Review Incorrect (${incorrects.length} Qs)`, true);
      };
    }

    const retake = document.getElementById("btn-retake-exam");
    if (retake) {
      retake.onclick = () => {
        startQuizWithQuestions(questions, State.activeQuiz.mode, "Retake Exam");
      };
    }
  }

  // 5. BROWSE QBANK VIEW
  function initBrowseView() {
    const examSelect = document.getElementById("browse-exam-filter");
    const weekSelect = document.getElementById("browse-week-filter");
    const searchInput = document.getElementById("browse-search");

    if (examSelect) examSelect.addEventListener("change", renderBrowseList);
    if (weekSelect) weekSelect.addEventListener("change", renderBrowseList);
    if (searchInput) searchInput.addEventListener("input", renderBrowseList);

    renderBrowseList();
  }

  function renderBrowseList() {
    const container = document.getElementById("browse-results-list");
    if (!container) return;

    const exam = document.getElementById("browse-exam-filter").value;
    const week = document.getElementById("browse-week-filter").value;
    const query = document.getElementById("browse-search").value.toLowerCase().trim();

    container.innerHTML = "";

    const filtered = State.allQuestions.filter(q => {
      if (exam !== "all" && q.exam !== exam && (!q.week || !q.week.startsWith(exam))) return false;
      if (week !== "all" && q.week !== week) return false;

      if (query) {
        const fullText = `${q.stem} ${q.lecture} ${q.topic} ${q.rationale} ${q.pearl}`.toLowerCase();
        if (!fullText.includes(query)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card p-4 text-center text-muted">
          <h4>No questions found</h4>
          <p>No questions currently match the selected filters. Use the Quiz Builder or Dashboard to explore learning objectives.</p>
        </div>
      `;
      return;
    }

    const displayList = filtered.slice(0, 50);

    displayList.forEach(q => {
      const card = document.createElement("div");
      card.className = "card mb-3 browse-question-card";

      const attempt = State.userHistory.attempts[q.id];
      let statusBadge = `<span class="badge badge-subtle">Unused</span>`;
      if (attempt) {
        statusBadge = attempt.isCorrect
          ? `<span class="badge badge-success">✓ Correct</span>`
          : `<span class="badge badge-danger">✗ Incorrect</span>`;
      }

      card.innerHTML = `
        <div class="browse-card-header">
          <div>
            <span class="badge badge-primary">${q.week || "E1-W1"}</span>
            <span class="badge badge-subtle">${q.lecture}</span>
            <span class="badge badge-subtle">${q.yield_level || "High"} Yield</span>
          </div>
          <div>${statusBadge}</div>
        </div>
        <div class="browse-stem mt-2">${formatMathText(q.stem)}</div>
        <div class="browse-actions mt-3">
          <button class="btn btn-sm btn-outline btn-toggle-answer">Show Correct Answer & Rationale</button>
        </div>
        <div class="browse-answer-box mt-3" style="display: none;">
          <div style="font-weight: 700; color: var(--accent-emerald);">Correct Answer: (${q.correct})</div>
          <div class="mt-2 text-secondary">${formatMathText(q.rationale)}</div>
          ${q.pearl ? `<div class="mt-2 p-2" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid var(--primary); border-radius: 4px;"><strong>⚡ High-Yield Pearl:</strong> ${formatMathText(q.pearl)}</div>` : ""}
        </div>
      `;

      renderKaTeX(card);

      const toggleBtn = card.querySelector(".btn-toggle-answer");
      const ansBox = card.querySelector(".browse-answer-box");
      toggleBtn.addEventListener("click", () => {
        const isHidden = ansBox.style.display === "none";
        ansBox.style.display = isHidden ? "block" : "none";
        toggleBtn.textContent = isHidden ? "Hide Answer & Rationale" : "Show Correct Answer & Rationale";
      });

      container.appendChild(card);
    });
  }

  
  // Setup USMLE Clinical Tools: Lab Values, Calculator, and Notes
  function setupClinicalModals() {
    // 1. Lab Values Modal
    const labBtn = document.getElementById("btn-lab-values");
    const labModal = document.getElementById("modal-lab-values");
    const closeLabBtn = document.getElementById("btn-close-labs");
    const labSearch = document.getElementById("lab-search-input");

    if (labBtn && labModal) {
      labBtn.addEventListener("click", () => {
        labModal.style.display = "flex";
        if (labSearch) labSearch.focus();
      });
    }

    if (closeLabBtn && labModal) {
      closeLabBtn.addEventListener("click", () => {
        labModal.style.display = "none";
      });
    }

    if (labSearch) {
      labSearch.addEventListener("input", () => {
        const q = labSearch.value.toLowerCase().trim();
        const rows = document.querySelectorAll(".lab-table tr");
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(q) ? "" : "none";
        });

        document.querySelectorAll(".lab-category-section").forEach(sec => {
          const visibleRows = sec.querySelectorAll(".lab-table tr:not([style*='display: none'])");
          sec.style.display = visibleRows.length > 0 ? "block" : "none";
        });
      });
    }

    // 2. Calculator Modal
    const calcBtn = document.getElementById("btn-calc-toggle");
    const calcModal = document.getElementById("modal-calculator");
    const closeCalcBtn = document.getElementById("btn-close-calc");
    const calcDisplay = document.getElementById("calc-display");

    let calcExpression = "0";

    if (calcBtn && calcModal) {
      calcBtn.addEventListener("click", () => {
        calcModal.style.display = "flex";
      });
    }

    if (closeCalcBtn && calcModal) {
      closeCalcBtn.addEventListener("click", () => {
        calcModal.style.display = "none";
      });
    }

    document.querySelectorAll(".calc-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-calc");
        if (val === "C") {
          calcExpression = "0";
        } else if (val === "DEL") {
          calcExpression = calcExpression.length > 1 ? calcExpression.slice(0, -1) : "0";
        } else if (val === "=") {
          try {
            // Clean sanitize eval
            const sanitized = calcExpression.replace(/[^0-9+\-*\/.]/g, "");
            calcExpression = String(eval(sanitized));
          } catch (e) {
            calcExpression = "Error";
          }
        } else if (val === "%") {
          try {
            calcExpression = String(parseFloat(calcExpression) / 100);
          } catch (e) {
            calcExpression = "Error";
          }
        } else {
          if (calcExpression === "0" && val !== ".") {
            calcExpression = val;
          } else {
            calcExpression += val;
          }
        }
        if (calcDisplay) calcDisplay.textContent = calcExpression;
      });
    });

    // 3. Question Notes Scratchpad Modal
    const notesBtn = document.getElementById("btn-notes-toggle");
    const notesModal = document.getElementById("modal-notes");
    const closeNotesBtn = document.getElementById("btn-close-notes");
    const notesTextarea = document.getElementById("notes-textarea");
    const notesTitle = document.getElementById("notes-title");

    if (notesBtn && notesModal) {
      notesBtn.addEventListener("click", () => {
        const idx = State.activeQuiz.currentIndex;
        const q = State.activeQuiz.questions[idx];
        if (!q) {
          alert("Notes are available while inside an active examination item.");
          return;
        }

        if (notesTitle) notesTitle.textContent = `📝 Notes (Item ${idx + 1})`;
        if (notesTextarea) {
          notesTextarea.value = State.userHistory.notes[q.id] || "";
        }
        notesModal.style.display = "flex";
        if (notesTextarea) notesTextarea.focus();
      });
    }

    if (closeNotesBtn && notesModal) {
      closeNotesBtn.addEventListener("click", () => {
        notesModal.style.display = "none";
      });
    }

    if (notesTextarea) {
      notesTextarea.addEventListener("input", () => {
        const idx = State.activeQuiz.currentIndex;
        const q = State.activeQuiz.questions[idx];
        if (q) {
          State.userHistory.notes[q.id] = notesTextarea.value;
          saveUserHistory();
        }
      });
    }

    // Close modals on clicking outside or ESC
    document.querySelectorAll(".usmle-modal").forEach(modal => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".usmle-modal").forEach(m => m.style.display = "none");
        const grid = document.getElementById("quiz-grid-modal");
        if (grid) grid.style.display = "none";
      }
    });
  }

  // DOM Content Loaded Handler
  document.addEventListener("DOMContentLoaded", init);
})();
