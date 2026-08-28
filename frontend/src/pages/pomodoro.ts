import { h, list, when } from "../core/dom.js";
import { computed, effect, signal, type Signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { toast } from "../core/toast.js";
import { Drawer } from "../core/drawer.js";
import { Dropdown } from "../core/dropdown.js";
import { dotColon, reactiveDotDigit } from "../core/dotmatrix.js";
import { currentPath } from "../core/router.js";
import { stopAmbient } from "../core/ambient-audio.js";

type Mode = "focus" | "short" | "long";
type TopTab = "pomodoro" | "countdown" | "tracking";

interface PomodoroSettings {
  focus: number; // minutes
  short: number;
  long: number;
  sessionsBeforeLongBreak: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focus: 20,
  short: 5,
  long: 15,
  sessionsBeforeLongBreak: 4,
};

const SETTINGS_KEY = "hearth_pomodoro_settings";

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PomodoroSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: PomodoroSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

const COUNTDOWN_PRESETS_MIN = [5, 10, 15, 25, 45, 60];

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface FocusEntry {
  date: string; // YYYY-MM-DD
  minutes: number;
}

const HISTORY_KEY = "hearth_focus_history";

function loadHistory(): FocusEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as FocusEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: FocusEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function PomodoroPage(): Node {
  const topTab = signal<TopTab>("pomodoro");
  const settings = signal<PomodoroSettings>(loadSettings());
  const DURATIONS = computed<Record<Mode, number>>(() => ({
    focus: settings().focus * 60,
    short: settings().short * 60,
    long: settings().long * 60,
  }));
  const focusSessionsCompleted = signal(0);

  // Pomodoro (fixed-cycle) state
  const mode = signal<Mode>("focus");
  const remaining = signal(DURATIONS().focus);

  // Countdown (one-shot, user-chosen duration) state
  const countdownMinutes = signal(COUNTDOWN_PRESETS_MIN[1]!); // default 10
  const countdownRemaining = signal(COUNTDOWN_PRESETS_MIN[1]! * 60);

  // Tracking (open-ended stopwatch) state
  const trackingElapsed = signal(0);

  const running = signal(false);
  const history = signal<FocusEntry[]>(loadHistory());
  const subtasks = signal<Subtask[]>([]);
  const newSubtask = signal("");

  // Focus Sounds: real filtered-noise ambient loops (Web Audio), not a fabricated music player
  const soundPlaying = signal(false);

  // Stop the ambient loop when navigating away from the Pomodoro page — this framework
  // has no unmount hook, so watch the route directly.
  effect(() => {
    if (!currentPath().startsWith("/pomodoro") && soundPlaying()) {
      soundPlaying.set(false);
      stopAmbient();
    }
  });

  let timer: ReturnType<typeof setInterval> | null = null;
  let subtaskInputEl: HTMLInputElement | null = null;

  const stop = () => {
    running.set(false);
    if (timer) clearInterval(timer);
    timer = null;
  };

  const recordFocusMinutes = (minutes: number) => {
    if (minutes <= 0) return;
    const entries = [...history(), { date: todayKey(), minutes }];
    history.set(entries);
    saveHistory(entries);
  };

  const tick = () => {
    switch (topTab()) {
      case "pomodoro": {
        const next = remaining() - 1;
        if (next <= 0) {
          remaining.set(0);
          stop();
          if (mode() === "focus") {
            recordFocusMinutes(DURATIONS().focus / 60);
            focusSessionsCompleted.update((n) => n + 1);
          }
          toast.success("Focus session complete", { message: "Nice work — take a break." });
          return;
        }
        remaining.set(next);
        return;
      }
      case "countdown": {
        const next = countdownRemaining() - 1;
        if (next <= 0) {
          countdownRemaining.set(0);
          stop();
          recordFocusMinutes(countdownMinutes());
          toast.success("Countdown complete", { message: `Logged ${countdownMinutes()} min.` });
          return;
        }
        countdownRemaining.set(next);
        return;
      }
      case "tracking": {
        trackingElapsed.update((s) => s + 1);
        return;
      }
    }
  };

  const start = () => {
    if (running()) return;
    running.set(true);
    timer = setInterval(tick, 1000);
  };

  const toggle = () => (running() ? stop() : start());

  const reset = () => {
    stop();
    if (topTab() === "pomodoro") {
      remaining.set(DURATIONS()[mode()]);
    } else if (topTab() === "countdown") {
      countdownRemaining.set(countdownMinutes() * 60);
    } else {
      const elapsed = trackingElapsed();
      if (elapsed > 0) {
        const minutes = Math.round(elapsed / 60);
        if (minutes > 0) {
          recordFocusMinutes(minutes);
          toast.info("Session logged", { message: `Tracked ${minutes} min.` });
        }
      }
      trackingElapsed.set(0);
    }
  };

  const switchTopTab = (t: TopTab) => {
    stop();
    topTab.set(t);
  };

  const switchMode = (m: Mode) => {
    stop();
    mode.set(m);
    remaining.set(DURATIONS()[m]);
  };

  const saveSettingsAndApply = (next: PomodoroSettings) => {
    settings.set(next);
    saveSettings(next);
    if (topTab() === "pomodoro" && !running()) {
      remaining.set(DURATIONS()[mode()]);
    }
  };

  const pickCountdownPreset = (minutes: number) => {
    stop();
    countdownMinutes.set(minutes);
    countdownRemaining.set(minutes * 60);
  };

  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === "r") {
      reset();
    }
  });

  const addSubtask = (e: Event) => {
    e.preventDefault();
    const title = newSubtask().trim();
    if (!title) return;
    subtasks.update((cur) => [...cur, { id: crypto.randomUUID(), title, done: false }]);
    newSubtask.set("");
    if (subtaskInputEl) subtaskInputEl.value = "";
  };

  const toggleSubtask = (id: string) => {
    subtasks.update((cur) => cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeSubtask = (id: string) => {
    subtasks.update((cur) => cur.filter((t) => t.id !== id));
  };

  const displaySeconds = computed(() => {
    if (topTab() === "pomodoro") return remaining();
    if (topTab() === "countdown") return countdownRemaining();
    return trackingElapsed();
  });
  const mmStr = computed(() => pad2(Math.floor(displaySeconds() / 60) % 100));
  const ssStr = computed(() => pad2(Math.floor(displaySeconds() % 60)));

  const modes: Mode[] = ["focus", "short", "long"];
  const topTabs: { id: TopTab; label: string }[] = [
    { id: "pomodoro", label: "Pomodoro" },
    { id: "countdown", label: "Countdown" },
    { id: "tracking", label: "Tracking" },
  ];

  const isPomodoro = computed(() => topTab() === "pomodoro");
  const isCountdown = computed(() => topTab() === "countdown");
  const isTracking = computed(() => topTab() === "tracking");

  const settingsDrawer = SettingsDrawer(settings, saveSettingsAndApply);

  return h(
    "div.pomodoro-page",
    {},
    h(
      "div.pomodoro-layout",
      {},
      h(
        "div.pomodoro-main",
        {},
        h(
          "div.segmented",
          {},
          ...topTabs.map((t) =>
            h(
              "button.segmented-item",
              {
                class: computed(() => (topTab() === t.id ? "active" : "")),
                onclick: () => switchTopTab(t.id),
              },
              t.label,
            ),
          ),
        ),
        h(
          "div.pomodoro-center",
          {},
          h(
            "div.glow-card",
            {},
            h(
              "div.glow-card-inner",
              {},
              when(isPomodoro, () =>
                h(
                  "div.pomodoro-tabs",
                  {},
                  ...modes.map((m) =>
                    h(
                      "button.pomodoro-tab",
                      { class: computed(() => (mode() === m ? "active" : "")), onclick: () => switchMode(m) },
                      MODE_LABEL[m],
                    ),
                  ),
                ),
              ),
              when(isCountdown, () =>
                h(
                  "div.pomodoro-tabs",
                  {},
                  ...COUNTDOWN_PRESETS_MIN.map((min) =>
                    h(
                      "button.pomodoro-tab",
                      {
                        class: computed(() => (countdownMinutes() === min ? "active" : "")),
                        onclick: () => pickCountdownPreset(min),
                      },
                      `${min}m`,
                    ),
                  ),
                ),
              ),
              when(isTracking, () =>
                h(
                  "p",
                  { style: { color: "var(--color-text-muted)", fontSize: "0.8125rem", margin: "0" } },
                  "Open-ended session — start whenever, stop whenever. Time gets logged when you reset.",
                ),
              ),
              h(
                "div.dot-clock",
                {},
                reactiveDotDigit(() => mmStr()[0]!, 9),
                reactiveDotDigit(() => mmStr()[1]!, 9),
                dotColon(9),
                reactiveDotDigit(() => ssStr()[0]!, 9),
                reactiveDotDigit(() => ssStr()[1]!, 9),
              ),
              h(
                "div.pomodoro-meta",
                {},
                when(
                  isPomodoro,
                  () =>
                    h(
                      "span.loop-badge",
                      {},
                      computed(() => {
                        const n =
                          (focusSessionsCompleted() % settings().sessionsBeforeLongBreak) +
                          (mode() === "focus" ? 1 : 0);
                        return `${Math.min(n, settings().sessionsBeforeLongBreak)}/${settings().sessionsBeforeLongBreak} Session`;
                      }),
                    ),
                  () => h("span.loop-badge", {}, isTracking() ? "OPEN" : "ONE-SHOT"),
                ),
                h(
                  "span.pomodoro-meta-text",
                  {},
                  computed(() => {
                    if (topTab() === "pomodoro") return MODE_LABEL[mode()];
                    if (topTab() === "countdown") return "Countdown";
                    return "Tracking";
                  }),
                ),
                h(
                  "span.pomodoro-meta-text",
                  {},
                  computed(() => {
                    if (topTab() === "pomodoro") return `${Math.floor(DURATIONS()[mode()] / 60)} min`;
                    if (topTab() === "countdown") return `${countdownMinutes()} min`;
                    return "Open-ended";
                  }),
                ),
              ),
              h(
                "div.subtask-list",
                {},
                list(subtasks, (task) =>
                  h(
                    "div.subtask-item",
                    {},
                    h(
                      "button",
                      {
                        class: task.done ? "subtask-checkbox checked" : "subtask-checkbox",
                        onclick: () => toggleSubtask(task.id),
                      },
                      task.done ? icons.checklist(11) : null,
                    ),
                    h("span", { class: task.done ? "subtask-label done" : "subtask-label" }, task.title),
                    Dropdown(
                      (toggle) =>
                        h(
                          "button.subtask-remove",
                          { onclick: toggle, title: "More" },
                          icons.moreHorizontal(15),
                        ),
                      (close) =>
                        h(
                          "div.dropdown-menu",
                          { style: { minWidth: "140px" } },
                          h(
                            "button.dropdown-item.danger",
                            {
                              onclick: () => {
                                close();
                                removeSubtask(task.id);
                              },
                            },
                            icons.trash(14),
                            "Remove",
                          ),
                        ),
                    ),
                  ),
                ),
                h(
                  "form.subtask-add",
                  { onsubmit: addSubtask },
                  icons.plus(14),
                  h("input.subtask-add-input", {
                    placeholder: "Add sub task",
                    ref: (el: HTMLElement) => {
                      subtaskInputEl = el as HTMLInputElement;
                    },
                    oninput: (e: Event) => newSubtask.set((e.target as HTMLInputElement).value),
                  }),
                ),
              ),
            ),
          ),
        ),
        h(
          "div.pomodoro-controls",
          {},
          h(
            "button.pomodoro-icon-btn.icon-btn-gear",
            { title: "Settings", type: "button", onclick: settingsDrawer.open },
            icons.settings(18),
          ),
          h(
            "button.btn.btn-primary.pomodoro-start-btn",
            { onclick: toggle },
            when(
              running,
              () => icons.pause(16),
              () => icons.play(16),
            ),
            computed(() => (running() ? "Pause" : "Start")),
          ),
          h(
            "button.pomodoro-icon-btn",
            {
              title: computed(() => (isTracking() && trackingElapsed() > 0 ? "Log & reset" : "Reset")),
              type: "button",
              onclick: reset,
            },
            icons.rotate(18),
          ),
        ),
        h(
          "div.pomodoro-hint",
          {},
          h("span", {}, h("kbd", {}, "Space"), "Toggle"),
          h(
            "span",
            {},
            h("kbd", {}, "R"),
            computed(() => (isTracking() ? "Log & reset" : "Reset")),
          ),
        ),
      ),
    ),
  );
}

function SettingsDrawer(
  settings: Signal<PomodoroSettings>,
  onSave: (next: PomodoroSettings) => void,
): ReturnType<typeof Drawer> {
  const focusMin = signal(settings().focus);
  const shortMin = signal(settings().short);
  const longMin = signal(settings().long);
  const sessionsBeforeLongBreak = signal(settings().sessionsBeforeLongBreak);

  return Drawer("Pomodoro settings", (close) =>
    h(
      "form.stack.gap-4",
      {
        onsubmit: (e: Event) => {
          e.preventDefault();
          const clamp = (n: number, min: number, max: number) =>
            Math.min(max, Math.max(min, Math.round(n) || min));
          const next: PomodoroSettings = {
            focus: clamp(focusMin(), 1, 180),
            short: clamp(shortMin(), 1, 60),
            long: clamp(longMin(), 1, 90),
            sessionsBeforeLongBreak: clamp(sessionsBeforeLongBreak(), 2, 12),
          };
          onSave(next);
          toast.success("Settings saved");
          close();
        },
      },
      h(
        "div.field",
        {},
        h("label", {}, "Focus (minutes)"),
        h("input.input", {
          type: "number",
          min: "1",
          max: "180",
          value: String(focusMin()),
          oninput: (e: Event) => focusMin.set(Number((e.target as HTMLInputElement).value)),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Short break (minutes)"),
        h("input.input", {
          type: "number",
          min: "1",
          max: "60",
          value: String(shortMin()),
          oninput: (e: Event) => shortMin.set(Number((e.target as HTMLInputElement).value)),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Long break (minutes)"),
        h("input.input", {
          type: "number",
          min: "1",
          max: "90",
          value: String(longMin()),
          oninput: (e: Event) => longMin.set(Number((e.target as HTMLInputElement).value)),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Focus sessions before a long break"),
        h("input.input", {
          type: "number",
          min: "2",
          max: "12",
          value: String(sessionsBeforeLongBreak()),
          oninput: (e: Event) => sessionsBeforeLongBreak.set(Number((e.target as HTMLInputElement).value)),
        }),
      ),
      h(
        "div.drawer-footer",
        { style: { padding: "0", borderTop: "none", marginTop: "8px" } },
        h("button.btn.btn-secondary", { type: "button", onclick: close }, "Cancel"),
        h("button.btn.btn-primary", { type: "submit" }, "Save"),
      ),
    ),
  );
}
