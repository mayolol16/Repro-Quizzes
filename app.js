// IMC534 Reproductive & Endocrine USMLE Step 1 QBank Core Engine
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

    // Standard medical subscripts and scientific notation
    s = s.replace(/\$E_2\$/g, "E₂")
         .replace(/\bE_2\b/g, "E₂")
         .replace(/\$PGF2\\alpha\$/gi, "PGF₂α")
         .replace(/PGF2α/gi, "PGF₂α")
         .replace(/PGE2/gi, "PGE₂")
         .replace(/kg\/m\^2/gi, "kg/m²");

    // Unwrap simple numbers or units wrapped in dollar signs (e.g., $>30–40 mIU/mL$)
    s = s.replace(/\$([^$]+)\$/g, (match, p1) => {
      if (!/[\\{}^_]/.test(p1)) {
        return p1;
      }
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
            { left: "$", right: "$", display: false }
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
    lecturesMap: {}, // key -> { name, week, count, questions: [] }
    topicsMap: {},   // topic -> { topic, week, lecture, attempts: 0, correct: 0, questions: [] }
    userHistory: {
      attempts: {}, // qId -> { choice, isCorrect, timestamp }
      flagged: {}   // qId -> true
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
    filterWeek: "all",
    theme: "dark"
  };

  // LocalStorage Keys
  const STORAGE_KEY = "imc534_qbank_user_data_v1";
  const THEME_KEY = "imc534_qbank_theme";

  // Initialization
  async function init() {
    loadUserHistory();
    loadTheme();
    setupNavigation();
    setupThemeToggle();

    // Load questions from window global (questions_data.js) or fetch json fallback
    if (window.ALL_QUESTIONS && Array.isArray(window.ALL_QUESTIONS) && window.ALL_QUESTIONS.length > 0) {
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
        console.error("Failed to load questions:", err);
        alert("Error loading questions. Ensure questions.json or questions_data.js is present.");
      }
    }
  }

  function onDataLoaded() {
    document.getElementById("total-q-badge").textContent = State.allQuestions.length;
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
          flagged: parsed.flagged || {}
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
    const saved = localStorage.getItem(THEME_KEY) || "dark";
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
    btn.addEventListener("click", () => {
      State.theme = State.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, State.theme);
      applyTheme(State.theme);
    });
  }

  // Build lectures and topics maps for structured analytics
  function buildMetadataMaps() {
    State.lecturesMap = {};
    State.topicsMap = {};

    State.allQuestions.forEach(q => {
      // Lecture map
      if (!State.lecturesMap[q.lecture]) {
        State.lecturesMap[q.lecture] = {
          name: q.lecture,
          week: q.week,
          questions: []
        };
      }
      State.lecturesMap[q.lecture].questions.push(q);

      // Topic / Learning Objective map
      const topicKey = `${q.week}::${q.lecture}::${q.topic}`;
      if (!State.topicsMap[topicKey]) {
        State.topicsMap[topicKey] = {
          key: topicKey,
          topic: q.topic,
          lecture: q.lecture,
          week: q.week,
          questions: []
        };
      }
      State.topicsMap[topicKey].questions.push(q);
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

    document.querySelector(".app-logo").addEventListener("click", () => {
      switchView("dashboard");
    });
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
      if (State.userHistory.attempts[k].isCorrect) correctCount++;
    });

    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

    document.getElementById("hdr-accuracy").textContent = attemptedCount > 0 ? accuracy + "%" : "0%";
    document.getElementById("hdr-completed").textContent = `${attemptedCount} / ${totalCount}`;
  }

  // 1. DASHBOARD & WEAKNESS ENGINE
  function initDashboard() {
    document.getElementById("btn-quick-drill").addEventListener("click", () => {
      drillWeaknesses(20);
    });

    document.getElementById("btn-quick-random").addEventListener("click", () => {
      startQuickRandom(10);
    });

    document.getElementById("btn-drill-flagged").addEventListener("click", () => {
      startFlaggedQuiz();
    });

    document.getElementById("btn-reset-stats").addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all quiz attempts and question history? This cannot be undone.")) {
        State.userHistory = { attempts: {}, flagged: {} };
        saveUserHistory();
        updateDashboardStats();
        updateHeaderStats();
        alert("Progress stats have been reset.");
      }
    });

    // Week card buttons
    document.querySelectorAll(".btn-test-week").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const week = e.target.getAttribute("data-week");
        startWeekQuiz(week, 20);
      });
    });

    // Diagnostic table filters
    const searchInput = document.getElementById("lo-search");
    const statusFilter = document.getElementById("lo-filter-status");
    searchInput.addEventListener("input", renderLOTable);
    statusFilter.addEventListener("change", renderLOTable);

    updateDashboardStats();
  }

  function updateDashboardStats() {
    const totalQuestions = State.allQuestions.length;
    const attemptedKeys = Object.keys(State.userHistory.attempts);
    const attemptedCount = attemptedKeys.length;

    let correctCount = 0;
    attemptedKeys.forEach(k => {
      if (State.userHistory.attempts[k].isCorrect) correctCount++;
    });

    const overallAcc = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const coverage = totalQuestions > 0 ? ((attemptedCount / totalQuestions) * 100).toFixed(1) : 0;

    // Overall Accuracy Card
    const accElem = document.getElementById("dash-accuracy");
    const accBadge = document.getElementById("dash-acc-badge");
    const accFill = document.getElementById("dash-acc-fill");
    const correctSub = document.getElementById("dash-correct-sub");

    if (attemptedCount > 0) {
      accElem.textContent = overallAcc + "%";
      accFill.style.width = overallAcc + "%";
      correctSub.textContent = `${correctCount} correct out of ${attemptedCount} attempted`;

      if (overallAcc >= 75) {
        accBadge.textContent = "Strong Mastery";
        accBadge.className = "stat-card-badge";
        accFill.style.background = "var(--accent-emerald)";
      } else if (overallAcc >= 60) {
        accBadge.textContent = "Passing Standard";
        accBadge.className = "stat-card-badge warning";
        accFill.style.background = "var(--accent-amber)";
      } else {
        accBadge.textContent = "Review Needed";
        accBadge.className = "stat-card-badge danger";
        accFill.style.background = "var(--accent-rose)";
      }
    } else {
      accElem.textContent = "--%";
      accFill.style.width = "0%";
      accBadge.textContent = "No data";
      correctSub.textContent = "0 correct out of 0 attempted";
    }

    // Coverage Card
    document.getElementById("dash-coverage").textContent = coverage + "%";
    document.getElementById("dash-cov-fill").style.width = coverage + "%";
    document.getElementById("dash-unused-sub").textContent = `${totalQuestions - attemptedCount} unused questions remaining`;

    // Flagged Card
    const flaggedCount = Object.keys(State.userHistory.flagged).filter(k => State.userHistory.flagged[k]).length;
    document.getElementById("dash-flagged-count").textContent = flaggedCount;
    document.getElementById("btn-drill-flagged").style.display = flaggedCount > 0 ? "inline-block" : "none";

    // Weeks and Modules Stats
    const moduleDefs = [
      { id: "w1", filter: q => q.week === "W1" },
      { id: "w2", filter: q => q.week === "W2" },
      { id: "w3", filter: q => q.week === "W3" },
      { id: "nb", filter: q => q.week.startsWith("Notebook") },
      { id: "ph", filter: q => q.week === "Pharmacology" }
    ];

    moduleDefs.forEach(mod => {
      const mQuestions = State.allQuestions.filter(mod.filter);
      const mAttempted = mQuestions.filter(q => State.userHistory.attempts[q.id]);
      const mCorrect = mAttempted.filter(q => State.userHistory.attempts[q.id].isCorrect);
      const mAcc = mAttempted.length > 0 ? Math.round((mCorrect.length / mAttempted.length) * 100) : null;

      const accEl = document.getElementById(`${mod.id}-acc`);
      const countEl = document.getElementById(`${mod.id}-count`);
      const fillEl = document.getElementById(`${mod.id}-fill`);

      if (accEl && countEl && fillEl) {
        if (mAcc !== null) {
          accEl.textContent = mAcc + "%";
          accEl.style.color = mAcc >= 70 ? "var(--accent-emerald)" : (mAcc >= 55 ? "var(--accent-amber)" : "var(--accent-rose)");
          fillEl.style.width = mAcc + "%";
        } else {
          accEl.textContent = "--%";
          accEl.style.color = "var(--text-secondary)";
          fillEl.style.width = "0%";
        }
        countEl.textContent = `${mAttempted.length} / ${mQuestions.length} answered`;
      }
    });

    // High Risk Weaknesses Count (<70%)
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
      if (topAttempted >= 2 && (topCorrect / topAttempted) < 0.7) {
        weakCount++;
      }
    });
    document.getElementById("dash-weak-count").textContent = weakCount;

    renderLOTable();
    updateHeaderStats();
  }

  // Render the Learning Objectives Diagnostic Table
  function renderLOTable() {
    const tbody = document.getElementById("lo-table-body");
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
      return a.topic.localeCompare(b.topic);
    });

    let renderedCount = 0;

    topicsArray.forEach(item => {
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
      if (item.attempted === 0) {
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
        <td><span class="week-tag">${item.week}</span></td>
        <td style="font-weight: 600;">${item.lecture}</td>
        <td><strong>${item.topic}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${item.questions.length} Qs)</span></td>
        <td>${item.attempted} / ${item.questions.length}</td>
        <td style="font-family: var(--font-mono); font-weight: 700;">${accText}</td>
        <td>${statusHtml}</td>
        <td>
          <button class="btn btn-sm btn-outline btn-drill-topic" data-topic-key="${encodeURIComponent(item.key)}">
            Practice
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
          startQuizWithQuestions(top.questions, "tutor", `Topic Practice: ${top.topic}`);
        }
      });
    });

    if (renderedCount === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No learning objectives match your criteria.</td>`;
      tbody.appendChild(tr);
    }
  }

  // 2. QUIZ BUILDER & LAUNCHERS
  function initQuizBuilder() {
    renderLectureChecklist();

    // Mode cards selection
    document.querySelectorAll(".mode-card").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".mode-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector("input[type='radio']");
        radio.checked = true;
      });
    });

    // Pool chips selection
    document.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        const radio = chip.querySelector("input[type='radio']");
        radio.checked = true;
        updateBuilderCounts();
      });
    });

    // Count selector buttons
    document.querySelectorAll(".btn-count").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-count").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("custom-count").value = "";
      });
    });

    document.getElementById("custom-count").addEventListener("input", () => {
      document.querySelectorAll(".btn-count").forEach(b => b.classList.remove("active"));
    });

    // Week tabs in builder
    document.querySelectorAll(".week-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".week-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const week = pill.getAttribute("data-week");
        filterChecklistByWeek(week);
      });
    });

    // Select/Deselect all
    document.getElementById("select-all-lectures").addEventListener("click", () => {
      document.querySelectorAll(".lecture-check-item input[type='checkbox']").forEach(cb => cb.checked = true);
      updateBuilderCounts();
    });

    document.getElementById("deselect-all-lectures").addEventListener("click", () => {
      document.querySelectorAll(".lecture-check-item input[type='checkbox']").forEach(cb => cb.checked = false);
      updateBuilderCounts();
    });

    // Start Button
    document.getElementById("btn-start-configured-quiz").addEventListener("click", launchConfiguredQuiz);
  }

  function renderLectureChecklist() {
    const container = document.getElementById("lecture-checklist-container");
    container.innerHTML = "";

    const sortedLectures = Object.values(State.lecturesMap).sort((a, b) => {
      if (a.week !== b.week) return a.week.localeCompare(b.week);
      return a.name.localeCompare(b.name);
    });

    sortedLectures.forEach(lec => {
      const label = document.createElement("label");
      label.className = "lecture-check-item";
      label.setAttribute("data-week", lec.week);
      label.innerHTML = `
        <div>
          <input type="checkbox" value="${lec.name}" checked>
          <span class="week-tag" style="margin-right: 0.4rem;">${lec.week}</span>
          <span>${lec.name}</span>
        </div>
        <span class="lec-qcount">${lec.questions.length} Qs</span>
      `;
      label.querySelector("input").addEventListener("change", updateBuilderCounts);
      container.appendChild(label);
    });
  }

  function filterChecklistByWeek(week) {
    document.querySelectorAll(".lecture-check-item").forEach(item => {
      if (week === "all" || item.getAttribute("data-week") === week) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  function updateBuilderCounts() {
    const selectedLectures = Array.from(document.querySelectorAll(".lecture-check-item input:checked")).map(cb => cb.value);
    const poolFilter = document.querySelector("input[name='pool-filter']:checked").value;

    let matching = State.allQuestions.filter(q => selectedLectures.includes(q.lecture));

    if (poolFilter === "unused") {
      matching = matching.filter(q => !State.userHistory.attempts[q.id]);
    } else if (poolFilter === "incorrect") {
      matching = matching.filter(q => State.userHistory.attempts[q.id] && !State.userHistory.attempts[q.id].isCorrect);
    } else if (poolFilter === "flagged") {
      matching = matching.filter(q => State.userHistory.flagged[q.id]);
    } else if (poolFilter === "weak") {
      // Find weak topics
      const weakKeys = new Set();
      Object.values(State.topicsMap).forEach(top => {
        let att = 0, corr = 0;
        top.questions.forEach(q => {
          if (State.userHistory.attempts[q.id]) {
            att++;
            if (State.userHistory.attempts[q.id].isCorrect) corr++;
          }
        });
        if (att > 0 && (corr / att) < 0.7) {
          weakKeys.add(top.key);
        }
      });
      matching = matching.filter(q => weakKeys.has(`${q.week}::${q.lecture}::${q.topic}`));
    }

    document.getElementById("matching-q-count").textContent = matching.length;
    return matching;
  }

  function launchConfiguredQuiz() {
    const matching = updateBuilderCounts();
    if (matching.length === 0) {
      alert("No questions match your selected criteria. Try selecting more lectures or adjusting your question pool filter.");
      return;
    }

    const mode = document.querySelector("input[name='test-mode']:checked").value;

    // Determine count
    let count = 10;
    const activeCountBtn = document.querySelector(".btn-count.active");
    if (activeCountBtn) {
      count = parseInt(activeCountBtn.getAttribute("data-count"), 10);
    } else {
      const customVal = parseInt(document.getElementById("custom-count").value, 10);
      if (customVal && customVal > 0) count = customVal;
    }

    // Shuffle and pick subset
    const shuffled = [...matching].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, matching.length));

    startQuizWithQuestions(selected, mode, `Custom Test (${selected.length} Questions)`);
  }

  // Quick Action Launcher Helpers
  function drillWeaknesses(count = 20) {
    // Collect questions from lowest accuracy topics
    const weakTopics = Object.values(State.topicsMap)
      .map(top => {
        let att = 0, corr = 0;
        top.questions.forEach(q => {
          if (State.userHistory.attempts[q.id]) {
            att++;
            if (State.userHistory.attempts[q.id].isCorrect) corr++;
          }
        });
        const acc = att > 0 ? (corr / att) : 1.0;
        return { top, att, acc };
      })
      .filter(item => item.att > 0 && item.acc < 0.7)
      .sort((a, b) => a.acc - b.acc);

    let candidateQuestions = [];
    weakTopics.forEach(item => {
      candidateQuestions.push(...item.top.questions);
    });

    // If candidate questions is empty (user has not answered yet or has 100%), take random
    if (candidateQuestions.length === 0) {
      alert("No weaknesses detected yet! Starting a random 20-question diagnostic test instead.");
      startQuickRandom(count);
      return;
    }

    // Deduplicate
    candidateQuestions = Array.from(new Set(candidateQuestions));
    const shuffled = candidateQuestions.sort(() => 0.5 - Math.random()).slice(0, count);
    startQuizWithQuestions(shuffled, "tutor", `Targeted Weakness Drill (${shuffled.length} Questions)`);
  }

  function startQuickRandom(count = 10) {
    const shuffled = [...State.allQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
    startQuizWithQuestions(shuffled, "tutor", `Random Tutor Session (${shuffled.length} Qs)`);
  }

  function startWeekQuiz(week, count = 20) {
    let weekQs = [];
    let title = "";
    if (week === "Notebooks") {
      weekQs = State.allQuestions.filter(q => q.week.startsWith("Notebook"));
      title = "Repro Notebooks Practice";
    } else if (week === "Pharmacology") {
      weekQs = State.allQuestions.filter(q => q.week === "Pharmacology");
      title = "Pharmacology Practice";
    } else {
      weekQs = State.allQuestions.filter(q => q.week === week);
      title = `${week} Targeted Practice`;
    }
    const shuffled = weekQs.sort(() => 0.5 - Math.random()).slice(0, count);
    startQuizWithQuestions(shuffled, "tutor", `${title} (${shuffled.length} Qs)`);
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
  function startQuizWithQuestions(questions, mode, title) {
    if (!questions || questions.length === 0) return;

    State.activeQuiz = {
      mode: mode, // "tutor", "timed", "untimed"
      questions: questions,
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

    // Show nav tab for active quiz
    const navTab = document.getElementById("nav-active-quiz");
    navTab.style.display = "inline-flex";

    // Setup Toolbar
    document.getElementById("active-mode-badge").textContent =
      mode === "tutor" ? "👨‍🏫 Tutor Mode" : (mode === "timed" ? "⏱️ Timed Block" : "📋 Untimed Block");

    initQuizTimer();
    initQuizNavigationControls();
    loadQuestion(0);
    switchView("active-quiz");
  }

  function initQuizTimer() {
    if (State.activeQuiz.timerInterval) {
      clearInterval(State.activeQuiz.timerInterval);
    }

    const timerDisplay = document.getElementById("quiz-timer-display");
    const pauseBtn = document.getElementById("btn-timer-pause");

    // Timed mode countdown vs standard elapsed
    const isTimed = State.activeQuiz.mode === "timed";
    let countdownRemaining = isTimed ? State.activeQuiz.questions.length * 75 : 0; // 75 sec / question

    State.activeQuiz.timerInterval = setInterval(() => {
      if (State.activeQuiz.isPaused) return;

      State.activeQuiz.elapsedSeconds++;

      if (isTimed) {
        countdownRemaining--;
        if (countdownRemaining <= 0) {
          clearInterval(State.activeQuiz.timerInterval);
          alert("Time has expired for this examination block! Submitting block automatically.");
          finishQuiz();
          return;
        }
        timerDisplay.textContent = formatTime(countdownRemaining);
      } else {
        timerDisplay.textContent = formatTime(State.activeQuiz.elapsedSeconds);
      }
    }, 1000);

    pauseBtn.onclick = () => {
      State.activeQuiz.isPaused = !State.activeQuiz.isPaused;
      pauseBtn.textContent = State.activeQuiz.isPaused ? "▶️" : "⏸️";
    };
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function initQuizNavigationControls() {
    document.getElementById("btn-prev-q").onclick = () => {
      if (State.activeQuiz.currentIndex > 0) {
        loadQuestion(State.activeQuiz.currentIndex - 1);
      }
    };

    document.getElementById("btn-next-q").onclick = () => {
      if (State.activeQuiz.currentIndex < State.activeQuiz.questions.length - 1) {
        loadQuestion(State.activeQuiz.currentIndex + 1);
      }
    };

    document.getElementById("btn-submit-answer").onclick = () => {
      submitCurrentAnswer();
    };

    document.getElementById("btn-end-block").onclick = () => {
      const answeredCount = Object.keys(State.activeQuiz.userAnswers).length;
      const totalCount = State.activeQuiz.questions.length;
      if (answeredCount < totalCount) {
        if (!confirm(`You have answered ${answeredCount} of ${totalCount} questions. Are you sure you want to end this block now?`)) {
          return;
        }
      }
      finishQuiz();
    };

    // Flag toggle
    const flagBtn = document.getElementById("btn-flag-toggle");
    flagBtn.onclick = () => {
      const q = State.activeQuiz.questions[State.activeQuiz.currentIndex];
      const isFlagged = !State.userHistory.flagged[q.id];
      State.userHistory.flagged[q.id] = isFlagged;
      saveUserHistory();
      updateFlagUI(isFlagged);
      updateHeaderStats();
    };

    // Strikethrough tool toggle
    const strikeBtn = document.getElementById("btn-strike-toggle");
    strikeBtn.onclick = () => {
      strikeBtn.classList.toggle("active-tool");
    };

    // Highlighter tool toggle
    const highlightToggleBtn = document.getElementById("btn-highlight-toggle");
    highlightToggleBtn.onclick = () => {
      State.activeQuiz.autoHighlightMode = !State.activeQuiz.autoHighlightMode;
      highlightToggleBtn.classList.toggle("active-highlight", State.activeQuiz.autoHighlightMode);
    };

    // Clear highlights button
    const clearHighlightsBtn = document.getElementById("btn-clear-highlights");
    clearHighlightsBtn.onclick = () => {
      clearAllCurrentHighlights();
    };

    // Floating Highlight Bubble buttons
    document.querySelectorAll(".bubble-btn").forEach(btn => {
      btn.onmousedown = (e) => {
        e.preventDefault(); // prevent losing selection
      };
      btn.onclick = (e) => {
        e.stopPropagation();
        const color = btn.getAttribute("data-color") || "yellow";
        applyHighlight(color);
      };
    });

    // Text selection listener on question stem
    const stemElement = document.getElementById("q-stem-text");
    document.addEventListener("mouseup", (e) => {
      const bubble = document.getElementById("floating-highlight-bubble");
      if (bubble && bubble.contains(e.target)) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        hideFloatingBubble();
        return;
      }

      const range = selection.getRangeAt(0);
      if (stemElement && stemElement.contains(range.commonAncestorContainer) && selection.toString().trim().length > 0) {
        if (State.activeQuiz.autoHighlightMode) {
          applyHighlight("yellow");
        } else {
          showFloatingBubble(range);
        }
      } else {
        hideFloatingBubble();
      }
    });

    // Global keyboard shortcuts for USMLE exam simulation
    document.addEventListener("keydown", (e) => {
      // Ignore if user is typing in search or input fields
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

      const key = e.key.toUpperCase();

      if (key === "H") {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          applyHighlight("yellow");
        } else {
          highlightToggleBtn.click();
        }
      } else if (key === "S") {
        strikeBtn.click();
      } else if (key === "F") {
        document.getElementById("btn-flag-toggle").click();
      }
    });

    // Jump Drawer
    const drawerBtn = document.getElementById("btn-open-nav-drawer");
    const drawer = document.getElementById("q-nav-drawer");
    const closeDrawerBtn = document.getElementById("btn-close-drawer");

    drawerBtn.onclick = () => {
      drawer.style.display = drawer.style.display === "none" ? "block" : "none";
      renderNavGrid();
    };

    closeDrawerBtn.onclick = () => {
      drawer.style.display = "none";
    };
  }

  function updateFlagUI(isFlagged) {
    const flagBtn = document.getElementById("btn-flag-toggle");
    flagBtn.classList.toggle("active-flag", isFlagged);
  }

  function loadQuestion(index) {
    State.activeQuiz.currentIndex = index;
    const q = State.activeQuiz.questions[index];
    const total = State.activeQuiz.questions.length;

    // Header counter
    document.getElementById("active-q-counter").textContent = `Question ${index + 1} of ${total}`;

    // Previous/Next button states
    document.getElementById("btn-prev-q").disabled = (index === 0);
    document.getElementById("btn-next-q").disabled = (index === total - 1);

    // Meta badges
    document.getElementById("q-meta-week").textContent = q.week;
    document.getElementById("q-meta-lecture").textContent = q.lecture;
    document.getElementById("q-meta-topic").textContent = q.topic;

    // Stem
    const stemEl = document.getElementById("q-stem-text");
    if (State.activeQuiz.stemHighlights && State.activeQuiz.stemHighlights[index]) {
      stemEl.innerHTML = State.activeQuiz.stemHighlights[index];
      rebindHighlightListeners();
    } else {
      stemEl.innerHTML = formatMathText(q.stem);
      renderKaTeX(stemEl);
    }
    updateClearHighlightsBtn();
    hideFloatingBubble();

    // Flag state
    const isFlagged = !!State.userHistory.flagged[q.id];
    updateFlagUI(isFlagged);

    // Render Choices
    renderChoices(q, index);

    // Explanation Card visibility
    const expCard = document.getElementById("q-explanation-card");
    const submitBtn = document.getElementById("btn-submit-answer");

    if (State.activeQuiz.revealed[index]) {
      showExplanation(q, State.activeQuiz.userAnswers[index]);
      submitBtn.style.display = "none";
    } else {
      expCard.style.display = "none";
      submitBtn.style.display = State.activeQuiz.mode === "tutor" ? "inline-flex" : "none";
      submitBtn.disabled = !State.activeQuiz.userAnswers[index];
    }
  }

  function renderChoices(q, index) {
    const container = document.getElementById("q-choices-container");
    container.innerHTML = "";

    const letters = ["A", "B", "C", "D", "E"];
    const chosen = State.activeQuiz.userAnswers[index];
    const isRevealed = !!State.activeQuiz.revealed[index];
    const strikes = State.activeQuiz.strikethroughs[index] || new Set();

    letters.forEach(letter => {
      if (!q.choices[letter]) return;

      const item = document.createElement("div");
      item.className = "choice-item";
      if (isRevealed) item.classList.add("locked");
      if (chosen === letter) item.classList.add("selected");
      if (strikes.has(letter)) item.classList.add("strikethrough");

      // Color coding if revealed
      if (isRevealed) {
        if (letter === q.correct) {
          item.classList.add("is-correct");
        } else if (chosen === letter && letter !== q.correct) {
          item.classList.add("is-incorrect");
        }
      }

      item.innerHTML = `
        <div class="choice-letter">${letter}</div>
        <div class="choice-text">${formatMathText(q.choices[letter])}</div>
      `;
      renderKaTeX(item.querySelector(".choice-text"));

      item.addEventListener("click", () => {
        const isStrikeMode = document.getElementById("btn-strike-toggle").classList.contains("active-tool");

        if (isStrikeMode) {
          if (!State.activeQuiz.strikethroughs[index]) {
            State.activeQuiz.strikethroughs[index] = new Set();
          }
          if (State.activeQuiz.strikethroughs[index].has(letter)) {
            State.activeQuiz.strikethroughs[index].delete(letter);
            item.classList.remove("strikethrough");
          } else {
            State.activeQuiz.strikethroughs[index].add(letter);
            item.classList.add("strikethrough");
          }
          return;
        }

        if (isRevealed) return; // Answer locked

        // Select choice
        State.activeQuiz.userAnswers[index] = letter;
        container.querySelectorAll(".choice-item").forEach(c => c.classList.remove("selected"));
        item.classList.add("selected");

        const submitBtn = document.getElementById("btn-submit-answer");
        submitBtn.disabled = false;

        // In Exam modes, auto-save choice to global history upon end
      });

      container.appendChild(item);
    });
  }

  function submitCurrentAnswer() {
    const index = State.activeQuiz.currentIndex;
    const q = State.activeQuiz.questions[index];
    const chosen = State.activeQuiz.userAnswers[index];

    if (!chosen) return;

    const isCorrect = (chosen === q.correct);
    State.activeQuiz.revealed[index] = true;

    // Record in global user history for persistent learning objective tracking
    State.userHistory.attempts[q.id] = {
      choice: chosen,
      isCorrect: isCorrect,
      timestamp: Date.now()
    };
    saveUserHistory();
    updateHeaderStats();

    // Re-render choices with green/red highlight
    renderChoices(q, index);

    // Show Explanation
    showExplanation(q, chosen);

    document.getElementById("btn-submit-answer").style.display = "none";
  }

  function showExplanation(q, chosen) {
    const expCard = document.getElementById("q-explanation-card");
    const statusBanner = document.getElementById("exp-status-banner");
    const statusIcon = document.getElementById("exp-status-icon");
    const statusTitle = document.getElementById("exp-status-title");
    const rationaleText = document.getElementById("exp-rationale-text");
    const pearlText = document.getElementById("exp-pearl-text");

    const isCorrect = (chosen === q.correct);

    statusBanner.className = "explanation-header " + (isCorrect ? "correct" : "incorrect");
    statusIcon.textContent = isCorrect ? "✓" : "✕";
    statusTitle.textContent = isCorrect
      ? `Correct! Answer is (${q.correct})`
      : `Incorrect. Your answer was (${chosen || "None"}); Correct answer is (${q.correct})`;

    rationaleText.innerHTML = formatMathText(q.rationale || "No detailed rationale available.");
    pearlText.innerHTML = formatMathText(q.pearl || "Keep testing key mechanisms from First Aid 2025!");
    renderKaTeX(rationaleText);
    renderKaTeX(pearlText);

    expCard.style.display = "block";
    expCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderNavGrid() {
    const grid = document.getElementById("q-nav-grid");
    grid.innerHTML = "";

    State.activeQuiz.questions.forEach((q, i) => {
      const btn = document.createElement("button");
      btn.className = "drawer-q-btn";
      btn.textContent = (i + 1);

      if (i === State.activeQuiz.currentIndex) {
        btn.classList.add("current");
      }

      const answered = State.activeQuiz.userAnswers[i];
      if (answered) {
        btn.classList.add("answered");
      }

      if (State.activeQuiz.revealed[i]) {
        btn.classList.add(answered === q.correct ? "correct" : "incorrect");
      }

      btn.addEventListener("click", () => {
        loadQuestion(i);
        document.getElementById("q-nav-drawer").style.display = "none";
      });

      grid.appendChild(btn);
    });
  }

  // 4. BLOCK FINISH & SCORE REPORT
  function finishQuiz() {
    if (State.activeQuiz.timerInterval) {
      clearInterval(State.activeQuiz.timerInterval);
    }

    // In Exam modes, reveal all answers and record remaining attempts
    State.activeQuiz.questions.forEach((q, idx) => {
      const chosen = State.activeQuiz.userAnswers[idx];
      if (chosen) {
        const isCorrect = (chosen === q.correct);
        State.userHistory.attempts[q.id] = {
          choice: chosen,
          isCorrect: isCorrect,
          timestamp: Date.now()
        };
      }
      State.activeQuiz.revealed[idx] = true;
    });
    saveUserHistory();
    updateHeaderStats();

    // Hide active quiz tab
    document.getElementById("nav-active-quiz").style.display = "none";

    renderScoreReport();
    switchView("score-report");
  }

  function renderScoreReport() {
    const questions = State.activeQuiz.questions;
    let correctCount = 0;
    let attemptedCount = 0;

    questions.forEach((q, idx) => {
      const chosen = State.activeQuiz.userAnswers[idx];
      if (chosen) {
        attemptedCount++;
        if (chosen === q.correct) correctCount++;
      }
    });

    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    document.getElementById("rep-percentage").textContent = percentage + "%";
    document.getElementById("rep-fraction").textContent = `${correctCount} / ${questions.length} Correct`;

    const elapsed = State.activeQuiz.elapsedSeconds;
    document.getElementById("rep-time").textContent = formatTime(elapsed);

    const avgPace = questions.length > 0 ? Math.round(elapsed / questions.length) : 0;
    document.getElementById("rep-pace").textContent = `${avgPace}s / Q`;

    const flaggedCount = questions.filter(q => State.userHistory.flagged[q.id]).length;
    document.getElementById("rep-flagged").textContent = flaggedCount;

    // Report Question Grid
    const grid = document.getElementById("report-q-grid");
    grid.innerHTML = "";

    questions.forEach((q, idx) => {
      const chosen = State.activeQuiz.userAnswers[idx];
      const isCorrect = (chosen === q.correct);

      const btn = document.createElement("button");
      btn.className = "rep-grid-btn " + (chosen ? (isCorrect ? "correct" : "incorrect") : "");
      btn.innerHTML = `
        <span>Q${idx + 1}</span>
        <small>${chosen ? (isCorrect ? "✓" : "✕") : "--"}</small>
      `;

      btn.addEventListener("click", () => {
        // Return to active quiz in review mode for this question
        document.getElementById("nav-active-quiz").style.display = "inline-flex";
        loadQuestion(idx);
        switchView("active-quiz");
      });

      grid.appendChild(btn);
    });

    // Score Report Action Buttons
    document.getElementById("btn-review-all-qs").onclick = () => {
      document.getElementById("nav-active-quiz").style.display = "inline-flex";
      loadQuestion(0);
      switchView("active-quiz");
    };

    document.getElementById("btn-report-new-quiz").onclick = () => {
      switchView("create-quiz");
    };

    document.getElementById("btn-report-to-dashboard").onclick = () => {
      switchView("dashboard");
    };
  }

  // 5. BROWSE ALL QUESTIONS VIEW
  function initBrowseView() {
    const weekSelect = document.getElementById("browse-week-filter");
    const lectureSelect = document.getElementById("browse-lecture-filter");
    const searchInput = document.getElementById("browse-search");

    // Populate lectures dropdown
    const lectures = Object.values(State.lecturesMap).sort((a, b) => a.name.localeCompare(b.name));
    lectures.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.name;
      opt.textContent = `[${l.week}] ${l.name}`;
      lectureSelect.appendChild(opt);
    });

    weekSelect.addEventListener("change", () => renderBrowseList());
    lectureSelect.addEventListener("change", () => renderBrowseList());
    searchInput.addEventListener("input", () => renderBrowseList());

    renderBrowseList();
  }

  function renderBrowseList() {
    const container = document.getElementById("browse-cards-container");
    const countLabel = document.getElementById("browse-count-label");
    const weekFilter = document.getElementById("browse-week-filter").value;
    const lectureFilter = document.getElementById("browse-lecture-filter").value;
    const query = document.getElementById("browse-search").value.toLowerCase().trim();

    container.innerHTML = "";

    const filtered = State.allQuestions.filter(q => {
      if (weekFilter !== "all" && q.week !== weekFilter) return false;
      if (lectureFilter !== "all" && q.lecture !== lectureFilter) return false;
      if (query) {
        const text = (q.stem + " " + q.topic + " " + q.lecture + " " + q.rationale + " " + q.pearl).toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    countLabel.textContent = `Showing ${filtered.length} of ${State.allQuestions.length} questions`;

    // Limit initial render to 50 for max UI responsiveness
    const displayList = filtered.slice(0, 50);

    displayList.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "browse-q-card";

      const isAttempted = State.userHistory.attempts[q.id];
      let attemptStatus = "<span style='color: var(--text-muted);'>Untested</span>";
      if (isAttempted) {
        attemptStatus = isAttempted.isCorrect
          ? "<span style='color: var(--accent-emerald); font-weight: 700;'>✓ Answered Correct</span>"
          : "<span style='color: var(--accent-rose); font-weight: 700;'>✕ Answered Incorrect</span>";
      }

      card.innerHTML = `
        <div class="browse-q-top">
          <div>
            <span class="badge badge-week">${q.week}</span>
            <span class="badge badge-topic">${q.topic}</span>
          </div>
          <div style="font-size: 0.8rem;">${attemptStatus}</div>
        </div>
        <div class="browse-q-stem">${formatMathText(q.stem)}</div>
        <div class="browse-q-footer">
          <span style="color: var(--text-muted); font-size: 0.8rem;">Lecture: <strong>${q.lecture}</strong></span>
          <button class="btn btn-sm btn-primary btn-practice-single" data-qid="${q.id}">Practice This Question</button>
        </div>
      `;

      card.querySelector(".btn-practice-single").addEventListener("click", () => {
        startQuizWithQuestions([q], "tutor", `Single Question Practice`);
      });

      container.appendChild(card);
    });

    if (filtered.length > 50) {
      const moreHint = document.createElement("div");
      moreHint.style.textAlign = "center";
      moreHint.style.padding = "1rem";
      moreHint.style.color = "var(--text-muted)";
      moreHint.textContent = `+ ${filtered.length - 50} more questions matching. Use search filters to narrow down.`;
      container.appendChild(moreHint);
    }
  }

  // Start app on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
