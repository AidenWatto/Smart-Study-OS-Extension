# Smart StudyOS Browser Extension

A powerful browser extension for Smart StudyOS - your AI-powered study productivity suite.

## Features

### Timer Tab
- **Pomodoro Timer**: Choose from 25/5, 50/10, or custom durations
- **Break Reminders**: Automatic switch between work and break modes
- **Sound Notifications**: Audio alerts when sessions complete (optional)
- **Progress Tracking**: Visual progress ring showing time elapsed

### Dashboard Tab
- **Daily Stats**: Hours studied, tasks completed, current streak
- **XP Progress**: Track your experience points and level
- **Upcoming Tasks**: Quick view of pending tasks
- **Daily Goal**: Visual progress toward your daily study target

### Quick Actions Tab
- **Add Tasks**: Quickly add tasks with priority levels
- **AI Coach**: Ask study-related questions powered by Gemini AI
- **Quick Links**: Navigate to Analytics, Planner, Notes, or Settings

## Installation

### From Source (Developer Mode)

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extension` folder from this project

### Manual Build

The extension is ready to use as-is. No build step required for the extension files.

## Configuration

### API Key Setup

To enable AI features:
1. Click the extension icon
2. Go to Settings (gear icon)
3. Scroll to "AI Integration" section
4. Enter your Gemini API key (get one free at [Google AI Studio](https://aistudio.google.com/apikey))
5. Click Save

### Profile Setup

In the Settings page:
1. Enter your name
2. Select your academic level
3. Set your daily study target (1-12 hours)
4. Configure timer preferences
5. Enable/disable notifications

## Data Management

All data is stored locally in your browser using Chrome Storage API.

### Export Data
Go to Settings > Data Management > Export Data to create a JSON backup.

### Import Data
Use Import Data to restore from a backup file.

### Reset Data
Permanently delete all data from Settings > Data Management > Reset All Data.

## Permissions

The extension requires these permissions:
- **storage**: Save your study data locally
- **alarms**: Timer functionality runs in background
- **notifications**: Desktop notifications for timer completion

## Support

- **Help & Support**: Built-in FAQ in the extension
- **Email**: support@smartstudyos.app
- **Website**: https://smartstudyos.app

## Version

Current version: 1.0.0
Manifest version: 3 (compatible with Chrome, Edge, and other Chromium browsers)

## License

Copyright 2024 Smart StudyOS. All rights reserved.

---

**Developed with dedication for students everywhere.**
