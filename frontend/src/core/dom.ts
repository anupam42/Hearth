import { effect, type Signal } from "./reactive.js";

export type Child = string | number | Node | Signal<unknown> | null | undefined | Child[];

export type Props = {
  [key: string]: unknown;
} & {
  class?: string | Signal<string>;
  style?: Partial<CSSStyleDeclaration>;
  ref?: (el: HTMLElement) => void;
};

function isSignal(value: unknown): value is Signal<unknown> {
  return typeof value === "function" && "set" in (value as object);
}

function appendChild(parent: Node, child: Child): void {
  if (child === null || child === undefined) return;

  if (Array.isArray(child)) {
    for (const c of child) appendChild(parent, c);
    return;
  }

  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }

  if (isSignal(child)) {
    const textNode = document.createTextNode("");
    effect(() => {
      textNode.data = String(child());
    });
    parent.appendChild(textNode);
    return;
  }

  parent.appendChild(document.createTextNode(String(child)));
}

/** Hyperscript-style element factory: h("button.primary", { onclick: fn }, "Save") */
export function h(tag: string, props: Props = {}, ...children: Child[]): HTMLElement {
  const [tagName, ...classNames] = tag.split(".");
  const el = document.createElement(tagName || "div");
  if (classNames.length > 0) el.classList.add(...classNames);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;

    if (key === "class") {
      const baseClasses = [...classNames];
      if (isSignal(value)) {
        effect(() => {
          el.className = [...baseClasses, ...String(value()).split(" ").filter(Boolean)].join(" ");
        });
      } else {
        el.classList.add(...String(value).split(" ").filter(Boolean));
      }
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else if (key === "ref" && typeof value === "function") {
      (value as (el: HTMLElement) => void)(el);
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (isSignal(value)) {
      effect(() => {
        setAttr(el, key, value());
      });
    } else {
      setAttr(el, key, value);
    }
  }

  for (const child of children) appendChild(el, child);
  return el;
}

function setAttr(el: HTMLElement, key: string, value: unknown): void {
  if (typeof value === "boolean") {
    if (value) el.setAttribute(key, "");
    else el.removeAttribute(key);
  } else {
    el.setAttribute(key, String(value));
  }
}

export function mount(root: HTMLElement, node: Node): void {
  root.replaceChildren(node);
}

/** Naive reactive list: clears and re-renders all items whenever the source signal changes. */
export function list<T>(source: Signal<T[]>, render: (item: T, index: number) => Node): Node {
  const container = document.createElement("div");
  container.style.display = "contents";
  effect(() => {
    const items = source();
    container.replaceChildren(...items.map((item, i) => render(item, i)));
  });
  return container;
}

/** Renders one of two branches depending on a boolean/condition signal. */
export function when(source: Signal<unknown>, whenTrue: () => Node, whenFalse?: () => Node): Node {
  const container = document.createElement("div");
  container.style.display = "contents";
  effect(() => {
    const next = source() ? whenTrue() : whenFalse ? whenFalse() : document.createComment("empty");
    container.replaceChildren(next);
  });
  return container;
}
