import { h, list, when } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";
import { Drawer } from "../core/drawer.js";
import { toast } from "../core/toast.js";
import { api, ApiError, type Workspace } from "../api/client.js";

export function WorkspacesPage(): Node {
  const workspaces = signal<Workspace[]>([]);
  const newKey = signal("");
  const newName = signal("");
  const newDescription = signal("");
  const hasWorkspaces = computed(() => workspaces().length > 0);

  const load = async () => {
    workspaces.set(await api.get<Workspace[]>("/workspaces"));
  };
  load();

  const createWorkspace = async (e: Event, close: () => void) => {
    e.preventDefault();
    if (!newKey() || !newName()) return;
    try {
      const workspace = await api.post<Workspace>("/workspaces", {
        key: newKey(),
        name: newName(),
        description: newDescription() || undefined,
      });
      newKey.set("");
      newName.set("");
      newDescription.set("");
      close();
      await load();
      toast.success("Workspace created", { message: `${workspace.key} — ${workspace.name}` });
    } catch (err) {
      toast.error("Couldn't create workspace", {
        message: err instanceof ApiError ? err.message : "Something went wrong.",
      });
    }
  };

  const drawer = Drawer("New Workspace", (close) =>
    h(
      "form.stack.gap-4",
      { onsubmit: (e: Event) => createWorkspace(e, close) },
      h(
        "div.field",
        {},
        h("label", {}, "Key"),
        h("input.input", {
          placeholder: "ACME",
          value: newKey(),
          oninput: (e: Event) => newKey.set((e.target as HTMLInputElement).value.toUpperCase()),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Name"),
        h("input.input", {
          placeholder: "Acme Corp",
          value: newName(),
          oninput: (e: Event) => newName.set((e.target as HTMLInputElement).value),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Description (optional)"),
        h("textarea.input", {
          rows: 3,
          value: newDescription(),
          oninput: (e: Event) => newDescription.set((e.target as HTMLTextAreaElement).value),
        }),
      ),
      h(
        "div.drawer-footer",
        { style: { padding: "0", borderTop: "none", marginTop: "8px" } },
        h("button.btn.btn-secondary", { type: "button", onclick: close }, "Cancel"),
        h("button.btn.btn-primary", { type: "submit" }, "Create Workspace"),
      ),
    ),
  );

  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
      h(
        "div",
        {},
        h("h1.page-title", {}, icons.building(24), "Workspaces"),
        h("p.page-subtitle", {}, "Admin-only. Organize projects into separate workspaces."),
      ),
      h(
        "button.btn.btn-light",
        { onclick: () => drawer.open() },
        icons.plus(16),
        "Create Workspace",
      ),
    ),
    h(
      "div",
      { style: { padding: "16px 24px" } },
      when(
        hasWorkspaces,
        () =>
          h(
            "div.project-grid",
            {},
            list(workspaces, (ws) =>
              h(
                "div.project-tile.card",
                {},
                h("span.project-tile-key", {}, ws.key),
                h("h3", {}, ws.name),
                ws.description
                  ? h(
                      "p",
                      { style: { fontSize: "0.875rem", color: "var(--color-text-muted)" } },
                      ws.description,
                    )
                  : null,
              ),
            ),
          ),
        () =>
          EmptyState(
            icons.building(24),
            "No workspaces yet",
            "Create your first workspace to start organizing projects",
            h(
              "button.btn.btn-light",
              { onclick: () => drawer.open() },
              icons.plus(16),
              "Create Workspace",
            ),
          ),
      ),
    ),
  );
}
