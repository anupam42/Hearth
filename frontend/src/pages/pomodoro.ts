import { h, list, when } from "../core/dom.js";
import { computed, effect, signal, type Signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { dotColon, reactiveDotDigit } from "../core/dotmatrix.js";

type Mode = "focus" | "short" | "long";
type TopTab = "pomodoro" | "countdown" | "tracking";

const DURATIONS: Record<Mode, number> = {
  focus: 20 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface FocusEntry {
  date: string; // YYYY-MM-DD
  minutes: number;
}

const HISTORY_KEY = "snorlax_focus_history";

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

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AMBIENT_SOUNDS = [
  { id: "rain", label: "Rain", icon: icons.moon },
  { id: "cafe", label: "Cafe", icon: icons.music },
  { id: "forest", label: "Forest", icon: icons.eye },
  { id: "silence", label: "Silence", icon: icons.volume },
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function PomodoroPage(): Node {
  const topTab = signal<TopTab>("pomodoro");
  const mode = signal<Mode>("focus");
  const remaining = signal(DURATIONS.focus);
  const running = signal(false);
  const history = signal<FocusEntry[]>(loadHistory());
  const attachedTask = signal("");
  const subtasks = signal<Subtask[]>([]);
  const newSubtask = signal("");
  const ambientSound = signal<string | null>(null);

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
    const next = remaining() - 1;
    if (next <= 0) {
      remaining.set(0);
      stop();
      if (mode() === "focus") recordFocusMinutes(DURATIONS.focus / 60);
      return;
    }
    remaining.set(next);
  };

  const start = () => {
    if (running()) return;
    running.set(true);
    timer = setInterval(tick, 1000);
  };

  const toggle = () => (running() ? stop() : start());

  const reset = () => {
    stop();
    remaining.set(DURATIONS[mode()]);
  };

  const switchMode = (m: Mode) => {
    stop();
    mode.set(m);
    remaining.set(DURATIONS[m]);
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

  const mmStr = computed(() => pad2(Math.floor(remaining() / 60)));
  const ssStr = computed(() => pad2(Math.floor(remaining() % 60)));

  const totalFocusMinutes = computed(() => history().reduce((sum, e) => sum + e.minutes, 0));
  const totalSessions = computed(() => history().length);
  const bestStreakDays = computed(() => {
    const dates = [...new Set(history().map((e) => e.date))].sort();
    if (dates.length === 0) return 0;
    let best = 1;
    let cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]!);
      const next = new Date(dates[i]!);
      const diffDays = Math.round((next.getTime() - prev.getTime()) / 86400000);
      cur = diffDays === 1 ? cur + 1 : 1;
      best = Math.max(best, cur);
    }
    return best;
  });

  const weekMinutes = computed(() => {
    const monday = startOfWeek(new Date());
    const byDate = new Map<string, number>();
    for (const e of history()) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.minutes);
    return WEEK_DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return byDate.get(todayKey(d)) ?? 0;
    });
  });
  const weekTotalHours = computed(() => (weekMinutes().reduce((a, b) => a + b, 0) / 60).toFixed(1));
  const weekMaxMinutes = computed(() => Math.max(1, ...weekMinutes()));
  const todayIndex = (new Date().getDay() + 6) % 7;

  const modes: Mode[] = ["focus", "short", "long"];
  const topTabs: { id: TopTab; label: string }[] = [
    { id: "pomodoro", label: "Pomodoro" },
    { id: "countdown", label: "Countdown" },
    { id: "tracking", label: "Tracking" },
  ];

  const attachInput = h("input.input", {
    style: { maxWidth: "320px", textAlign: "center", fontSize: "0.875rem" },
    placeholder: "Attach a task… (press Enter)",
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) {
          attachedTask.set(val);
          (e.target as HTMLInputElement).value = "";
        }
      }
    },
  });

  return h(
    "div.pomodoro-page",
    {},
    h(
      "div.pomodoro-crumb",
      {},
      icons.timer(16),
      h("span", {}, "Pomodoro"),
      h("span", {}, "/"),
      h("strong", {}, "Focus Session"),
    ),
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
              { class: computed(() => (topTab() === t.id ? "active" : "")), onclick: () => topTab.set(t.id) },
              t.label,
            ),
          ),
        ),
        when(
          computed(() => attachedTask().length > 0),
          () =>
            h(
              "div.task-chip",
              {},
              h("span.task-chip-icon", {}, icons.checklist(13)),
              h("span", {}, attachedTask),
              h("button", { onclick: () => attachedTask.set("") }, icons.x(14)),
            ),
          () => attachInput,
        ),
        h(
          "div.glow-card",
          {},
          h(
            "div.glow-card-inner",
            {},
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
            h(
              "div.dot-clock",
              {},
              reactiveDotDigit(() => mmStr()[0]!, 5),
              reactiveDotDigit(() => mmStr()[1]!, 5),
              dotColon(5),
              reactiveDotDigit(() => ssStr()[0]!, 5),
              reactiveDotDigit(() => ssStr()[1]!, 5),
            ),
            h(
              "div.pomodoro-meta",
              {},
              h("span.loop-badge", {}, "LOOP"),
              h("span.pomodoro-meta-text", {}, computed(() => MODE_LABEL[mode()])),
              h(
                "span.pomodoro-meta-text",
                {},
                computed(() => `${Math.floor(DURATIONS[mode()] / 60)} min`),
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
                    { class: task.done ? "subtask-checkbox checked" : "subtask-checkbox", onclick: () => toggleSubtask(task.id) },
                    task.done ? icons.checklist(11) : null,
                  ),
                  h("span", { class: task.done ? "subtask-label done" : "subtask-label" }, task.title),
                  h("button.subtask-remove", { onclick: () => removeSubtask(task.id) }, icons.trash(14)),
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
        h(
          "div.pomodoro-controls",
          {},
          h("button.pomodoro-icon-btn", { title: "Settings", type: "button" }, icons.settings(18)),
          h(
            "button.btn.btn-primary.pomodoro-start-btn",
            { onclick: toggle },
            when(running, () => icons.pause(16), () => icons.play(16)),
            computed(() => (running() ? "Pause" : "Start")),
          ),
          h("button.pomodoro-icon-btn", { title: "Reset", type: "button", onclick: reset }, icons.rotate(18)),
        ),
        h(
          "div.pomodoro-hint",
          {},
          h("span", {}, h("kbd", {}, "Space"), "Toggle"),
          h("span", {}, h("kbd", {}, "R"), "Reset"),
        ),
      ),
      h(
        "div.pomodoro-side",
        {},
        AnalyticsCard(totalFocusMinutes, totalSessions, bestStreakDays, weekMinutes, weekTotalHours, weekMaxMinutes, todayIndex),
        AmbientCard(ambientSound),
      ),
    ),
  );
}

function AnalyticsCard(
  totalFocusMinutes: Signal<number>,
  totalSessions: Signal<number>,
  bestStreakDays: Signal<number>,
  weekMinutes: Signal<number[]>,
  weekTotalHours: Signal<string>,
  weekMaxMinutes: Signal<number>,
  todayIndex: number,
): Node {
  return h(
    "div.side-card",
    {},
    h(
      "div.side-card-header",
      {},
      h("span.side-card-title", {}, "Analytics"),
    ),
    h(
      "div.stat-row",
      {},
      h(
        "div.stat-tile",
        {},
        h("span.stat-tile-icon", {}, icons.timer(16)),
        h("span.stat-tile-value", {}, computed(() => `${Math.floor(totalFocusMinutes() / 60)}h`)),
        h("span.stat-tile-label", {}, "Total focus"),
      ),
      h(
        "div.stat-tile",
        {},
        h("span.stat-tile-icon", {}, icons.layers(16)),
        h("span.stat-tile-value", {}, totalSessions),
        h("span.stat-tile-label", {}, "Total sessions"),
      ),
      h(
        "div.stat-tile",
        {},
        h("span.stat-tile-icon", {}, icons.checklist(16)),
        h("span.stat-tile-value", {}, computed(() => `${bestStreakDays()}d`)),
        h("span.stat-tile-label", {}, "Best streak"),
      ),
    ),
    h(
      "div.week-header",
      {},
      h("span", {}, "This week"),
      h("strong", {}, computed(() => `${weekTotalHours()}h total`)),
    ),
    h(
      "div.week-chart",
      {},
      ...WEEK_DAYS.map((day, i) =>
        h(
          "div.week-bar-col",
          {},
          h(
            "div.week-tooltip",
            {},
            h("strong", {}, day),
            computed(() => `Focus: ${(weekMinutes()[i]! / 60).toFixed(1)}h`),
          ),
          h("div.week-bar", {
            class: i === todayIndex ? "today" : "",
            ref: (el: HTMLElement) => {
              effect(() => {
                el.style.height = `${Math.max(3, (weekMinutes()[i]! / weekMaxMinutes()) * 100)}%`;
              });
            },
          }),
          h("span.week-bar-day", {}, day),
        ),
      ),
    ),
  );
}

function AmbientCard(ambientSound: Signal<string | null>): Node {
  return h(
    "div.side-card",
    {},
    h("div.side-card-header", {}, h("span.side-card-title", {}, "Ambient sound")),
    h(
      "div.stat-row",
      { style: { gridTemplateColumns: "repeat(2, 1fr)" } },
      ...AMBIENT_SOUNDS.map((s) =>
        h(
          "button.segmented-item",
          {
            style: { justifyContent: "flex-start", gap: "8px", display: "flex", alignItems: "center" },
            class: computed(() => (ambientSound() === s.id ? "active" : "")),
            onclick: () => ambientSound.set(ambientSound() === s.id ? null : s.id),
          },
          s.icon(14),
          s.label,
        ),
      ),
    ),
  );
}
