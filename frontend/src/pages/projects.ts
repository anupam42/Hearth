import { h, list, when } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";
import { api, type Project } from "../api/client.js";

export function ProjectsPage(): Node {
  const projects = signal<Project[]>([]);
  const query = signal("");
  const showAllWorkspaces = signal(true);
  const showForm = signal(false);
  const newKey = signal("");
  const newName = signal("");

  const load = async () => {
    projects.set(await api.get<Project[]>("/projects"));
  };
  load();

  const createProject = async (e: Event) => {
    e.preventDefault();
    if (!newKey() || !newName()) return;
    await api.post<Project>("/projects", { key: newKey(), name: newName() });
    newKey.set("");
    newName.set("");
    showForm.set(false);
    await load();
  };

  const filtered = computed(() => {
    const q = query().trim().toLowerCase();
    if (!q) return projects();
    return projects().filter(
      (p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q),
    );
  });
  const hasProjects = computed(() => filtered().length > 0);

  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
      h(
        "div",
        {},
        h("h1.page-title", {}, icons.folder(24), "Projects"),
        h("p.page-subtitle", {}, "Manage your projects and track approvals"),
      ),
      h(
        "button.btn.btn-light",
        { onclick: () => showForm.set(!showForm()) },
        icons.plus(16),
        "Create Project",
      ),
    ),
    h(
      "div.row.gap-3",
      { style: { padding: "16px 24px 0", justifyContent: "space-between" } },
      h(
        "div.search-input",
        { style: { maxWidth: "360px", flex: "1" } },
        icons.search(16),
        h("input", {
          placeholder: "Search projects…",
          value: query(),
          oninput: (e: Event) => query.set((e.target as HTMLInputElement).value),
        }),
      ),
      h(
        "label.toggle",
        { onclick: () => showAllWorkspaces.set(!showAllWorkspaces()) },
        h("span", {}, "Showing all workspaces"),
        h("span.toggle-switch", { class: computed(() => (showAllWorkspaces() ? "on" : "")) }),
      ),
    ),
    when(showForm, () =>
      h(
        "form.card.stack.gap-3",
        { style: { margin: "16px 24px", padding: "16px" }, onsubmit: createProject },
        h(
          "div.row.gap-3",
          {},
          h(
            "div.field",
            { style: { width: "120px" } },
            h("label", {}, "Key"),
            h("input.input", {
              placeholder: "DEVOP",
              value: newKey(),
              oninput: (e: Event) => newKey.set((e.target as HTMLInputElement).value.toUpperCase()),
            }),
          ),
          h(
            "div.field.grow",
            {},
            h("label", {}, "Name"),
            h("input.input", {
              placeholder: "DevOps Platform",
              value: newName(),
              oninput: (e: Event) => newName.set((e.target as HTMLInputElement).value),
            }),
          ),
        ),
        h("button.btn.btn-primary", { type: "submit", style: { alignSelf: "flex-start" } }, "Create"),
      ),
    ),
    h(
      "div",
      { style: { padding: "16px 24px" } },
      when(
        hasProjects,
        () =>
          h(
            "div.project-grid",
            {},
            list(filtered, (project) =>
              h(
                "a.project-tile.card",
                { href: `/projects/${project.id}` },
                h("span.project-tile-key", {}, project.key),
                h("h3", {}, project.name),
                project.description
                  ? h(
                      "p",
                      { style: { fontSize: "0.875rem", color: "var(--color-text-muted)" } },
                      project.description,
                    )
                  : null,
              ),
            ),
          ),
        () =>
          EmptyState(
            icons.folder(24),
            "No projects yet",
            "Create your first project to get started",
            h(
              "button.btn.btn-light",
              { onclick: () => showForm.set(true) },
              icons.plus(16),
              "Create Project",
            ),
          ),
      ),
    ),
  );
}
