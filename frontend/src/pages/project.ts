import { h, list, when } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
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
  const showForm = signal(false);
  const newTitle = signal("");

  const load = async () => {
    const [p, t] = await Promise.all([
      api.get<Project>(`/projects/${projectId}`),
      api.get<Task[]>(`/projects/${projectId}/tasks`),
    ]);
    project.set(p);
    tasks.set(t);
  };
  load();

  const createTask = async (e: Event) => {
    e.preventDefault();
    if (!newTitle()) return;
    await api.post<Task>(`/projects/${projectId}/tasks`, { title: newTitle() });
    newTitle.set("");
    showForm.set(false);
    await load();
  };

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
        { onclick: () => showForm.set(!showForm()) },
        "New task",
      ),
    ),
    when(showForm, () =>
      h(
        "form.card.row.gap-3",
        { style: { margin: "16px 24px", padding: "16px" }, onsubmit: createTask },
        h("input.input.grow", {
          placeholder: "Task title",
          value: newTitle(),
          oninput: (e: Event) => newTitle.set((e.target as HTMLInputElement).value),
        }),
        h("button.btn.btn-primary", { type: "submit" }, "Add"),
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
