import { h, list, when } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { navigate } from "../core/router.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";
import { api, type Project, type User } from "../api/client.js";

export function DashboardPage(): Node {
  const projects = signal<Project[]>([]);
  const query = signal("");
  const showAllWorkspaces = signal(true);
  const user = signal<User | null>(null);

  const load = async () => {
    projects.set(await api.get<Project[]>("/projects"));
  };
  load();
  api
    .get<User>("/auth/me")
    .then((u) => user.set(u))
    .catch(() => undefined);

  const filtered = computed(() => {
    const q = query().trim().toLowerCase();
    if (!q) return projects();
    return projects().filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q));
  });
  const hasProjects = computed(() => filtered().length > 0);
  const firstName = computed(() => (user()?.display_name ?? "").split(" ")[0] ?? "");

  return h(
    "div.page",
    {},
    h(
      "div.page-header",
      {},
      h(
        "h1",
        { style: { fontSize: "1.75rem" } },
        computed(() => `Welcome back, ${firstName()}!`),
      ),
      h("p.page-subtitle", {}, "Here's an overview of your projects and tasks"),
    ),
    h(
      "div",
      { style: { padding: "16px 24px 0" } },
      h(
        "div.tip-banner",
        {},
        icons.lightbulb(18),
        h(
          "span",
          {},
          h("strong", {}, "Tip: "),
          "Log in with your SSO provider to sync your profile picture across Hearth.",
        ),
      ),
    ),
    h(
      "div",
      { style: { padding: "24px" } },
      h(
        "div.section-header",
        {},
        h("div.section-title", {}, icons.checklist(16), "Assigned to You"),
        h(
          "div.row.gap-3",
          {},
          h(
            "label.toggle",
            { onclick: () => showAllWorkspaces.set(!showAllWorkspaces()) },
            h("span", {}, "Showing all workspaces"),
            h("span.toggle-switch", { class: computed(() => (showAllWorkspaces() ? "on" : "")) }),
          ),
          h(
            "button.btn.btn-secondary",
            { onclick: () => navigate("/projects") },
            icons.plus(16),
            "Create Task",
          ),
        ),
      ),
      h(
        "div.empty-state",
        { style: { padding: "24px" } },
        h(
          "span",
          { style: { color: "var(--color-text-muted)", fontSize: "0.875rem" } },
          "No tasks assigned to you",
        ),
      ),
    ),
    h(
      "div",
      { style: { padding: "0 24px 24px" } },
      h(
        "div.section-header",
        {},
        h("div.section-title", {}, "Your Projects"),
        h(
          "div.row.gap-3",
          {},
          h(
            "div.search-input",
            { style: { width: "220px" } },
            icons.search(14),
            h("input", {
              placeholder: "Search projects…",
              value: query(),
              oninput: (e: Event) => query.set((e.target as HTMLInputElement).value),
            }),
          ),
          h("a.btn.btn-secondary", { href: "/projects" }, "View all"),
        ),
      ),
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
              { onclick: () => navigate("/projects") },
              icons.plus(16),
              "Create Project",
            ),
          ),
      ),
    ),
  );
}
