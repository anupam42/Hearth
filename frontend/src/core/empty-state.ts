import { h, type Child } from "./dom.js";

export function EmptyState(icon: Node, title: string, desc: string, action?: Node): Node {
  const children: Child[] = [
    h("div.empty-state-icon", {}, icon),
    h("div.empty-state-title", {}, title),
    h("div.empty-state-desc", {}, desc),
  ];
  if (action) children.push(action);
  return h("div.empty-state", {}, ...children);
}
