import { h, list, when } from "../core/dom.js";
import { computed, signal, type Signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";
import { Drawer } from "../core/drawer.js";
import type { User } from "../api/client.js";

interface LocalToken {
  id: string;
  name: string;
  permission: string;
  expiry: string;
}

export function SettingsPage(currentUser: Signal<User | null>): Node {
  const tokens = signal<LocalToken[]>([]);
  const name = signal("");
  const permission = signal("Read & write");
  const expiry = signal("");
  const hasTokens = computed(() => tokens().length > 0);

  const createToken = (e: Event, close: () => void) => {
    e.preventDefault();
    if (!name().trim()) return;
    tokens.update((cur) => [
      ...cur,
      { id: crypto.randomUUID(), name: name(), permission: permission(), expiry: expiry() },
    ]);
    name.set("");
    expiry.set("");
    close();
  };

  const drawer = Drawer("New Personal Access Token", (close) =>
    h(
      "form.stack.gap-4",
      { onsubmit: (e: Event) => createToken(e, close) },
      h(
        "p",
        { style: { color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "0" } },
        "Tokens authenticate API requests. Choose Read only to restrict a token to safe methods (GET), or Read & write for full access. Scope can be changed anytime.",
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Name"),
        h("input.input", {
          placeholder: "e.g. CI/CD pipeline",
          value: name(),
          oninput: (e: Event) => name.set((e.target as HTMLInputElement).value),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Permissions"),
        h(
          "select.input",
          { onchange: (e: Event) => permission.set((e.target as HTMLSelectElement).value) },
          h("option", { value: "Read only" }, "Read only"),
          h("option", { value: "Read & write", selected: true }, "Read & write"),
        ),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Expiry (optional)"),
        h("input.input", {
          type: "date",
          value: expiry(),
          oninput: (e: Event) => expiry.set((e.target as HTMLInputElement).value),
        }),
      ),
      h(
        "div.drawer-footer",
        { style: { padding: "0", borderTop: "none", marginTop: "8px" } },
        h("button.btn.btn-secondary", { type: "button", onclick: close }, "Cancel"),
        h("button.btn.btn-primary", { type: "submit" }, "Create Token"),
      ),
    ),
  );

  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      {},
      h("h1.page-title", {}, icons.settings(24), "Settings"),
      h("p.page-subtitle", {}, "Manage your account settings"),
    ),
    h(
      "div.stack.gap-3",
      { style: { padding: "24px" } },
      h(
        "div.section-header",
        {},
        h("div.section-title", {}, icons.key(18), "Personal Access Tokens"),
        h(
          "button.btn.btn-light",
          { onclick: () => drawer.open() },
          icons.plus(16),
          "Create Token",
        ),
      ),
      h(
        "p",
        { style: { color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "-8px" } },
        "Tokens authenticate API requests. Choose Read only to restrict a token to safe methods (GET), or Read & write for full access. Scope can be changed anytime.",
      ),
      when(
        hasTokens,
        () =>
          h(
            "div.card.stack",
            { style: { padding: "8px" } },
            list(tokens, (token) =>
              h(
                "div.row.gap-3",
                {
                  style: {
                    justifyContent: "space-between",
                    padding: "12px",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  },
                },
                h(
                  "div.row.gap-3",
                  {},
                  icons.key(16),
                  h(
                    "div",
                    {},
                    h("div", { style: { fontWeight: "600" } }, token.name),
                    h(
                      "div",
                      { style: { fontSize: "0.75rem", color: "var(--color-text-muted)" } },
                      token.expiry ? `Expires ${token.expiry}` : "No expiry",
                    ),
                  ),
                ),
                h("span.badge", { style: { color: "var(--color-text-muted)", background: "var(--color-bg)" } }, token.permission),
              ),
            ),
          ),
        () =>
          h(
            "div.card",
            { style: { padding: "8px" } },
            EmptyState(icons.key(24), "No tokens yet", "Create a token above to get started"),
          ),
      ),
    ),
  );
}
