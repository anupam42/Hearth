import { h } from "./dom.js";

// Negative delays start each piece mid-flight immediately on mount, instead of making it
// wait invisibly — otherwise short-lived mounts (like the loading screen) can disappear
// before a piece's positive delay ever elapses.
const CONFETTI_PIECES = [
  { angle: 0, delay: -0.1, color: "var(--brand-teal-light)" },
  { angle: 60, delay: -0.45, color: "var(--brand-cream)" },
  { angle: 120, delay: -0.8, color: "var(--brand-umber)" },
  { angle: 180, delay: -1.15, color: "var(--brand-teal-deep)" },
  { angle: 240, delay: -1.5, color: "var(--brand-taupe)" },
  { angle: 300, delay: -1.85, color: "var(--brand-teal-light)" },
];

/** A ring of looping confetti ribbons — drop into a `position: relative` wrapper around a mascot icon. */
export function ConfettiBurst(opts?: { large?: boolean }): Node[] {
  const large = opts?.large ?? false;
  return CONFETTI_PIECES.map((p) =>
    h(`span.confetti-piece${large ? ".confetti-piece-lg" : ""}`, {
      ref: (el: HTMLElement) => {
        el.style.setProperty("--piece-angle", `${p.angle}deg`);
        el.style.setProperty("--piece-delay", `${p.delay}s`);
        el.style.setProperty("--piece-color", p.color);
        el.style.setProperty("--piece-dist", large ? "52px" : "28px");
      },
    }),
  );
}
