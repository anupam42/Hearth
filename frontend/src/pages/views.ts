import { h } from "../core/dom.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";

export function ViewsPage(): Node {
  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      {},
      h(
        "a.row.gap-2",
        { href: "/views", style: { color: "var(--color-accent)", fontSize: "0.875rem", fontWeight: "600" } },
        icons.chevronLeft(14),
        "Views",
      ),
      h("h1.page-title", { style: { marginTop: "8px" } }, icons.eye(24), "Views"),
      h("p.page-subtitle", {}, "Saved filter combinations across every project you belong to."),
    ),
    h(
      "div",
      { style: { padding: "24px" } },
      EmptyState(
        icons.eye(24),
        "No views yet",
        "Open any project, apply some filters, and click Save view to create a reusable view.",
      ),
    ),
  );
}
