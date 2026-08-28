import { h, when } from "./dom.js";
import { signal } from "./reactive.js";

/** A `.dropdown` container that opens `menu` on trigger click and closes on outside click. */
export function Dropdown(
  trigger: (toggle: () => void, open: () => boolean) => Node,
  menu: (close: () => void) => Node,
): Node {
  const open = signal(false);
  const toggle = () => open.set(!open());
  const close = () => open.set(false);

  const container = h(
    "div.dropdown",
    {},
    trigger(toggle, open),
    when(open, () => menu(close)),
  );

  document.addEventListener("click", (e) => {
    if (!open()) return;
    if (!container.contains(e.target as Node)) close();
  });

  return container;
}
