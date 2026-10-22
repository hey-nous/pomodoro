# Pomodoro by Hey Nous

A calm, browser-based Pomodoro focus timer with the Nous mascot, task tracking,
session stats, and on-device generated ambient sound. No account, no tracking —
all data stays in `localStorage` (`nousvault-pomodoro-state-v1`).

## Features

- Focus / Short Break / Long Break cycles with customizable durations,
  auto-start options, and long-break intervals
- Task list with inline editing and per-task pomodoro estimates
- Session stats: completed count, total focus time, day streak with a weekly
  streak freeze, and a daily goal ring
- Activity summary with hours/days/streak metrics and a focus-hours bar chart
  (week / month / year)
- Browser notifications on phase completion, live tab-title countdown, and
  `Space` to start/stop
- Alarm sounds with volume control; ambient sound (rain, white noise, brown
  noise) generated on-device via Web Audio — works offline
- Light / dark theme in the Hey Nous design system (follows the OS on first visit)
- PWA: installable, offline-first via a cache-first service worker

## Local Development

Serve the directory statically (no build step):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deployment

Deployed to Cloudflare Pages: https://pomo.nous.my.id
