import { h } from "../core/dom.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";

export function ModulesPage(): Node {
  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      {},
      h(
        "a.row.gap-2",
        {
          href: "/modules",
          style: { color: "var(--color-accent)", fontSize: "0.875rem", fontWeight: "600" },
        },
        icons.chevronLeft(14),
        "Active Modules",
      ),
      h("h1.page-title", { style: { marginTop: "8px" } }, icons.layers(24), "Active Modules"),
      h("p.page-subtitle", {}, "Every module currently in progress across projects you belong to."),
    ),
    h(
      "div",
      { style: { padding: "24px" } },
      EmptyState(
        icons.layers(24),
        "No active modules",
        "Open a project and flip a module's status to in progress to see it surface here.",
      ),
    ),
  );
}
