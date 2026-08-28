import { h, list, when } from "../core/dom.js";
import { computed, signal, type Signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";
import { Drawer } from "../core/drawer.js";
import { toast, toastPosition, setToastPosition, type ToastPosition } from "../core/toast.js";
import { api, type AccessToken, type CreateAccessTokenResponse, type User } from "../api/client.js";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function permissionLabel(permission: string): string {
  return permission === "read" ? "Read only" : "Read & write";
}

export function SettingsPage(currentUser: Signal<User | null>): Node {
  const tokens = signal<AccessToken[]>([]);
  const hasTokens = computed(() => tokens().length > 0);
  const loadError = signal("");

  const name = signal("");
  const permission = signal<"read" | "read_write">("read_write");
  const expiry = signal("");
  const createdToken = signal<CreateAccessTokenResponse | null>(null);
  const createError = signal("");
  const copied = signal(false);

  const load = async () => {
    try {
      tokens.set(await api.get<AccessToken[]>("/tokens"));
    } catch {
      loadError.set("Couldn't load tokens.");
    }
  };
  load();

  const resetForm = () => {
    name.set("");
    permission.set("read_write");
    expiry.set("");
    createdToken.set(null);
    createError.set("");
    copied.set(false);
  };

  const createToken = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) return;
    createError.set("");
    try {
      const token = await api.post<CreateAccessTokenResponse>("/tokens", {
        name: name(),
        permission: permission(),
        expires_at: expiry() ? `${expiry()}T00:00:00Z` : undefined,
      });
      createdToken.set(token);
      await load();
      toast.success("Token created", { message: `"${token.name}" is ready to use.` });
    } catch {
      createError.set("Couldn't create token. Try a different name.");
      toast.error("Couldn't create token");
    }
  };

  const copySecret = async () => {
    const token = createdToken();
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.secret);
      copied.set(true);
      setTimeout(() => copied.set(false), 1500);
    } catch {
      // clipboard API unavailable — the secret is still visible to select/copy manually
    }
  };

  const revokeToken = async (token: AccessToken) => {
    if (!confirm(`Revoke "${token.name}"? Anything using this token will stop working immediately.`)) return;
    await api.delete(`/tokens/${token.id}`);
    await load();
    toast.info("Token revoked", { message: `"${token.name}" can no longer be used.` });
  };

  const drawer = Drawer("New Personal Access Token", (close) =>
    h(
      "div.stack.gap-4",
      {},
      when(
        createdToken,
        () =>
          h(
            "div.stack.gap-4",
            {},
            h(
              "p",
              { style: { color: "var(--color-text-muted)", fontSize: "0.875rem" } },
              "Copy this token now — you won't be able to see it again.",
            ),
            h(
              "div.token-secret-box",
              {},
              h("code", {}, computed(() => createdToken()?.secret ?? "")),
              h(
                "button.token-copy-btn",
                { class: computed(() => (copied() ? "copied" : "")), type: "button", onclick: copySecret, title: "Copy" },
                when(copied, () => icons.check(16), () => icons.copy(16)),
              ),
            ),
            h(
              "div.drawer-footer",
              { style: { padding: "0", borderTop: "none", marginTop: "8px" } },
              h(
                "button.btn.btn-primary",
                {
                  type: "button",
                  onclick: () => {
                    resetForm();
                    close();
                  },
                },
                "Done",
              ),
            ),
          ),
        () =>
          h(
            "form.stack.gap-4",
            { onsubmit: createToken },
            h(
              "p",
              { style: { color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "0" } },
              "Tokens authenticate API requests. Choose Read only to restrict a token to safe methods (GET), or Read & write for full access.",
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
                { onchange: (e: Event) => permission.set((e.target as HTMLSelectElement).value as "read" | "read_write") },
                h("option", { value: "read_write", selected: true }, "Read & write"),
                h("option", { value: "read" }, "Read only"),
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
            when(computed(() => createError().length > 0), () => h("div.error-banner", {}, createError)),
            h(
              "div.drawer-footer",
              { style: { padding: "0", borderTop: "none", marginTop: "8px" } },
              h(
                "button.btn.btn-secondary",
                {
                  type: "button",
                  onclick: () => {
                    resetForm();
                    close();
                  },
                },
                "Cancel",
              ),
              h("button.btn.btn-primary", { type: "submit" }, "Create Token"),
            ),
          ),
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
      "div.stack.gap-6",
      { style: { padding: "24px" } },
      h(
        "div.stack.gap-3",
        {},
        h("div.section-title", {}, icons.bell(18), "Notifications"),
        h(
          "p",
          { style: { color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "-8px" } },
          "Choose where toast notifications appear on screen.",
        ),
        h(
          "div.card",
          { style: { padding: "20px" } },
          h(
            "div.row.gap-4",
            { style: { alignItems: "flex-start", flexWrap: "wrap" } },
            PositionPicker(),
            h(
              "button.btn.btn-secondary",
              {
                onclick: () =>
                  toast.info("This is a preview", {
                    message: "Notifications will show up right here from now on.",
                  }),
              },
              icons.bell(16),
              "Send test notification",
            ),
          ),
        ),
      ),
      h(
        "div.section-header",
        {},
        h("div.section-title", {}, icons.key(18), "Personal Access Tokens"),
        h(
          "button.btn.btn-light",
          {
            onclick: () => {
              resetForm();
              drawer.open();
            },
          },
          icons.plus(16),
          "Create Token",
        ),
      ),
      h(
        "p",
        { style: { color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "-8px" } },
        "Tokens authenticate API requests. Choose Read only to restrict a token to safe methods (GET), or Read & write for full access. Scope can't be changed after creation — revoke and create a new one instead.",
      ),
      when(computed(() => loadError().length > 0), () => h("div.error-banner", {}, loadError)),
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
                      token.expires_at ? `Expires ${formatDate(token.expires_at)}` : "No expiry",
                      token.last_used_at ? ` · Last used ${formatDate(token.last_used_at)}` : " · Never used",
                    ),
                  ),
                ),
                h(
                  "div.row.gap-3",
                  {},
                  h(
                    "span.badge",
                    { style: { color: "var(--color-text-muted)", background: "var(--color-bg)" } },
                    permissionLabel(token.permission),
                  ),
                  h("button.btn.btn-danger", { onclick: () => revokeToken(token) }, "Revoke"),
                ),
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

const POSITIONS: { value: ToastPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

function PositionPicker(): Node {
  return h(
    "div.position-picker",
    {},
    h(
      "div.position-picker-screen",
      {},
      ...POSITIONS.map((p) =>
        h(`button.position-picker-dot.position-picker-${p.value}`, {
          class: computed(() => (toastPosition() === p.value ? "active" : "")),
          title: p.label,
          type: "button",
          onclick: () => setToastPosition(p.value),
        }),
      ),
    ),
    h("span.position-picker-label", {}, computed(() => POSITIONS.find((p) => p.value === toastPosition())?.label ?? "")),
  );
}
