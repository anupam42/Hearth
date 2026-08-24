import { h, when } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { installLinkInterceptor, navigate, router } from "../core/router.js";
import { api, type User } from "../api/client.js";
import { LoginPage } from "./login.js";
import { RegisterPage } from "./register.js";
import { DashboardPage } from "./dashboard.js";
import { ProjectPage } from "./project.js";

export function App(): Node {
  const currentUser = signal<User | null>(null);
  const authChecked = signal(false);

  installLinkInterceptor();

  api
    .get<User>("/auth/me")
    .then((u) => currentUser.set(u))
    .catch(() => currentUser.set(null))
    .finally(() => authChecked.set(true));

  const logout = async () => {
    await api.post("/auth/logout");
    currentUser.set(null);
    navigate("/login");
  };

  const routes = [
    { pattern: "/login", render: () => LoginPage((u) => currentUser.set(u)) },
    { pattern: "/register", render: () => RegisterPage((u) => currentUser.set(u)) },
    { pattern: "/", render: () => guarded(currentUser, () => DashboardPage()) },
    {
      pattern: "/projects/:id",
      render: (params: Record<string, string>) => guarded(currentUser, () => ProjectPage(params)),
    },
  ];

  const content = router(routes, () => h("div", { style: { padding: "24px" } }, "Not found"));
  const displayName = computed(() => currentUser()?.display_name ?? "");

  return h(
    "div",
    { id: "app" },
    when(
      authChecked,
      () =>
        h(
          "div.stack",
          { style: { minHeight: "100vh" } },
          when(
            currentUser,
            () =>
              h(
                "nav.topnav",
                {},
                h("a.topnav-brand", { href: "/" }, "Snorlax"),
                h(
                  "div.row.gap-3",
                  {},
                  h("span", { style: { color: "var(--color-text-muted)", fontSize: "0.875rem" } }, displayName),
                  h("button.btn.btn-secondary", { onclick: logout }, "Sign out"),
                ),
              ),
            () => document.createComment("no-nav"),
          ),
          content,
        ),
      () => h("div", { style: { padding: "24px" } }, "Loading…"),
    ),
  );
}

function guarded(currentUser: ReturnType<typeof signal<User | null>>, render: () => Node): Node {
  if (!currentUser()) {
    navigate("/login");
    return document.createComment("redirecting");
  }
  return render();
}
