import { h } from "./dom.js";
import { ConfettiBurst } from "./confetti.js";

/** Full-screen branded loading state — mascot with a soft pulse + bouncing dots. */
export function LoadingScreen(label = "Loading Hearth…"): Node {
  return h(
    "div.loading-screen",
    {},
    h(
      "div.loading-mascot-wrap",
      {},
      h("div.loading-glow", {}),
      ...ConfettiBurst({ large: true }),
      h("img.loading-mascot", { src: "/icon.svg", alt: "" }),
    ),
    h(
      "div.loading-dots",
      {},
      h("span.loading-dot", {}),
      h("span.loading-dot", {}),
      h("span.loading-dot", {}),
    ),
    label ? h("p.loading-label", {}, label) : null,
  );
}

/** Small inline spinner for buttons/inline loading states. */
export function Spinner(size = 16): Node {
  return h("span.spinner", { style: { width: `${size}px`, height: `${size}px` } });
}
