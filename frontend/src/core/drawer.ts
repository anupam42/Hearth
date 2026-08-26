import { h } from "./dom.js";
import { effect, signal } from "./reactive.js";
import { icons } from "./icons.js";

export interface DrawerHandle {
  open: () => void;
  close: () => void;
}

/**
 * A right-side sliding panel, mounted once to <body> and reused for every open/close.
 * `content` is built once; call `open()` to slide it in, `close()` (or Escape / backdrop click) to slide out.
 */
export function Drawer(title: string, content: (close: () => void) => Node, opts?: { width?: string }): DrawerHandle {
  const isOpen = signal(false);
  const close = () => isOpen.set(false);
  const open = () => isOpen.set(true);

  const root = h(
    "div.drawer-root",
    {},
    h("div.drawer-backdrop", { onclick: close }),
    h(
      "div.drawer-panel",
      { style: { width: opts?.width ?? "440px" } },
      h(
        "div.drawer-header",
        {},
        h("h2", {}, title),
        h("button.drawer-close", { onclick: close, "aria-label": "Close" }, icons.x(18)),
      ),
      h("div.drawer-body", {}, content(close)),
    ),
  );

  effect(() => {
    root.classList.toggle("open", isOpen());
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  document.body.appendChild(root);

  return { open, close };
}
