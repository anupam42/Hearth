import { h, list, when } from "../core/dom.js";
import { signal } from "../core/reactive.js";
import { api, type Project } from "../api/client.js";

export function DashboardPage(): Node {
  const projects = signal<Project[]>([]);
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

  return h(
    "div.page",
    {},
    h(
      "div.row.gap-3",
      { style: { padding: "24px 24px 0", justifyContent: "space-between" } },
      h("h1", {}, "Projects"),
      h(
        "button.btn.btn-primary",
        { onclick: () => showForm.set(!showForm()) },
        "New project",
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
      "div.project-grid",
      {},
      list(projects, (project) =>
        h(
          "a.project-tile.card",
          { href: `/projects/${project.id}` },
          h("span.project-tile-key", {}, project.key),
          h("h3", {}, project.name),
          project.description
            ? h("p", { style: { fontSize: "0.875rem", color: "var(--color-text-muted)" } }, project.description)
            : null,
        ),
      ),
    ),
  );
}
