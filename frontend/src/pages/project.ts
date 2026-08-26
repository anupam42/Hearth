import { h, list } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { Drawer } from "../core/drawer.js";
import { icons } from "../core/icons.js";
import { api, type Project, type Task } from "../api/client.js";

const COLUMNS = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
] as const;

export function ProjectPage(params: Record<string, string>): Node {
  const projectId = params.id!;
  const project = signal<Project | null>(null);
  const tasks = signal<Task[]>([]);
  const newTitle = signal("");
  const newDescription = signal("");
  const newPriority = signal("medium");

  const load = async () => {
    const [p, t] = await Promise.all([
      api.get<Project>(`/projects/${projectId}`),
      api.get<Task[]>(`/projects/${projectId}/tasks`),
    ]);
    project.set(p);
    tasks.set(t);
  };
  load();

  const createTask = async (e: Event, close: () => void) => {
    e.preventDefault();
    if (!newTitle()) return;
    await api.post<Task>(`/projects/${projectId}/tasks`, {
      title: newTitle(),
      description: newDescription() || undefined,
      priority: newPriority(),
    });
    newTitle.set("");
    newDescription.set("");
    newPriority.set("medium");
    close();
    await load();
  };

  const drawer = Drawer("New Task", (close) =>
    h(
      "form.stack.gap-4",
      { onsubmit: (e: Event) => createTask(e, close) },
      h(
        "div.field",
        {},
        h("label", {}, "Title"),
        h("input.input", {
          placeholder: "Task title",
          value: newTitle(),
          oninput: (e: Event) => newTitle.set((e.target as HTMLInputElement).value),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Description (optional)"),
        h("textarea.input", {
          rows: 4,
          value: newDescription(),
          oninput: (e: Event) => newDescription.set((e.target as HTMLTextAreaElement).value),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Priority"),
        h(
          "select.input",
          { onchange: (e: Event) => newPriority.set((e.target as HTMLSelectElement).value) },
          h("option", { value: "low" }, "Low"),
          h("option", { value: "medium", selected: true }, "Medium"),
          h("option", { value: "high" }, "High"),
          h("option", { value: "urgent" }, "Urgent"),
        ),
      ),
      h(
        "div.drawer-footer",
        { style: { padding: "0", borderTop: "none", marginTop: "8px" } },
        h("button.btn.btn-secondary", { type: "button", onclick: close }, "Cancel"),
        h("button.btn.btn-primary", { type: "submit" }, "Create Task"),
      ),
    ),
  );

  const moveTask = async (task: Task, status: string) => {
    await api.patch<Task>(`/projects/${projectId}/tasks/${task.id}`, { status });
    await load();
  };

  const projectName = computed(() => project()?.name ?? "");
  const projectKey = computed(() => project()?.key ?? "");
  const columnTasks = Object.fromEntries(
    COLUMNS.map((col) => [col.status, computed(() => tasks().filter((t) => t.status === col.status))]),
  ) as Record<string, ReturnType<typeof computed<Task[]>>>;

  return h(
    "div.page",
    {},
    h(
      "div.row.gap-3",
      { style: { padding: "24px 24px 0", justifyContent: "space-between" } },
      h(
        "div.stack",
        {},
        h("h1", {}, projectName),
        h(
          "span",
          { style: { color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" } },
          projectKey,
        ),
      ),
      h(
        "button.btn.btn-primary",
        { onclick: () => drawer.open() },
        icons.plus(16),
        "New task",
      ),
    ),
    h(
      "div.board",
      {},
      ...COLUMNS.map((col) =>
        h(
          "div.board-column",
          {},
          h(
            "div.board-column-header",
            {},
            h("span", {}, col.label),
            h("span", {}, computed(() => String(columnTasks[col.status]!().length))),
          ),
          list(columnTasks[col.status]!, (task) =>
            h(
              "div.task-card.card",
              {},
              h("span.task-card-id", {}, task.display_id),
              h("div.task-card-title", {}, task.title),
              h(
                "div.task-card-footer",
                {},
                h(`span.badge.badge-priority-${task.priority}`, {}, task.priority),
                h(
                  "select.input",
                  {
                    style: { fontSize: "0.75rem", padding: "2px 6px" },
                    onchange: (e: Event) => moveTask(task, (e.target as HTMLSelectElement).value),
                  },
                  ...COLUMNS.map((c) =>
                    h(
                      "option",
                      { value: c.status, selected: c.status === task.status },
                      c.label,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
