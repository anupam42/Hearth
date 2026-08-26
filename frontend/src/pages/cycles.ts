import { h } from "../core/dom.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";

export function CyclesPage(): Node {
  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      {},
      h(
        "a.row.gap-2",
        { href: "/cycles", style: { color: "var(--color-accent)", fontSize: "0.875rem", fontWeight: "600" } },
        icons.chevronLeft(14),
        "Active Cycles",
      ),
      h("h1.page-title", { style: { marginTop: "8px" } }, icons.repeat(24), "Active Cycles"),
      h("p.page-subtitle", {}, "Every cycle currently running across projects you belong to."),
    ),
    h(
      "div",
      { style: { padding: "24px" } },
      EmptyState(
        icons.repeat(24),
        "No active cycles",
        "Open a project and create a cycle that covers today's date to see it surface here.",
      ),
    ),
  );
}
