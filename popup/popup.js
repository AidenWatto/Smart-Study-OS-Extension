// State management
const state = {
  timer: {
    mode: 25,
    workDuration: 25,
    breakDuration: 5,
    isRunning: false,
    isBreak: false,
    secondsLeft: 25 * 60,
    sessionsToday: 0
  },
  dashboard: {
    hoursStudied: 0,
    tasksCompleted: 0,
    streak: 0,
    totalXP: 0,
    dailyTarget: 4,
    tasks: []
  },
  settings: {
    soundEnabled: true
  }
};

// DOM Elements
const elements = {
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  // Timer
  timerDisplay: document.getElementById('timer-display'),
  timerLabel: document.getElementById('timer-label'),
  timerProgress: document.getElementById('timer-progress'),
  streakDisplay: document.getElementById('streak-count'),
  modeButtons: document.querySelectorAll('.mode-btn'),
  playBtn: document.getElementById('play-btn'),
  resetBtn: document.getElementById('reset-btn'),
  skipBtn: document.getElementById('skip-btn'),
  soundBtn: document.getElementById('sound-btn'),
  sessionsToday: document.getElementById('sessions-today'),
  // Dashboard
  currentDate: document.getElementById('current-date'),
  hoursStudied: document.getElementById('hours-studied'),
  tasksCompleted: document.getElementById('tasks-completed'),
  currentStreak: document.getElementById('current-streak'),
  totalXP: document.getElementById('total-xp'),
  dailyProgressBar: document.getElementById('daily-progress-bar'),
  dailyGoalProgress: document.getElementById('daily-goal-progress'),
  dailyGoalInfo: document.getElementById('daily-goal-info'),
  tasksList: document.getElementById('tasks-list'),
  openAppBtn: document.getElementById('open-app-btn'),
  // Quick Actions
  quickTaskInput: document.getElementById('quick-task-input'),
  quickTaskPriority: document.getElementById('quick-task-priority'),
  addTaskBtn: document.getElementById('add-task-btn'),
  aiQuestionInput: document.getElementById('ai-question-input'),
  askAiBtn: document.getElementById('ask-ai-btn'),
  aiResponse: document.getElementById('ai-response'),
  shortcutBtns: document.querySelectorAll('.shortcut-btn'),
  // Footer
  optionsBtn: document.getElementById('options-btn'),
  helpBtn: document.getElementById('help-btn')
};

// Initialize
async function init() {
  await loadData();
  setupEventListeners();
  updateUI();

  // Set current date
  const now = new Date();
  elements.currentDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

// Load data from Chrome storage
async function loadData() {
  try {
    const data = await chrome.storage.local.get([
      'smartstudyos_timer',
      'smartstudyos_dashboard',
      'smartstudyos_settings',
      'smartstudyos_study_days',
      'smartstudyos_tasks',
      'smartstudyos_xp_events',
      'smartstudyos_focus_sessions'
    ]);

    if (data.smartstudyos_timer) {
      Object.assign(state.timer, data.smartstudyos_timer);
    }

    if (data.smartstudyos_settings) {
      Object.assign(state.settings, data.smartstudyos_settings);
    }

    // Calculate dashboard metrics
    const studyDays = data.smartstudyos_study_days || [];
    const tasks = data.smartstudyos_tasks || [];
    const xpEvents = data.smartstudyos_xp_events || [];
    const focusSessions = data.smartstudyos_focus_sessions || [];

    const today = new Date().toISOString().split('T')[0];
    const todayData = studyDays.find(d => d.date === today) || { hoursStudied: 0, tasksCompleted: 0, focusSessions: 0 };

    state.dashboard.hoursStudied = todayData.hoursStudied || 0;
    state.dashboard.tasksCompleted = tasks.filter(t => t.status === 'completed').length;
    state.dashboard.streak = calculateStreak(studyDays);
    state.dashboard.totalXP = xpEvents.reduce((sum, e) => sum + (e.xp || 0), 0);
    state.dashboard.tasks = tasks.filter(t => t.status !== 'completed').slice(0, 5);

    // Count today's focus sessions
    const todaySessions = focusSessions.filter(s => s.startTime && s.startTime.startsWith(today));
    state.timer.sessionsToday = todaySessions.length;

  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// Calculate streak
function calculateStreak(studyDays) {
  if (!studyDays || studyDays.length === 0) return 0;

  const sorted = [...studyDays].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = new Date(today);

  for (const day of sorted) {
    const expectedStr = checkDate.toISOString().split('T')[0];
    if (day.date === expectedStr && day.hoursStudied > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (day.date < expectedStr) {
      break;
    }
  }

  return streak;
}

// Save data to Chrome storage
async function saveData() {
  try {
    await chrome.storage.local.set({
      smartstudyos_timer: state.timer,
      smartstudyos_settings: state.settings
    });
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Navigation tabs
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Timer mode buttons
  elements.modeButtons.forEach(btn => {
    btn.addEventListener('click', () => setTimerMode(btn.dataset.mode));
  });

  // Timer controls
  elements.playBtn.addEventListener('click', toggleTimer);
  elements.resetBtn.addEventListener('click', resetTimer);
  elements.skipBtn.addEventListener('click', skipToNext);
  elements.soundBtn.addEventListener('click', toggleSound);

  // Dashboard
  elements.openAppBtn.addEventListener('click', openFullApp);

  // Quick actions
  elements.addTaskBtn.addEventListener('click', addQuickTask);
  elements.quickTaskInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addQuickTask();
  });
  elements.askAiBtn.addEventListener('click', askAi);
  elements.aiQuestionInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') askAi();
  });

  // Shortcuts
  elements.shortcutBtns.forEach(btn => {
    btn.addEventListener('click', () => openAppSection(btn.dataset.action));
  });

  // Footer
  elements.optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  elements.helpBtn.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#help') }));

  // Listen for background messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'timer-tick') {
      state.timer.secondsLeft = message.secondsLeft;
      updateTimerDisplay();
    } else if (message.type === 'timer-complete') {
      handleTimerComplete(message.isBreak);
    }
  });
}

// Switch between tabs
function switchTab(tabName) {
  elements.navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Set timer mode
function setTimerMode(mode) {
  elements.modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  state.timer.mode = mode === 'custom' ? 45 : parseInt(mode);
  state.timer.workDuration = mode === 'custom' ? 45 : parseInt(mode);
  state.timer.breakDuration = mode === '50' ? 10 : 5;

  if (!state.timer.isRunning) {
    state.timer.secondsLeft = state.timer.workDuration * 60;
    updateTimerDisplay();
  }
}

// Toggle timer
async function toggleTimer() {
  state.timer.isRunning = !state.timer.isRunning;

  elements.playBtn.classList.toggle('running', state.timer.isRunning);
  updatePlayButtonIcon();

  if (state.timer.isRunning) {
    // Start timer in background
    chrome.runtime.sendMessage({
      type: 'start-timer',
      secondsLeft: state.timer.secondsLeft
    });
  } else {
    // Stop timer
    chrome.runtime.sendMessage({ type: 'stop-timer' });
  }

  await saveData();
}

// Update play button icon
function updatePlayButtonIcon() {
  const playIcon = elements.playBtn.querySelector('.play-icon');
  const pauseIcon = elements.playBtn.querySelector('.pause-icon');

  if (state.timer.isRunning) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

// Reset timer
function resetTimer() {
  state.timer.isRunning = false;
  state.timer.isBreak = false;
  state.timer.secondsLeft = state.timer.workDuration * 60;

  chrome.runtime.sendMessage({ type: 'stop-timer' });
  updateTimerDisplay();
  updatePlayButtonIcon();
  elements.playBtn.classList.remove('running');
  elements.timerProgress.classList.remove('break-mode');
}

// Skip to next phase
function skipToNext() {
  if (!state.timer.isBreak) {
    // Skip to break
    state.timer.isBreak = true;
    state.timer.secondsLeft = state.timer.breakDuration * 60;
  } else {
    // Skip break, start new session
    state.timer.isBreak = false;
    state.timer.secondsLeft = state.timer.workDuration * 60;
    state.timer.sessionsToday++;
  }
  updateTimerDisplay();
}

// Toggle sound
async function toggleSound() {
  state.settings.soundEnabled = !state.settings.soundEnabled;
  elements.soundBtn.classList.toggle('active', state.settings.soundEnabled);

  const soundOn = elements.soundBtn.querySelector('.sound-on');
  const soundOff = elements.soundBtn.querySelector('.sound-off');

  if (state.settings.soundEnabled) {
    soundOn.style.display = 'block';
    soundOff.style.display = 'none';
  } else {
    soundOn.style.display = 'none';
    soundOff.style.display = 'block';
  }

  await saveData();
}

// Update timer display
function updateTimerDisplay() {
  const mins = Math.floor(state.timer.secondsLeft / 60);
  const secs = state.timer.secondsLeft % 60;

  elements.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  elements.timerLabel.textContent = state.timer.isBreak ? 'Break Time' : 'Focus Time';

  // Update progress ring
  const totalSeconds = (state.timer.isBreak ? state.timer.breakDuration : state.timer.workDuration) * 60;
  const progress = (totalSeconds - state.timer.secondsLeft) / totalSeconds;
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (progress * circumference);

  elements.timerProgress.style.strokeDashoffset = offset;
  elements.timerProgress.classList.toggle('break-mode', state.timer.isBreak);

  elements.sessionsToday.textContent = `${state.timer.sessionsToday}`;
}

// Handle timer complete from background
async function handleTimerComplete(isBreak) {
  if (!isBreak) {
    // Work session completed
    state.timer.sessionsToday++;
    state.timer.isBreak = true;
    state.timer.secondsLeft = state.timer.breakDuration * 60;

    // Record session
    await recordFocusSession();

    // Show notification
    if (state.settings.soundEnabled) {
      playBeep();
    }
  } else {
    // Break completed
    state.timer.isBreak = false;
    state.timer.secondsLeft = state.timer.workDuration * 60;
  }

  updateTimerDisplay();
}

// Record focus session
async function recordFocusSession() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  try {
    // Get existing data
    const data = await chrome.storage.local.get([
      'smartstudyos_focus_sessions',
      'smartstudyos_study_days',
      'smartstudyos_xp_events'
    ]);

    const sessions = data.smartstudyos_focus_sessions || [];
    const studyDays = data.smartstudyos_study_days || [];
    const xpEvents = data.smartstudyos_xp_events || [];

    // Add new session
    sessions.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      startTime: now.toISOString(),
      endTime: now.toISOString(),
      duration: state.timer.workDuration,
      mode: `${state.timer.workDuration}/${state.timer.breakDuration}`,
      completed: true
    });

    // Update study days
    const todayData = studyDays.find(d => d.date === today);
    if (todayData) {
      todayData.hoursStudied += state.timer.workDuration / 60;
      todayData.focusSessions = (todayData.focusSessions || 0) + 1;
    } else {
      studyDays.push({
        date: today,
        hoursStudied: state.timer.workDuration / 60,
        tasksCompleted: 0,
        focusSessions: 1
      });
    }

    // Add XP
    xpEvents.push({
      id: Date.now().toString(36),
      type: 'focus_session',
      xp: 15,
      timestamp: now.toISOString(),
      description: `Completed ${state.timer.workDuration}-min focus session`
    });

    // Save
    await chrome.storage.local.set({
      smartstudyos_focus_sessions: sessions,
      smartstudyos_study_days: studyDays,
      smartstudyos_xp_events: xpEvents
    });

    // Update dashboard
    state.dashboard.hoursStudied += state.timer.workDuration / 60;
    state.dashboard.totalXP += 15;
    updateDashboardUI();

  } catch (error) {
    console.error('Failed to record session:', error);
  }
}

// Play beep sound
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Audio not available
  }
}

// Update UI
function updateUI() {
  updateTimerDisplay();
  updateDashboardUI();
  updateSoundUI();
}

// Update dashboard UI
function updateDashboardUI() {
  elements.hoursStudied.textContent = `${state.dashboard.hoursStudied.toFixed(1)}h`;
  elements.tasksCompleted.textContent = state.dashboard.tasksCompleted;
  elements.currentStreak.textContent = state.dashboard.streak;
  elements.totalXP.textContent = state.dashboard.totalXP;
  elements.streakDisplay.textContent = state.dashboard.streak;

  const progress = Math.min(100, (state.dashboard.hoursStudied / state.dashboard.dailyTarget) * 100);
  elements.dailyProgressBar.style.width = `${progress}%`;
  elements.dailyGoalProgress.textContent = `${Math.round(progress)}%`;
  elements.dailyGoalInfo.textContent = `${state.dashboard.hoursStudied.toFixed(1)}h / ${state.dashboard.dailyTarget}h target`;

  // Update tasks list
  if (state.dashboard.tasks.length > 0) {
    elements.tasksList.innerHTML = state.dashboard.tasks.map(task => `
      <div class="task-item">
        <div class="priority-dot ${task.priority || 'medium'}"></div>
        <span>${task.title}</span>
      </div>
    `).join('');
  }
}

// Update sound UI
function updateSoundUI() {
  elements.soundBtn.classList.toggle('active', state.settings.soundEnabled);
  const soundOn = elements.soundBtn.querySelector('.sound-on');
  const soundOff = elements.soundBtn.querySelector('.sound-off');

  if (state.settings.soundEnabled) {
    soundOn.style.display = 'block';
    soundOff.style.display = 'none';
  } else {
    soundOn.style.display = 'none';
    soundOff.style.display = 'block';
  }
}

// Add quick task
async function addQuickTask() {
  const title = elements.quickTaskInput.value.trim();
  if (!title) return;

  const priority = elements.quickTaskPriority.value;
  const today = new Date().toISOString().split('T')[0];

  try {
    const data = await chrome.storage.local.get(['smartstudyos_tasks']);
    const tasks = data.smartstudyos_tasks || [];

    const newTask = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      title,
      priority,
      status: 'pending',
      dueDate: today,
      createdAt: new Date().toISOString()
    };

    tasks.push(newTask);

    await chrome.storage.local.set({ smartstudyos_tasks: tasks });

    elements.quickTaskInput.value = '';
    elements.addTaskBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
      elements.addTaskBtn.style.transform = '';
    }, 100);

    // Reload data to update UI
    await loadData();
    updateDashboardUI();

  } catch (error) {
    console.error('Failed to add task:', error);
  }
}

// Ask AI
async function askAi() {
  const question = elements.aiQuestionInput.value.trim();
  if (!question) return;

  elements.aiResponse.style.display = 'block';
  elements.aiResponse.textContent = 'Thinking...';
  elements.askAiBtn.disabled = true;

  try {
    const data = await chrome.storage.local.get(['smartstudyos_gemini_key']);
    const apiKey = data.smartstudyos_gemini_key;

    if (!apiKey) {
      elements.aiResponse.textContent = 'Please add your Gemini API key in Settings to use AI features.';
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful AI study coach. Be concise and practical. Keep responses under 2 sentences.\n\nStudent question: ${question}`
            }]
          }],
          generationConfig: { maxOutputTokens: 100, temperature: 0.7 }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      elements.aiResponse.textContent = text;
    } else {
      elements.aiResponse.textContent = 'Could not generate a response. Please try again.';
    }

  } catch (error) {
    elements.aiResponse.textContent = 'Failed to get AI response. Please check your API key in Settings.';
  } finally {
    elements.askAiBtn.disabled = false;
    elements.aiQuestionInput.value = '';
  }
}

// Open full app
function openFullApp() {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
}

// Open app section
function openAppSection(section) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html#${section}`) });
}

// Initialize on load
init();
