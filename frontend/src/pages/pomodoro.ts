import { h } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";

type Mode = "focus" | "short" | "long";

const DURATIONS: Record<Mode, number> = {
  focus: 20 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

function format(totalSeconds: number): { mm: string; ss: string } {
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return { mm, ss };
}

export function PomodoroPage(): Node {
  const mode = signal<Mode>("focus");
  const remaining = signal(DURATIONS.focus);
  const running = signal(false);
  const sessionsDone = signal(0);

  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    running.set(false);
    if (timer) clearInterval(timer);
    timer = null;
  };

  const tick = () => {
    const next = remaining() - 1;
    if (next <= 0) {
      remaining.set(0);
      stop();
      if (mode() === "focus") sessionsDone.update((n) => n + 1);
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
    if (e.code === "Space" && (e.target as HTMLElement)?.tagName !== "INPUT") {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === "r") {
      reset();
    }
  });

  const clock = computed(() => {
    const { mm, ss } = format(remaining());
    return `${mm}:${ss}`;
  });
  const elapsedPct = computed(() => {
    const total = DURATIONS[mode()];
    return `${Math.round(((total - remaining()) / total) * 100)}%`;
  });
  const status = computed(() => (running() ? "RUN" : remaining() === DURATIONS[mode()] ? "RDY" : "PAUSE"));

  const modes: Mode[] = ["focus", "short", "long"];

  return h(
    "div.pomodoro-shell",
    {},
    h("div.pomodoro-eyebrow", {}, icons.timer(14), "Pomodoro"),
    h("h1", { style: { fontSize: "1.75rem", fontWeight: "700" } }, computed(() => MODE_LABEL[mode()])),
    h(
      "div.pomodoro-tabs",
      {},
      ...modes.map((m) =>
        h(
          "button.pomodoro-tab",
          {
            class: computed(() => (mode() === m ? "active" : "")),
            onclick: () => switchMode(m),
          },
          MODE_LABEL[m],
        ),
      ),
    ),
    h(
      "div.pomodoro-watch",
      {},
      h("div.pomodoro-watch-label", {}, computed(() => `${status()} · MODE ${mode().slice(0, 3).toUpperCase()}`)),
      h("div.pomodoro-clock", {}, clock),
      h(
        "div.pomodoro-stats",
        {},
        h(
          "div.pomodoro-stat",
          {},
          h("div.pomodoro-stat-label", {}, "Sessions"),
          h("div.pomodoro-stat-value", {}, computed(() => `${sessionsDone()}/4`)),
        ),
        h(
          "div.pomodoro-stat",
          {},
          h("div.pomodoro-stat-label", {}, "Elapsed"),
          h("div.pomodoro-stat-value", {}, elapsedPct),
        ),
      ),
    ),
    h(
      "div.pomodoro-actions",
      {},
      h(
        "button.btn.btn-accent",
        { onclick: toggle },
        icons.play(16),
        computed(() => (running() ? "Pause" : "Start")),
      ),
      h("button.btn.btn-secondary", { onclick: reset }, icons.rotate(16), "Reset"),
    ),
    h(
      "p",
      { style: { color: "var(--color-text-muted)", fontSize: "0.875rem" } },
      computed(() => `${sessionsDone()} focus sessions today`),
    ),
    h(
      "div.pomodoro-hint",
      {},
      h("span", {}, h("kbd", {}, "Space"), "Toggle"),
      h("span", {}, h("kbd", {}, "R"), "Reset"),
    ),
  );
}
