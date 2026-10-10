// Smart StudyOS - Background Service Worker
// Handles timer, alarms, and notifications

const STORAGE_PREFIX = 'smartstudyos_';

// Timer state
let timerState = {
  isRunning: false,
  secondsLeft: 0,
  isBreak: false,
  workDuration: 25,
  breakDuration: 5
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart StudyOS extension installed');
  initializeState();
});

// On startup
chrome.runtime.onStartup.addListener(() => {
  initializeState();
});

// Initialize state from storage
async function initializeState() {
  try {
    const data = await chrome.storage.local.get([
      `${STORAGE_PREFIX}timer`,
      `${STORAGE_PREFIX}settings`
    ]);

    if (data[`${STORAGE_PREFIX}settings`]) {
      const settings = data[`${STORAGE_PREFIX}settings`];
      timerState.workDuration = settings.customWork || 25;
      timerState.breakDuration = settings.customBreak || 5;
    }

    // Resume timer if it was running
    if (data[`${STORAGE_PREFIX}timer`]?.isRunning) {
      const savedTimer = data[`${STORAGE_PREFIX}timer`];
      timerState = { ...timerState, ...savedTimer };

      // Calculate elapsed time
      if (savedTimer.lastTick) {
        const elapsed = Math.floor((Date.now() - savedTimer.lastTick) / 1000);
        timerState.secondsLeft = Math.max(0, savedTimer.secondsLeft - elapsed);

        if (timerState.secondsLeft > 0) {
          startTimerInterval();
        } else {
          // Timer completed while extension was closed
          handleTimerComplete();
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize state:', error);
  }
}

// Listen for messages from popup/options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'start-timer':
      startTimer(message.secondsLeft);
      sendResponse({ success: true });
      break;

    case 'stop-timer':
      stopTimer();
      sendResponse({ success: true });
      break;

    case 'get-timer-state':
      sendResponse(timerState);
      break;

    case 'timer-tick':
      // Forward to popup if open
      chrome.runtime.sendMessage(message).catch(() => {});
      break;

    case 'timer-complete':
      // Forward to popup if open
      chrome.runtime.sendMessage(message).catch(() => {});
      break;
  }

  return true;
});

// Start timer
function startTimer(secondsLeft) {
  timerState.isRunning = true;
  timerState.secondsLeft = secondsLeft || timerState.workDuration * 60;
  timerState.lastTick = Date.now();

  startTimerInterval();
  saveTimerState();
}

// Start timer interval
function startTimerInterval() {
  // Clear existing alarm
  chrome.alarms.clear('smartstudyos-timer');

  // Create second-by-second alarm
  chrome.alarms.create('smartstudyos-timer', {
    periodInMinutes: 1 / 60 // Every second
  });
}

// Stop timer
function stopTimer() {
  timerState.isRunning = false;
  timerState.lastTick = null;

  chrome.alarms.clear('smartstudyos-timer');
  saveTimerState();
}

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'smartstudyos-timer') return;
  if (!timerState.isRunning) return;

  timerState.secondsLeft--;
  timerState.lastTick = Date.now();

  // Send tick to popup
  try {
    await chrome.runtime.sendMessage({
      type: 'timer-tick',
      secondsLeft: timerState.secondsLeft
    });
  } catch (e) {
    // Popup may be closed, that's OK
  }

  if (timerState.secondsLeft <= 0) {
    await handleTimerComplete();
  }
});

// Handle timer complete
async function handleTimerComplete() {
  timerState.isRunning = false;
  chrome.alarms.clear('smartstudyos-timer');

  if (!timerState.isBreak) {
    // Work session completed
    await recordFocusSession();

    // Show notification
    await showNotification(
      'Focus Session Complete!',
      `Great work! Time for a ${timerState.breakDuration}-minute break.`,
      'icons/icon128.png'
    );

    // Switch to break
    timerState.isBreak = true;
    timerState.secondsLeft = timerState.breakDuration * 60;
    timerState.isRunning = true;
    startTimerInterval();

  } else {
    // Break completed
    await showNotification(
      'Break Over!',
      'Ready for another focus session?',
      'icons/icon128.png'
    );

    timerState.isBreak = false;
    timerState.secondsLeft = timerState.workDuration * 60;
    timerState.isRunning = false;
  }

  saveTimerState();

  // Notify popup
  try {
    await chrome.runtime.sendMessage({
      type: 'timer-complete',
      isBreak: timerState.isBreak
    });
  } catch (e) {
    // Popup may be closed
  }
}

// Record focus session
async function recordFocusSession() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const data = await chrome.storage.local.get([
      `${STORAGE_PREFIX}focus_sessions`,
      `${STORAGE_PREFIX}study_days`,
      `${STORAGE_PREFIX}xp_events`,
      `${STORAGE_PREFIX}user`
    ]);

    const sessions = data[`${STORAGE_PREFIX}focus_sessions`] || [];
    const studyDays = data[`${STORAGE_PREFIX}study_days`] || [];
    const xpEvents = data[`${STORAGE_PREFIX}xp_events`] || [];

    // Add session
    sessions.push({
      id: now.getTime().toString(36) + Math.random().toString(36).slice(2, 9),
      startTime: new Date(now.getTime() - timerState.workDuration * 60000).toISOString(),
      endTime: now.toISOString(),
      duration: timerState.workDuration,
      mode: `${timerState.workDuration}/${timerState.breakDuration}`,
      completed: true
    });

    // Update study day
    const todayData = studyDays.find(d => d.date === today);
    if (todayData) {
      todayData.hoursStudied = (todayData.hoursStudied || 0) + timerState.workDuration / 60;
      todayData.focusSessions = (todayData.focusSessions || 0) + 1;
    } else {
      studyDays.push({
        date: today,
        hoursStudied: timerState.workDuration / 60,
        tasksCompleted: 0,
        focusSessions: 1
      });
    }

    // Add XP
    xpEvents.push({
      id: now.getTime().toString(36),
      type: 'focus_session',
      xp: 15,
      timestamp: now.toISOString(),
      description: `Completed ${timerState.workDuration}-min focus session`
    });

    // Save
    await chrome.storage.local.set({
      [`${STORAGE_PREFIX}focus_sessions`]: sessions,
      [`${STORAGE_PREFIX}study_days`]: studyDays,
      [`${STORAGE_PREFIX}xp_events`]: xpEvents
    });

    // Check for badge achievements
    await checkBadges(sessions, studyDays, xpEvents);

  } catch (error) {
    console.error('Failed to record session:', error);
  }
}

// Check for badge achievements
async function checkBadges(sessions, studyDays, xpEvents) {
  try {
    const data = await chrome.storage.local.get([`${STORAGE_PREFIX}badges`]);
    const badges = data[`${STORAGE_PREFIX}badges`] || [];
    const earnedIds = new Set(badges.filter(b => b.earnedAt).map(b => id));

    const newBadges = [];

    // Check streak badges
    const streak = calculateStreak(studyDays);
    if (streak >= 7 && !earnedIds.has('streak_7')) {
      newBadges.push({ id: 'streak_7', earnedAt: new Date().toISOString() });
    }
    if (streak >= 30 && !earnedIds.has('streak_30')) {
      newBadges.push({ id: 'streak_30', earnedAt: new Date().toISOString() });
    }

    // Check focus session badges
    const longSession = sessions.find(s => s.duration >= 50 && s.completed);
    if (longSession && !earnedIds.has('marathon_focus')) {
      newBadges.push({ id: 'marathon_focus', earnedAt: new Date().toISOString() });
    }

    // Early bird (before 8am)
    const earlySession = sessions.find(s => {
      const hour = new Date(s.startTime).getHours();
      return hour < 8 && s.completed;
    });
    if (earlySession && !earnedIds.has('early_bird')) {
      newBadges.push({ id: 'early_bird', earnedAt: new Date().toISOString() });
    }

    // Night owl (after 10pm)
    const lateSession = sessions.find(s => {
      const hour = new Date(s.endTime || s.startTime).getHours();
      return hour >= 22 && s.completed;
    });
    if (lateSession && !earnedIds.has('night_owl')) {
      newBadges.push({ id: 'night_owl', earnedAt: new Date().toISOString() });
    }

    // Save new badges
    if (newBadges.length > 0) {
      await chrome.storage.local.set({
        [`${STORAGE_PREFIX}badges`]: [...badges, ...newBadges]
      });

      // Show notification for each new badge
      for (const badge of newBadges) {
        await showNotification(
          'New Badge Earned!',
          getBadgeName(badge.id),
          'icons/icon128.png'
        );
      }
    }

  } catch (error) {
    console.error('Failed to check badges:', error);
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

// Get badge name
function getBadgeName(id) {
  const names = {
    'streak_7': '7 Day Streak',
    'streak_30': '30 Day Streak',
    'marathon_focus': 'Marathon Focus',
    'early_bird': 'Early Bird',
    'night_owl': 'Night Owl'
  };
  return names[id] || id;
}

// Show notification
async function showNotification(title, message, iconUrl) {
  try {
    const data = await chrome.storage.local.get([`${STORAGE_PREFIX}settings`]);
    const settings = data[`${STORAGE_PREFIX}settings`] || {};

    if (!settings.browserNotifications) return;

    await chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: title,
      message: message,
      priority: 2
    });

    // Play sound if enabled
    if (settings.soundEnabled) {
      // Service workers can't play audio directly
      // Sound will be handled by the popup if open
    }

  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// Save timer state
async function saveTimerState() {
  try {
    await chrome.storage.local.set({
      [`${STORAGE_PREFIX}timer`]: {
        ...timerState,
        lastTick: Date.now()
      }
    });
  } catch (error) {
    console.error('Failed to save timer state:', error);
  }
}

// Handle notification click
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  // Open popup
  chrome.action.openPopup().catch(() => {
    // If popup fails, open options page
    chrome.runtime.openOptionsPage();
  });
});

// Keep service worker alive
chrome.alarms.create('keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // Do nothing, just keep alive
  }
});

console.log('Smart StudyOS service worker ready');
