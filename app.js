/* Pomodoro by Hey Nous — client-only focus timer.
 * State persists in localStorage under STORAGE_KEY (unchanged since v1). */

const STORAGE_KEY = "nousvault-pomodoro-state-v1";
const IDLE_AFTER_MS = 90_000;
const ALARM_PLAY_COUNT = 3;
const ALARM_PAUSE_MS = 1_000;
const PAGE_TITLE = "Pomodoro by Hey Nous | focus timer";
const RING_CIRCUMFERENCE = 113.1;

const AUDIO_OPTIONS = [
  { label: "None", value: "None" },
  { label: "Playful 1", value: "assets/audio/cat-1.wav" },
  { label: "Playful 2", value: "assets/audio/cat-2.ogg" },
  { label: "Digital", value: "assets/audio/digital.flac" },
  { label: "Door Chime", value: "assets/audio/door-chime.wav" },
];

const AMBIENCE_SOUNDS = ["off", "rain", "white", "brown"];
const AMBIENCE_LABELS = {
  off: "Off",
  rain: "Rain",
  white: "White noise",
  brown: "Brown noise",
};

const MODES = {
  focus: { label: "Focus", defaultMinutes: 25 },
  short: { label: "Short Break", defaultMinutes: 5 },
  long: { label: "Long Break", defaultMinutes: 15 },
};

const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  longBreakInterval: 4,
  dailyGoal: 8,
  autoCheckTasks: false,
  checkToBottom: true,
  alarmSound: "assets/audio/door-chime.wav",
  alarmVolume: 50,
  ambienceSound: "off",
  ambienceVolume: 50,
  theme: "light",
  hourFormat: "24",
};

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeDefaultTasks() {
  return [
    { id: createId(), text: "Sketch the main landing page hero layout", done: true, est: 2 },
    { id: createId(), text: "Refine Pomodoro interaction styles", done: false, est: 1 },
  ];
}

const COMPANION_LINES = {
  cover: "Pick a task, press start.",
  focus: "Focus time \u2014 one thing at a time.",
  almost: "Almost there \u2014 finish strong.",
  timesup: "Time's up. Well done.",
  done: "Session logged. Take a breath.",
  break: "Rest \u2014 stretch and breathe.",
  ignored: "Still here when you're ready.",
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  timerDisplay: document.querySelector("#timerDisplay"),
  startStop: document.querySelector("#startStop"),
  journeyWalker: document.querySelector("#journeyWalker"),
  journeyFill: document.querySelector("#journeyFill"),
  companionArt: document.querySelector("#companionArt"),
  companionLine: document.querySelector("#companionLine"),
  timerView: document.querySelector("#timerView"),
  activitySummary: document.querySelector("#activitySummary"),
  openActivitySummary: document.querySelector("#openActivitySummary"),
  backToTimer: document.querySelector("#backToTimer"),
  ambienceOpen: document.querySelector("#ambienceOpen"),
  summaryReset: document.querySelector("#summaryReset"),
  summaryHours: document.querySelector("#summaryHours"),
  summaryDays: document.querySelector("#summaryDays"),
  summaryStreak: document.querySelector("#summaryStreak"),
  summaryBars: document.querySelector("#summaryBars"),
  summaryPeriod: document.querySelector("#summaryPeriod"),
  summaryPrev: document.querySelector("#summaryPrev"),
  summaryNext: document.querySelector("#summaryNext"),
  summaryConfirmOverlay: document.querySelector("#summaryConfirmOverlay"),
  summaryConfirmCancel: document.querySelector("#summaryConfirmCancel"),
  summaryConfirmOk: document.querySelector("#summaryConfirmOk"),
  ambienceOverlay: document.querySelector("#ambienceOverlay"),
  ambienceClose: document.querySelector("#ambienceClose"),
  ambButtons: [...document.querySelectorAll(".amb-btn")],
  panelAmbienceVolume: document.querySelector("#panelAmbienceVolume"),
  panelAmbienceVolumeValue: document.querySelector("#panelAmbienceVolumeValue"),
  rangeTabs: [...document.querySelectorAll(".range-tab")],
  taskList: document.querySelector("#taskList"),
  addTask: document.querySelector("#addTask"),
  completedCount: document.querySelector("#completedCount"),
  totalFocus: document.querySelector("#totalFocus"),
  streakCount: document.querySelector("#streakCount"),
  freezeCount: document.querySelector("#freezeCount"),
  goalRingFg: document.querySelector("#goalRingFg"),
  goalText: document.querySelector("#goalText"),
  navHome: document.querySelector("#navHome"),
  navSummary: document.querySelector("#navSummary"),
  settingsOpen: document.querySelector("#settingsOpen"),
  settingsClose: document.querySelector("#settingsClose"),
  settingsOverlay: document.querySelector("#settingsOverlay"),
  settingsForm: document.querySelector("#settingsForm"),
  settingFocusMinutes: document.querySelector("#settingFocusMinutes"),
  settingShortMinutes: document.querySelector("#settingShortMinutes"),
  settingLongMinutes: document.querySelector("#settingLongMinutes"),
  settingAutoStartBreaks: document.querySelector("#settingAutoStartBreaks"),
  settingAutoStartPomodoros: document.querySelector("#settingAutoStartPomodoros"),
  settingLongBreakInterval: document.querySelector("#settingLongBreakInterval"),
  settingDailyGoal: document.querySelector("#settingDailyGoal"),
  settingAutoCheckTasks: document.querySelector("#settingAutoCheckTasks"),
  settingCheckToBottom: document.querySelector("#settingCheckToBottom"),
  settingAlarmSound: document.querySelector("#settingAlarmSound"),
  testAlarmSound: document.querySelector("#testAlarmSound"),
  settingAlarmVolume: document.querySelector("#settingAlarmVolume"),
  alarmVolumeValue: document.querySelector("#alarmVolumeValue"),
  settingAmbienceSound: document.querySelector("#settingAmbienceSound"),
  settingAmbienceVolume: document.querySelector("#settingAmbienceVolume"),
  ambienceVolumeValue: document.querySelector("#ambienceVolumeValue"),
  settingHourFormat: document.querySelector("#settingHourFormat"),
  themeSegButtons: [...document.querySelectorAll(".theme-seg button")],
  themeToggle: document.querySelector("#themeToggle"),
};

let state = loadState();
let tickTimer = null;
let idleTimer = null;
let finishTimer = null;
let summaryRange = "week";
let summaryOffset = 0;
let activeNav = "home";
let ambiencePlaying = false;

function systemTheme() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch (error) {
    /* ignore */
  }
  return "light";
}

function loadState() {
  const fallback = {
    mode: "focus",
    remaining: DEFAULT_SETTINGS.focusMinutes * 60,
    running: false,
    startedAt: null,
    endsAt: null,
    completedFocus: 0,
    totalFocusSeconds: 0,
    tasks: makeDefaultTasks(),
    characterState: "cover",
    focusStreak: 0,
    streakFreezes: 1,
    freezeWeekKey: isoWeekKey(new Date()),
    sessions: [],
    settings: { ...DEFAULT_SETTINGS, theme: systemTheme() },
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !MODES[saved.mode]) return fallback;
    const settings = normalizeSettings(saved.settings);

    const merged = {
      ...fallback,
      ...saved,
      running: false,
      startedAt: null,
      endsAt: null,
      settings,
      remaining: Number.isFinite(saved.remaining) ? saved.remaining : modeSeconds(saved.mode, settings),
      tasks: normalizeTasks(saved.tasks),
      sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
      characterState: saved.characterState === "ignored" ? "cover" : saved.characterState || "cover",
      streakFreezes: Number.isInteger(saved.streakFreezes) ? Math.max(0, saved.streakFreezes) : 1,
      freezeWeekKey: typeof saved.freezeWeekKey === "string" ? saved.freezeWeekKey : isoWeekKey(new Date()),
    };
    // Replenish the weekly freeze if the week rolled over while away.
    const currentWeek = isoWeekKey(new Date());
    if (merged.freezeWeekKey !== currentWeek) {
      merged.freezeWeekKey = currentWeek;
      merged.streakFreezes = 1;
    }
    return merged;
  } catch {
    return fallback;
  }
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return makeDefaultTasks();
  return tasks.map((task) => ({
    id: typeof task.id === "string" ? task.id : createId(),
    text: typeof task.text === "string" ? task.text : "",
    done: Boolean(task.done),
    est: clampNumber(task.est, 1, 20, 1),
  }));
}

function normalizeSettings(settings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const validAudioValues = AUDIO_OPTIONS.map((option) => option.value);
  return {
    focusMinutes: clampNumber(merged.focusMinutes, 1, 180, DEFAULT_SETTINGS.focusMinutes),
    shortMinutes: clampNumber(merged.shortMinutes, 1, 60, DEFAULT_SETTINGS.shortMinutes),
    longMinutes: clampNumber(merged.longMinutes, 1, 90, DEFAULT_SETTINGS.longMinutes),
    autoStartBreaks: Boolean(merged.autoStartBreaks),
    autoStartPomodoros: Boolean(merged.autoStartPomodoros),
    longBreakInterval: clampNumber(merged.longBreakInterval, 2, 12, DEFAULT_SETTINGS.longBreakInterval),
    dailyGoal: clampNumber(merged.dailyGoal, 1, 20, DEFAULT_SETTINGS.dailyGoal),
    autoCheckTasks: Boolean(merged.autoCheckTasks),
    checkToBottom: Boolean(merged.checkToBottom),
    alarmSound: validAudioValues.includes(merged.alarmSound) ? merged.alarmSound : DEFAULT_SETTINGS.alarmSound,
    alarmVolume: clampNumber(merged.alarmVolume, 0, 100, DEFAULT_SETTINGS.alarmVolume),
    ambienceSound: AMBIENCE_SOUNDS.includes(merged.ambienceSound) ? merged.ambienceSound : "off",
    ambienceVolume: clampNumber(merged.ambienceVolume, 0, 100, DEFAULT_SETTINGS.ambienceVolume),
    theme: merged.theme === "dark" ? "dark" : "light",
    hourFormat: merged.hourFormat === "12" ? "12" : "24",
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function modeMinutes(mode, settings = state?.settings || DEFAULT_SETTINGS) {
  if (mode === "short") return settings.shortMinutes;
  if (mode === "long") return settings.longMinutes;
  return settings.focusMinutes;
}

function modeSeconds(mode, settings = state?.settings || DEFAULT_SETTINGS) {
  return modeMinutes(mode, settings) * 60;
}

function saveState() {
  const persisted = {
    ...state,
    running: false,
    startedAt: null,
    endsAt: null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getProgress() {
  const duration = modeSeconds(state.mode);
  return Math.min(1, Math.max(0, 1 - state.remaining / duration));
}

function setCharacter(nextState) {
  state.characterState = nextState;
  els.companionArt.className = `pose-frame state-${nextState}`;
  els.companionLine.textContent = COMPANION_LINES[nextState] || COMPANION_LINES.cover;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme === "dark" ? "dark" : "light";
}

/* ---------- streak freeze ---------- */

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((d - start) / 86400000 / 7 + 1 / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function replenishFreezeCheck() {
  const key = isoWeekKey(new Date());
  if (state.freezeWeekKey !== key) {
    state.freezeWeekKey = key;
    state.streakFreezes = 1;
    saveState();
  }
}

function getDayStreak(uniqueDays) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let freezeAvailable = state.streakFreezes > 0;

  for (;;) {
    const key = toDateKey(cursor);
    if (uniqueDays.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    // Bridge exactly one single missed day with a freeze, then keep counting.
    if (freezeAvailable) {
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      if (uniqueDays.has(toDateKey(prev))) {
        state.streakFreezes -= 1;
        freezeAvailable = false;
        saveState();
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
    }
    break;
  }

  return streak;
}

function countTodaySessions() {
  const today = toDateKey(new Date());
  return getFocusSessions().filter((session) => toDateKey(new Date(session.completedAt)) === today).length;
}

/* ---------- timer core ---------- */

function updateTimerFromClock() {
  if (!state.running || !state.endsAt) return;
  state.remaining = Math.max(0, (state.endsAt - Date.now()) / 1000);

  if (state.remaining <= 0) {
    completeSession();
    return;
  }

  const remainingRatio = state.remaining / modeSeconds(state.mode);
  if (state.mode === "focus" && remainingRatio <= 0.1) {
    setCharacter("almost");
  }

  render();
}

function startTimer() {
  clearTimeout(finishTimer);
  clearTimeout(idleTimer);
  maybeRequestNotificationPermission();
  state.running = true;
  state.startedAt = Date.now();
  state.endsAt = state.startedAt + state.remaining * 1000;
  setCharacter(state.mode === "focus" ? "focus" : "break");
  tickTimer = setInterval(updateTimerFromClock, 250);
  render();
}

function stopTimer() {
  updateTimerFromClock();
  state.running = false;
  state.startedAt = null;
  state.endsAt = null;
  clearInterval(tickTimer);
  scheduleIdle();
  saveState();
  render();
}

function resetMode(mode) {
  state.mode = mode;
  state.remaining = modeSeconds(mode);
  state.running = false;
  state.startedAt = null;
  state.endsAt = null;
  clearInterval(tickTimer);
  clearTimeout(finishTimer);
  setCharacter(mode === "focus" ? "cover" : "break");
  scheduleIdle();
  saveState();
  render();
}

function completeSession() {
  clearInterval(tickTimer);
  state.running = false;
  state.remaining = 0;
  state.startedAt = null;
  state.endsAt = null;
  setCharacter("timesup");

  if (state.mode === "focus") {
    state.completedFocus += 1;
    state.focusStreak += 1;
    const focusSeconds = modeSeconds("focus");
    state.totalFocusSeconds += focusSeconds;
    state.sessions.push({
      id: createId(),
      completedAt: new Date().toISOString(),
      focusSeconds,
    });
    maybeAutoCheckTask();
  } else {
    state.focusStreak = state.mode === "long" ? 0 : state.focusStreak;
  }

  saveState();
  render();
  notifyOnComplete(state.mode);
  playAlarmSequence();

  finishTimer = setTimeout(() => {
    setCharacter("done");
    const nextMode = getNextModeAfterCompletion();
    state.mode = nextMode;
    state.remaining = modeSeconds(nextMode);
    saveState();
    render();
    scheduleIdle();
    if (shouldAutoStart(nextMode)) startTimer();
  }, 2300);
}

function maybeRequestNotificationPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      const result = Notification.requestPermission();
      if (result && typeof result.catch === "function") result.catch(() => {});
    }
  } catch (error) {
    /* notifications unsupported */
  }
}

function notifyOnComplete(mode) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const body =
      mode === "focus" ? "Focus complete \u2014 time for a break." : "Break over \u2014 ready for the next one?";
    new Notification("Pomodoro by Hey Nous", { body });
  } catch (error) {
    /* ignore */
  }
}

async function playAlarmSequence() {
  if (state.settings.alarmSound === "None") return;

  for (let index = 0; index < ALARM_PLAY_COUNT; index += 1) {
    try {
      await playAudioOnce(state.settings.alarmSound, state.settings.alarmVolume / 100);
      if (index < ALARM_PLAY_COUNT - 1) {
        await wait(ALARM_PAUSE_MS);
      }
    } catch (error) {
      console.warn("Alarm sound could not play.", error);
      break;
    }
  }
}

function playAudioOnce(src, volume) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.addEventListener("ended", resolve, { once: true });
    audio.addEventListener("error", reject, { once: true });
    audio.play().catch(reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function testSelectedAudio() {
  updateSettingsFromForm();
  const src = state.settings.alarmSound;
  const volume = state.settings.alarmVolume / 100;
  if (src === "None") return;

  const button = els.testAlarmSound;
  button.disabled = true;
  button.textContent = "Playing";

  try {
    await playAudioOnce(src, volume);
  } catch (error) {
    console.warn("Test sound could not play.", error);
  } finally {
    button.disabled = false;
    button.textContent = "Test";
  }
}

function getNextModeAfterCompletion() {
  if (state.mode !== "focus") return "focus";
  return state.focusStreak % state.settings.longBreakInterval === 0 ? "long" : "short";
}

function shouldAutoStart(nextMode) {
  if (nextMode === "focus") return state.settings.autoStartPomodoros;
  return state.settings.autoStartBreaks;
}

function maybeAutoCheckTask() {
  if (!state.settings.autoCheckTasks) return;
  const task = state.tasks.find((candidate) => !candidate.done);
  if (!task) return;
  task.done = true;
  if (state.settings.checkToBottom) {
    state.tasks = [...state.tasks.filter((candidate) => candidate.id !== task.id), task];
  }
  renderTasks();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  if (state.running) return;
  idleTimer = setTimeout(() => {
    if (!state.running) {
      setCharacter("ignored");
      saveState();
      render();
    }
  }, IDLE_AFTER_MS);
}

/* ---------- generated ambience (Web Audio, on-device) ---------- */

const ambienceEngine = {
  ctx: null,
  master: null,
  current: null,

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return true;
  },

  noiseBuffer(brown) {
    const len = 2 * this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (!brown) {
      for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    } else {
      let last = 0;
      for (let i = 0; i < len; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  },

  play(sound) {
    if (!this.ensureCtx()) return;
    this.stop();
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.connect(this.master);
    const stopFns = [];

    if (sound === "white" || sound === "brown") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(sound === "brown");
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = sound === "brown" ? 900 : 12000;
      src.connect(filt);
      filt.connect(out);
      src.start();
      stopFns.push(() => {
        try {
          src.stop();
        } catch (error) {
          /* already stopped */
        }
      });
    } else if (sound === "rain") {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(false);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2400;
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      src.connect(bp);
      bp.connect(g);
      g.connect(out);
      src.start();
      lfo.start();
      stopFns.push(() => {
        try {
          src.stop();
        } catch (error) {
          /* already stopped */
        }
        try {
          lfo.stop();
        } catch (error) {
          /* already stopped */
        }
      });
    }

    this.applyVolume();
    this.current = {
      stop: () => stopFns.forEach((fn) => fn()),
    };
    ambiencePlaying = true;
  },

  stop() {
    if (this.current) {
      this.current.stop();
      this.current = null;
    }
    ambiencePlaying = false;
  },

  applyVolume() {
    if (this.master) {
      this.master.gain.value = (state.settings.ambienceVolume / 100) * 0.6;
    }
  },
};

function setAmbience(sound) {
  state.settings.ambienceSound = AMBIENCE_SOUNDS.includes(sound) ? sound : "off";
  try {
    if (state.settings.ambienceSound === "off") {
      ambienceEngine.stop();
    } else {
      ambienceEngine.play(state.settings.ambienceSound);
    }
  } catch (error) {
    console.warn("Ambience could not start.", error);
  }
  saveState();
  renderAmbience();
}

function renderAmbience() {
  els.ambienceOpen.classList.toggle("is-live", ambiencePlaying);
  els.ambienceOpen.setAttribute(
    "aria-label",
    ambiencePlaying ? `Open background ambience, ${AMBIENCE_LABELS[state.settings.ambienceSound]} playing` : "Open background ambience",
  );
  els.ambButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.sound === state.settings.ambienceSound));
  });
  els.panelAmbienceVolume.value = state.settings.ambienceVolume;
  els.panelAmbienceVolumeValue.value = state.settings.ambienceVolume;
  els.settingAmbienceSound.value = state.settings.ambienceSound;
  els.settingAmbienceVolume.value = state.settings.ambienceVolume;
  els.ambienceVolumeValue.value = state.settings.ambienceVolume;
}

/* ---------- rendering ---------- */

function renderTabs() {
  els.tabs.forEach((tab) => {
    const active = tab.dataset.mode === state.mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function renderTasks() {
  els.taskList.innerHTML = "";

  state.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task${task.done ? " done" : ""}`;

    const check = document.createElement("label");
    check.className = "check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Mark ${task.text || "task"} complete`);
    const box = document.createElement("span");
    box.className = "box";
    box.setAttribute("aria-hidden", "true");
    check.append(checkbox, box);
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveState();
      renderTasks();
    });

    const input = document.createElement("input");
    input.className = "task-input";
    input.value = task.text;
    input.placeholder = "New task";
    input.setAttribute("aria-label", "Task name");
    input.addEventListener("input", () => {
      task.text = input.value;
      saveState();
    });
    input.addEventListener("focus", markAction);

    const est = document.createElement("div");
    est.className = "est";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "\u2212";
    minus.setAttribute("aria-label", "Decrease pomodoro estimate");
    const estN = document.createElement("span");
    estN.className = "est-n";
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase pomodoro estimate");
    const syncEst = () => {
      estN.textContent = `${task.est}\u00d7`;
      minus.disabled = task.est <= 1;
      plus.disabled = task.est >= 20;
    };
    minus.addEventListener("click", () => {
      task.est = Math.max(1, task.est - 1);
      saveState();
      syncEst();
    });
    plus.addEventListener("click", () => {
      task.est = Math.min(20, task.est + 1);
      saveState();
      syncEst();
    });
    syncEst();
    est.append(minus, estN, plus);

    const remove = document.createElement("button");
    remove.className = "task-del";
    remove.type = "button";
    remove.textContent = "\u00d7";
    remove.setAttribute("aria-label", `Delete ${task.text || "task"}`);
    remove.addEventListener("click", () => {
      state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
      saveState();
      renderTasks();
    });

    item.append(check, input, est, remove);
    els.taskList.append(item);
  });
}

function render() {
  const time = formatTime(state.remaining);
  els.timerDisplay.textContent = time;
  els.startStop.textContent = state.running ? "STOP" : "START";
  els.startStop.classList.toggle("is-stop", state.running);

  const progress = getProgress();
  els.journeyWalker.style.setProperty("--progress", progress.toFixed(4));
  els.journeyFill.style.width = `${(progress * 100).toFixed(2)}%`;

  els.completedCount.textContent = state.completedFocus;
  els.totalFocus.textContent = `${Math.round(state.totalFocusSeconds / 60)}m`;

  const uniqueDays = new Set(getFocusSessions().map((session) => toDateKey(new Date(session.completedAt))));
  els.streakCount.textContent = getDayStreak(uniqueDays);
  els.freezeCount.textContent = state.streakFreezes;

  const todayCount = countTodaySessions();
  const goal = state.settings.dailyGoal;
  els.goalText.textContent = `${todayCount}/${goal}`;
  els.goalRingFg.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - Math.min(1, todayCount / goal))).toFixed(1);

  document.title = state.running ? `(${time}) Pomodoro by Hey Nous` : PAGE_TITLE;

  replenishFreezeCheck();
  renderTabs();
  renderPrimaryNav();
  renderAmbience();
  if (!els.activitySummary.hidden) renderActivitySummary();
}

function showActivitySummary() {
  activeNav = "summary";
  summaryRange = "week";
  summaryOffset = 0;
  els.timerView.hidden = true;
  els.activitySummary.hidden = false;
  renderActivitySummary();
  renderPrimaryNav();
  window.scrollTo(0, 0);
  els.backToTimer.focus();
}

function showTimerView() {
  activeNav = "home";
  els.activitySummary.hidden = true;
  els.timerView.hidden = false;
  renderPrimaryNav();
  els.openActivitySummary.focus();
}

function renderActivitySummary() {
  const sessions = getFocusSessions();
  const totalSeconds = sessions.reduce((sum, session) => sum + session.focusSeconds, 0);
  const uniqueDays = new Set(sessions.map((session) => toDateKey(new Date(session.completedAt))));

  els.summaryHours.textContent = formatHours(totalSeconds);
  els.summaryDays.textContent = uniqueDays.size;
  els.summaryStreak.textContent = getDayStreak(uniqueDays);

  const chart = getChartData(sessions, summaryRange, summaryOffset);
  els.summaryPeriod.textContent = chart.periodLabel;
  els.summaryBars.innerHTML = "";

  chart.items.forEach((item) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.tabIndex = 0;
    col.setAttribute("role", "img");
    const tip = `${item.label}: ${formatSummaryBarValue(item.hours)}`;
    col.setAttribute("aria-label", tip);
    col.dataset.tip = tip;
    const barHeight = Math.max(6, (item.hours / chart.maxHours) * 150);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${barHeight.toFixed(1)}px`;
    const lab = document.createElement("div");
    lab.className = "bar-lab";
    lab.textContent = item.label;
    col.append(bar, lab);
    els.summaryBars.append(col);
  });

  els.rangeTabs.forEach((tab) => {
    const active = tab.dataset.range === summaryRange;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function formatSummaryBarValue(hours) {
  if (!hours) return "0m focused";
  if (hours < 1) return `${Math.round(hours * 60)}m focused`;
  const rounded = hours >= 10 ? hours.toFixed(0) : hours.toFixed(1);
  return `${rounded}h focused`;
}

function renderPrimaryNav() {
  const isSettingsOpen = !els.settingsOverlay.hidden;
  const current = isSettingsOpen ? "settings" : activeNav;

  els.navHome.classList.toggle("is-active", current === "home");
  els.navSummary.classList.toggle("is-active", current === "summary");
  els.settingsOpen.classList.toggle("is-active", current === "settings");
}

function syncBodyModalState() {
  const anyModalOpen =
    !els.settingsOverlay.hidden || !els.summaryConfirmOverlay.hidden || !els.ambienceOverlay.hidden;
  document.body.classList.toggle("modal-open", anyModalOpen);
}

/* ---------- sessions & charts ---------- */

function getFocusSessions() {
  if (state.sessions.length) return state.sessions;
  if (!state.totalFocusSeconds) return [];
  return [
    {
      id: "legacy-total",
      completedAt: new Date().toISOString(),
      focusSeconds: state.totalFocusSeconds,
    },
  ];
}

function formatHours(seconds) {
  if (!seconds) return "0m";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${Number(hours.toFixed(1))}h`;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function resetSummaryData() {
  summaryRange = "week";
  summaryOffset = 0;
  state.sessions = [];
  state.completedFocus = 0;
  state.totalFocusSeconds = 0;
  state.focusStreak = 0;
  state.streakFreezes = 1;
  state.freezeWeekKey = isoWeekKey(new Date());
  saveState();
  render();
  if (!els.activitySummary.hidden) renderActivitySummary();
}

function openSummaryConfirm() {
  els.summaryConfirmOverlay.hidden = false;
  syncBodyModalState();
  els.summaryConfirmCancel.focus();
}

function closeSummaryConfirm() {
  els.summaryConfirmOverlay.hidden = true;
  syncBodyModalState();
  els.summaryReset.focus();
}

function confirmSummaryReset() {
  closeSummaryConfirm();
  resetSummaryData();
}

function getChartData(sessions, range, offset) {
  if (range === "month") return getMonthChart(sessions, offset);
  if (range === "year") return getYearChart(sessions, offset);
  return getWeekChart(sessions, offset);
}

function getWeekChart(sessions, offset) {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const items = labels.map((label, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { label, start: day, end: addDays(day, 1), hours: 0 };
  });
  fillChartHours(items, sessions);
  return {
    items,
    maxHours: getMaxHours(items),
    periodLabel: offset === 0 ? "This Week" : formatPeriodRange(items[0].start, items[6].start),
  };
}

function getMonthChart(sessions, offset) {
  const month = new Date();
  month.setMonth(month.getMonth() + offset, 1);
  month.setHours(0, 0, 0, 0);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const items = Array.from({ length: daysInMonth }, (_, index) => {
    const day = new Date(year, monthIndex, index + 1);
    return { label: String(index + 1), start: day, end: addDays(day, 1), hours: 0 };
  });
  fillChartHours(items, sessions);
  return {
    items,
    maxHours: getMaxHours(items),
    periodLabel: month.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
  };
}

function getYearChart(sessions, offset) {
  const year = new Date().getFullYear() + offset;
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const items = labels.map((label, index) => ({
    label,
    start: new Date(year, index, 1),
    end: new Date(year, index + 1, 1),
    hours: 0,
  }));
  fillChartHours(items, sessions);
  return {
    items,
    maxHours: getMaxHours(items),
    periodLabel: String(year),
  };
}

function fillChartHours(items, sessions) {
  sessions.forEach((session) => {
    const completedAt = new Date(session.completedAt);
    const item = items.find((candidate) => completedAt >= candidate.start && completedAt < candidate.end);
    if (item) item.hours += session.focusSeconds / 3600;
  });
}

function getMaxHours(items) {
  return Math.max(1, ...items.map((item) => item.hours));
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return start;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatPeriodRange(start, end) {
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/* ---------- settings ---------- */

function renderSettings() {
  renderAudioOptions(els.settingAlarmSound, state.settings.alarmSound);
  els.settingFocusMinutes.value = state.settings.focusMinutes;
  els.settingShortMinutes.value = state.settings.shortMinutes;
  els.settingLongMinutes.value = state.settings.longMinutes;
  els.settingAutoStartBreaks.checked = state.settings.autoStartBreaks;
  els.settingAutoStartPomodoros.checked = state.settings.autoStartPomodoros;
  els.settingLongBreakInterval.value = state.settings.longBreakInterval;
  els.settingDailyGoal.value = state.settings.dailyGoal;
  els.settingAutoCheckTasks.checked = state.settings.autoCheckTasks;
  els.settingCheckToBottom.checked = state.settings.checkToBottom;
  els.settingAlarmSound.value = state.settings.alarmSound;
  els.settingAlarmVolume.value = state.settings.alarmVolume;
  els.alarmVolumeValue.value = state.settings.alarmVolume;
  els.settingAmbienceSound.value = state.settings.ambienceSound;
  els.settingAmbienceVolume.value = state.settings.ambienceVolume;
  els.ambienceVolumeValue.value = state.settings.ambienceVolume;
  els.settingHourFormat.value = state.settings.hourFormat;
  els.themeSegButtons.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.themeVal === state.settings.theme));
  });
}

function renderAudioOptions(select, selectedValue) {
  const currentValues = [...select.options].map((option) => option.value).join("|");
  const nextValues = AUDIO_OPTIONS.map((option) => option.value).join("|");
  if (currentValues !== nextValues) {
    select.replaceChildren(
      ...AUDIO_OPTIONS.map((option) => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        return element;
      }),
    );
  }
  select.value = selectedValue;
}

function openSettings() {
  activeNav = "settings";
  renderPrimaryNav();
  renderSettings();
  els.settingsOverlay.hidden = false;
  syncBodyModalState();
  els.settingsClose.focus();
}

function closeSettings() {
  els.settingsOverlay.hidden = true;
  activeNav = els.activitySummary.hidden ? "home" : "summary";
  renderPrimaryNav();
  syncBodyModalState();
  els.settingsOpen.focus();
}

function updateSettingsFromForm() {
  const prevAmbience = state.settings.ambienceSound;
  state.settings = normalizeSettings({
    focusMinutes: els.settingFocusMinutes.value,
    shortMinutes: els.settingShortMinutes.value,
    longMinutes: els.settingLongMinutes.value,
    autoStartBreaks: els.settingAutoStartBreaks.checked,
    autoStartPomodoros: els.settingAutoStartPomodoros.checked,
    longBreakInterval: els.settingLongBreakInterval.value,
    dailyGoal: els.settingDailyGoal.value,
    autoCheckTasks: els.settingAutoCheckTasks.checked,
    checkToBottom: els.settingCheckToBottom.checked,
    alarmSound: els.settingAlarmSound.value,
    alarmVolume: els.settingAlarmVolume.value,
    ambienceSound: els.settingAmbienceSound.value,
    ambienceVolume: els.settingAmbienceVolume.value,
    theme: state.settings.theme,
    hourFormat: els.settingHourFormat.value,
  });

  if (!state.running) {
    state.remaining = modeSeconds(state.mode);
  }

  if (state.settings.ambienceSound !== prevAmbience) {
    setAmbience(state.settings.ambienceSound);
  } else {
    ambienceEngine.applyVolume();
  }

  applyTheme();
  renderSettings();
  saveState();
  render();
}

function setTheme(next) {
  state.settings.theme = next === "dark" ? "dark" : "light";
  applyTheme();
  renderSettings();
  saveState();
}

/* ---------- ambience panel ---------- */

function openAmbience() {
  renderAmbience();
  els.ambienceOverlay.hidden = false;
  syncBodyModalState();
  els.ambienceClose.focus();
}

function closeAmbience() {
  els.ambienceOverlay.hidden = true;
  syncBodyModalState();
  els.ambienceOpen.focus();
}

/* ---------- events ---------- */

function markAction() {
  if (!state.running && state.characterState === "ignored") {
    setCharacter(state.mode === "focus" ? "cover" : "break");
  }
  scheduleIdle();
}

els.startStop.addEventListener("click", () => {
  markAction();
  if (state.running) {
    stopTimer();
  } else {
    startTimer();
  }
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    markAction();
    resetMode(tab.dataset.mode);
  });
});

els.addTask.addEventListener("click", () => {
  markAction();
  const task = { id: createId(), text: "", done: false, est: 1 };
  state.tasks.push(task);
  saveState();
  renderTasks();
  const input = els.taskList.lastElementChild?.querySelector(".task-input");
  input?.focus();
});

els.openActivitySummary.addEventListener("click", showActivitySummary);
els.navSummary.addEventListener("click", () => {
  markAction();
  showActivitySummary();
});
els.navHome.addEventListener("click", () => {
  markAction();
  showTimerView();
  els.navHome.focus();
});
els.backToTimer.addEventListener("click", showTimerView);
els.summaryReset.addEventListener("click", openSummaryConfirm);
els.summaryConfirmCancel.addEventListener("click", closeSummaryConfirm);
els.summaryConfirmOk.addEventListener("click", confirmSummaryReset);
els.summaryConfirmOverlay.addEventListener("click", (event) => {
  if (event.target === els.summaryConfirmOverlay) closeSummaryConfirm();
});

els.ambienceOpen.addEventListener("click", () => {
  markAction();
  openAmbience();
});
els.ambienceClose.addEventListener("click", closeAmbience);
els.ambienceOverlay.addEventListener("click", (event) => {
  if (event.target === els.ambienceOverlay) closeAmbience();
});
els.ambButtons.forEach((button) => {
  button.addEventListener("click", () => {
    markAction();
    setAmbience(button.dataset.sound);
  });
});
els.panelAmbienceVolume.addEventListener("input", () => {
  state.settings.ambienceVolume = Number(els.panelAmbienceVolume.value);
  els.panelAmbienceVolumeValue.value = els.panelAmbienceVolume.value;
  els.settingAmbienceVolume.value = els.panelAmbienceVolume.value;
  els.ambienceVolumeValue.value = els.panelAmbienceVolume.value;
  ambienceEngine.applyVolume();
});
els.panelAmbienceVolume.addEventListener("change", () => {
  state.settings.ambienceVolume = Number(els.panelAmbienceVolume.value);
  saveState();
});

els.rangeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    summaryRange = tab.dataset.range;
    summaryOffset = 0;
    renderActivitySummary();
  });
});

els.summaryPrev.addEventListener("click", () => {
  summaryOffset -= 1;
  renderActivitySummary();
});

els.summaryNext.addEventListener("click", () => {
  summaryOffset += 1;
  renderActivitySummary();
});

els.settingsOpen.addEventListener("click", () => {
  markAction();
  openSettings();
});
els.settingsClose.addEventListener("click", closeSettings);
els.settingsOverlay.addEventListener("click", (event) => {
  if (event.target === els.settingsOverlay) closeSettings();
});
els.settingsForm.addEventListener("input", updateSettingsFromForm);
els.settingsForm.addEventListener("change", updateSettingsFromForm);
els.testAlarmSound.addEventListener("click", () => {
  testSelectedAudio();
});
els.themeSegButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setTheme(button.dataset.themeVal);
  });
});
els.themeToggle.addEventListener("click", () => {
  setTheme(state.settings.theme === "dark" ? "light" : "dark");
});

document.addEventListener("pointerdown", markAction);
document.addEventListener("keydown", markAction);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!els.ambienceOverlay.hidden) {
      closeAmbience();
      return;
    }
    if (!els.summaryConfirmOverlay.hidden) {
      closeSummaryConfirm();
      return;
    }
    if (!els.settingsOverlay.hidden) closeSettings();
    return;
  }

  if (event.code !== "Space" && event.key !== " ") return;
  const target = event.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
    return;
  }
  if (target && target.tagName === "BUTTON") return;
  if (!els.settingsOverlay.hidden || !els.ambienceOverlay.hidden || !els.summaryConfirmOverlay.hidden) return;
  event.preventDefault();
  markAction();
  if (state.running) {
    stopTimer();
  } else {
    startTimer();
  }
});

/* ---------- init ---------- */

applyTheme();
replenishFreezeCheck();
renderTasks();
setCharacter(state.characterState);
render();
renderSettings();
renderPrimaryNav();
scheduleIdle();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  });
}
