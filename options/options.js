// State
const state = {
  user: null,
  settings: {
    soundEnabled: true,
    browserNotifications: true,
    defaultTimer: '25',
    customWork: 45,
    customBreak: 10
  },
  geminiKey: '',
  data: {
    focusSessions: [],
    tasks: [],
    studyDays: [],
    xpEvents: []
  }
};

// DOM Elements
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Initialize
async function init() {
  await loadData();
  setupNavigation();
  setupSettingsListeners();
  setupDataListeners();
  setupHelpListeners();
  updateUI();

  // Handle hash navigation
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);
}

// Load data
async function loadData() {
  try {
    const data = await chrome.storage.local.get([
      'smartstudyos_user',
      'smartstudyos_settings',
      'smartstudyos_gemini_key',
      'smartstudyos_focus_sessions',
      'smartstudyos_tasks',
      'smartstudyos_study_days',
      'smartstudyos_xp_events'
    ]);

    if (data.smartstudyos_user) state.user = data.smartstudyos_user;
    if (data.smartstudyos_settings) Object.assign(state.settings, data.smartstudyos_settings);
    if (data.smartstudyos_gemini_key) state.geminiKey = data.smartstudyos_gemini_key;

    state.data.focusSessions = data.smartstudyos_focus_sessions || [];
    state.data.tasks = data.smartstudyos_tasks || [];
    state.data.studyDays = data.smartstudyos_study_days || [];
    state.data.xpEvents = data.smartstudyos_xp_events || [];

  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// Save data
async function saveData(keys) {
  try {
    const toSave = {};
    if (keys.includes('user')) toSave.smartstudyos_user = state.user;
    if (keys.includes('settings')) toSave.smartstudyos_settings = state.settings;
    if (keys.includes('geminiKey')) toSave.smartstudyos_gemini_key = state.geminiKey;
    await chrome.storage.local.set(toSave);
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}

// Handle hash navigation
function handleHashNavigation() {
  const hash = window.location.hash.slice(1);
  if (hash && ['dashboard', 'settings', 'data', 'help', 'about'].includes(hash)) {
    switchSection(hash);
  }
}

// Setup navigation
function setupNavigation() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section;
      switchSection(section);
      window.location.hash = section;
    });
  });
}

// Switch section
function switchSection(sectionName) {
  $$('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionName);
  });

  $$('.section').forEach(section => {
    section.classList.toggle('active', section.id === `${sectionName}-section`);
  });
}

// Setup settings listeners
function setupSettingsListeners() {
  // Profile
  $('save-profile').addEventListener('click', async () => {
    const name = $('user-name').value.trim();
    const level = $('academic-level').value;
    const target = parseFloat($('daily-target').value);

    if (!name) {
      showToast('Please enter your name', 'error');
      return;
    }

    state.user = {
      name,
      academicLevel: level,
      dailyStudyTarget: target,
      createdAt: state.user?.createdAt || new Date().toISOString()
    };

    await saveData(['user']);
    showToast('Profile saved!', 'success');
  });

  // Daily target slider
  $('daily-target').addEventListener('input', e => {
    $('target-value').textContent = e.target.value;
  });

  // Sound toggle
  $('sound-enabled').addEventListener('change', async e => {
    state.settings.soundEnabled = e.target.checked;
    await saveData(['settings']);
  });

  // Browser notifications
  $('browser-notifications').addEventListener('change', async e => {
    if (e.target.checked) {
      const permission = await chrome.permissions.request({ permissions: ['notifications'] });
      if (!permission.granted) {
        e.target.checked = false;
        showToast('Notification permission denied', 'error');
        return;
      }
    }
    state.settings.browserNotifications = e.target.checked;
    await saveData(['settings']);
  });

  // Default timer
  $('default-timer').addEventListener('change', async e => {
    state.settings.defaultTimer = e.target.value;
    await saveData(['settings']);
  });

  // Custom work/break
  $('custom-work').addEventListener('change', async e => {
    state.settings.customWork = parseInt(e.target.value) || 45;
    await saveData(['settings']);
  });

  $('custom-break').addEventListener('change', async e => {
    state.settings.customBreak = parseInt(e.target.value) || 10;
    await saveData(['settings']);
  });

  // Gemini API key
  $('save-gemini-key').addEventListener('click', async () => {
    const key = $('gemini-key').value.trim();
    state.geminiKey = key;
    await saveData(['geminiKey']);

    if (key) {
      $('api-status').innerHTML = '<span class="status-icon">🟢</span><span>API key configured</span>';
      $('api-status').classList.add('connected');
      showToast('API key saved!', 'success');
    } else {
      $('api-status').innerHTML = '<span class="status-icon">⚪</span><span>API key not configured</span>';
      $('api-status').classList.remove('connected');
      showToast('API key removed', 'success');
    }
  });
}

// Setup data listeners
function setupDataListeners() {
  // Export
  $('export-data').addEventListener('click', async () => {
    const allData = await chrome.storage.local.get(null);
    const smartStudyData = {};

    Object.keys(allData)
      .filter(k => k.startsWith('smartstudyos_'))
      .forEach(k => {
        smartStudyData[k] = allData[k];
      });

    const blob = new Blob([JSON.stringify(smartStudyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartstudyos_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Data exported!', 'success');
  });

  // Import
  $('import-data').addEventListener('click', () => {
    $('import-file').click();
  });

  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate it's our data
      const validKeys = Object.keys(data).filter(k => k.startsWith('smartstudyos_'));
      if (validKeys.length === 0) {
        showToast('Invalid backup file', 'error');
        return;
      }

      await chrome.storage.local.set(data);
      showToast('Data imported! Refreshing...', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      showToast('Failed to import data', 'error');
    }
  });

  // Reset
  $('reset-data').addEventListener('click', () => {
    showModal(
      'Reset All Data',
      'This will permanently delete all your study data, tasks, sessions, and progress. This action cannot be undone.',
      async () => {
        const keys = (await chrome.storage.local.get(null));
        const toRemove = Object.keys(keys).filter(k => k.startsWith('smartstudyos_'));

        if (toRemove.length > 0) {
          await chrome.storage.local.remove(toRemove);
        }

        showToast('All data reset!', 'success');
        setTimeout(() => location.reload(), 500);
      }
    );
  });
}

// Setup help listeners
function setupHelpListeners() {
  $$('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      item.classList.toggle('open');
    });
  });

  $('feedback-btn').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: 'mailto:feedback@smartstudyos.app?subject=Smart%20StudyOS%20Feedback' });
  });
}

// Update UI
function updateUI() {
  // Profile
  if (state.user) {
    $('user-name').value = state.user.name || '';
    $('academic-level').value = state.user.academicLevel || '';
    $('daily-target').value = state.user.dailyStudyTarget || 4;
    $('target-value').textContent = state.user.dailyStudyTarget || 4;
  }

  // Settings
  $('sound-enabled').checked = state.settings.soundEnabled;
  $('browser-notifications').checked = state.settings.browserNotifications;
  $('default-timer').value = state.settings.defaultTimer;
  $('custom-work').value = state.settings.customWork;
  $('custom-break').value = state.settings.customBreak;

  // API key
  $('gemini-key').value = state.geminiKey;
  if (state.geminiKey) {
    $('api-status').innerHTML = '<span class="status-icon">🟢</span><span>API key configured</span>';
    $('api-status').classList.add('connected');
  }

  // Dashboard stats
  updateDashboardStats();

  // Data overview
  updateDataOverview();
}

// Update dashboard stats
function updateDashboardStats() {
  // Streak
  const streak = calculateStreak();
  $('dash-streak').textContent = streak;

  // This week hours
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const weekHours = state.data.studyDays
    .filter(d => d.date >= weekAgoStr)
    .reduce((sum, d) => sum + (d.hoursStudied || 0), 0);

  $('dash-hours').textContent = `${weekHours.toFixed(1)}h`;

  // Tasks completed
  const completedTasks = state.data.tasks.filter(t => t.status === 'completed').length;
  $('dash-tasks').textContent = completedTasks;

  // Total XP
  const totalXP = state.data.xpEvents.reduce((sum, e) => sum + (e.xp || 0), 0);
  $('dash-xp').textContent = totalXP;

  // Recent activity
  updateRecentActivity();

  // Upcoming tasks
  updateUpcomingTasks();
}

// Calculate streak
function calculateStreak() {
  if (state.data.studyDays.length === 0) return 0;

  const sorted = [...state.data.studyDays].sort((a, b) => b.date.localeCompare(a.date));
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

// Update recent activity
function updateRecentActivity() {
  const activities = [];

  // Add recent focus sessions
  state.data.focusSessions.slice(-5).forEach(session => {
    activities.push({
      type: 'focus',
      icon: '⏱',
      title: `Completed ${session.duration}-min focus session`,
      time: new Date(session.endTime || session.startTime)
    });
  });

  // Add recent tasks
  state.data.tasks.filter(t => t.status === 'completed').slice(-5).forEach(task => {
    activities.push({
      type: 'task',
      icon: '✓',
      title: `Completed: ${task.title}`,
      time: new Date(task.updatedAt || task.createdAt)
    });
  });

  // Add recent XP
  state.data.xpEvents.slice(-5).forEach(xp => {
    activities.push({
      type: 'xp',
      icon: '⚡',
      title: `+${xp.xp} XP: ${xp.description}`,
      time: new Date(xp.timestamp)
    });
  });

  // Sort by time
  activities.sort((a, b) => b.time - a.time);

  const list = $('activity-list');
  if (activities.length === 0) {
    list.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }

  list.innerHTML = activities.slice(0, 10).map(activity => `
    <div class="activity-item">
      <div class="activity-icon">${activity.icon}</div>
      <div class="activity-content">
        <div class="activity-title">${activity.title}</div>
        <div class="activity-time">${formatTimeAgo(activity.time)}</div>
      </div>
    </div>
  `).join('');
}

// Update upcoming tasks
function updateUpcomingTasks() {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = state.data.tasks
    .filter(t => t.status !== 'completed' && t.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  const grid = $('upcoming-tasks');
  if (upcoming.length === 0) {
    grid.innerHTML = '<div class="empty-state">No upcoming tasks</div>';
    return;
  }

  grid.innerHTML = upcoming.map(task => {
    const daysLeft = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    return `
      <div class="activity-item">
        <div class="activity-icon">${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}</div>
        <div class="activity-content">
          <div class="activity-title">${task.title}</div>
          <div class="activity-time">${daysLeft <= 0 ? 'Overdue' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days left`}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Update data overview
function updateDataOverview() {
  const maxItems = 100;

  const sessionsCount = state.data.focusSessions.length;
  const tasksCount = state.data.tasks.length;
  const daysCount = state.data.studyDays.length;

  $('sessions-count').textContent = sessionsCount;
  $('tasks-count').textContent = tasksCount;
  $('days-count').textContent = daysCount;

  $('sessions-bar').style.width = `${Math.min(100, (sessionsCount / maxItems) * 100)}%`;
  $('tasks-bar').style.width = `${Math.min(100, (tasksCount / maxItems) * 100)}%`;
  $('days-bar').style.width = `${Math.min(100, (daysCount / maxItems) * 100)}%`;
}

// Format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// Show toast
function showToast(message, type = 'info') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Show modal
function showModal(title, message, onConfirm) {
  const overlay = $('modal-overlay');
  $('modal-title').textContent = title;
  $('modal-message').textContent = message;

  overlay.classList.add('show');

  const cancelBtn = $('modal-cancel');
  const confirmBtn = $('modal-confirm');

  const close = () => {
    overlay.classList.remove('show');
    cancelBtn.onclick = null;
    confirmBtn.onclick = null;
  };

  cancelBtn.onclick = close;
  confirmBtn.onclick = () => {
    close();
    onConfirm();
  };
}

// Initialize
init();
