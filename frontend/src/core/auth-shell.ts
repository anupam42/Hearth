import { h, when, type Child } from "./dom.js";
import { computed, signal } from "./reactive.js";
import { icons } from "./icons.js";

const TAGLINES = [
  "Calm, focused work — track projects, run your pomodoro, and keep an honest audit trail.",
  "One hearth for every project — tasks, cycles, and modules, all in one place.",
  "Slow down, focus up. Built for teams who like their tools quiet and their work loud.",
];

export function AuthShell(title: string, subtitle: Node, formContent: Node): Node {
  const active = signal(0);
  setInterval(() => active.update((i) => (i + 1) % TAGLINES.length), 4500);

  return h(
    "div.auth-page",
    {},
    h(
      "div.auth-split",
      {},
      h(
        "div.auth-illustration",
        {},
        h("img.auth-mascot", { src: "/icon.svg", alt: "Hearth" }),
        h(
          "div.auth-caption-card",
          {},
          h("span.auth-caption-icon", {}, icons.lightbulb(14)),
          h(
            "p",
            {},
            computed(() => TAGLINES[active()]!),
          ),
        ),
        h(
          "div.auth-dots",
          {},
          ...TAGLINES.map((_, i) =>
            h("span.auth-dot", { class: computed(() => (active() === i ? "active" : "")) }),
          ),
        ),
      ),
      h("div.auth-form-panel", {}, h("h1", {}, title), subtitle, formContent),
    ),
  );
}

/** A password `<input>` with a show/hide toggle button. */
export function PasswordField(
  value: () => string,
  onInput: (v: string) => void,
  opts?: { minlength?: number },
): Node {
  const visible = signal(false);
  return h(
    "div.password-input",
    {},
    h("input.input", {
      type: computed(() => (visible() ? "text" : "password")),
      required: true,
      minlength: opts?.minlength,
      value: value(),
      oninput: (e: Event) => onInput((e.target as HTMLInputElement).value),
    }),
    h(
      "button.password-toggle",
      { type: "button", onclick: () => visible.set(!visible()), "aria-label": "Toggle password visibility" },
      when(
        visible,
        () => icons.eyeOff(18),
        () => icons.eye(18),
      ),
    ),
  );
}

export function AuthSwitchLink(text: string, linkText: string, href: string): Node {
  const children: Child[] = [text, " ", h("a", { href }, linkText)];
  return h("p.auth-switch", {}, ...children);
}
