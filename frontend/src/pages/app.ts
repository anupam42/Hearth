import { h, when } from "../core/dom.js";
import { computed, effect, signal } from "../core/reactive.js";
import { installLinkInterceptor, navigate, router, currentPath } from "../core/router.js";
import { Dropdown } from "../core/dropdown.js";
import { icons } from "../core/icons.js";
import { setTheme, themePref, type ThemePref } from "../core/theme.js";
import { LoadingScreen } from "../core/loading.js";
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from "../core/error-page.js";
import { ToastContainer, toast } from "../core/toast.js";
import { startSessionTracking } from "../core/session.js";
import { api, apiDown, unauthorized, type User } from "../api/client.js";
import { LoginPage } from "./login.js";
import { RegisterPage } from "./register.js";
import { DashboardPage } from "./dashboard.js";
import { ProjectsPage } from "./projects.js";
import { ProjectPage } from "./project.js";
import { ViewsPage } from "./views.js";
import { CyclesPage } from "./cycles.js";
import { ModulesPage } from "./modules.js";
import { SettingsPage } from "./settings.js";
import { PomodoroPage } from "./pomodoro.js";
import { WorkspacesPage } from "./workspaces.js";

const NAV_ITEMS = [
  { path: "/", icon: icons.grid, label: "Dashboard" },
  { path: "/projects", icon: icons.folder, label: "Projects" },
  { path: "/views", icon: icons.eye, label: "Views" },
  { path: "/cycles", icon: icons.repeat, label: "Cycles" },
  { path: "/modules", icon: icons.layers, label: "Modules" },
] as const;

export function App(): Node {
  const currentUser = signal<User | null>(null);
  const authChecked = signal(false);

  installLinkInterceptor();
  startSessionTracking();

  // Every path that lands currentUser on a real, logged-in value must clear any stale
  // `unauthorized` flag first — otherwise a 401 from *before* login (the anonymous bootstrap
  // check, a failed login attempt) lingers and immediately false-triggers the effect below.
  const setAuthenticated = (u: User) => {
    unauthorized.set(false);
    currentUser.set(u);
  };

  // A 401 only means "your session actually expired" if we thought we were logged in —
  // otherwise it's just the normal result of checking auth state while logged out.
  effect(() => {
    if (unauthorized() && currentUser()) {
      currentUser.set(null);
      unauthorized.set(false);
      navigate("/login");
      toast.warning("You've been signed out", {
        message: "Your session expired from inactivity. Please sign in again.",
      });
    }
  });

  // On a fast connection /auth/me can resolve in under a millisecond, which would make
  // the branded loading screen an imperceptible flash. Hold it for a minimum stretch so
  // it actually reads as part of the experience rather than technically-correct-but-invisible.
  const MIN_LOADING_MS = 400;
  const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS));

  Promise.all([
    api
      .get<User>("/auth/me")
      .then((u) => setAuthenticated(u))
      .catch(() => currentUser.set(null))
      .finally(() => unauthorized.set(false)),
    minDelay,
  ]).finally(() => authChecked.set(true));

  const logout = async () => {
    await api.post("/auth/logout");
    currentUser.set(null);
    navigate("/login");
  };

  const routes = [
    { pattern: "/login", render: () => LoginPage(setAuthenticated) },
    { pattern: "/register", render: () => RegisterPage(setAuthenticated) },
    { pattern: "/", render: () => guarded(currentUser, () => DashboardPage()) },
    { pattern: "/projects", render: () => guarded(currentUser, () => ProjectsPage()) },
    {
      pattern: "/projects/:id",
      render: (params: Record<string, string>) => guarded(currentUser, () => ProjectPage(params)),
    },
    { pattern: "/views", render: () => guarded(currentUser, () => ViewsPage()) },
    { pattern: "/cycles", render: () => guarded(currentUser, () => CyclesPage()) },
    { pattern: "/modules", render: () => guarded(currentUser, () => ModulesPage()) },
    { pattern: "/pomodoro", render: () => guarded(currentUser, () => PomodoroPage()) },
    { pattern: "/settings", render: () => guarded(currentUser, () => SettingsPage(currentUser)) },
    {
      pattern: "/workspaces",
      render: () => guarded(currentUser, () => adminGuarded(currentUser, () => WorkspacesPage())),
    },
  ];

  const displayName = computed(() => currentUser()?.display_name ?? "");
  const initials = computed(() => {
    const name = currentUser()?.display_name ?? "";
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  });

  return h(
    "div",
    { id: "app" },
    ToastContainer(),
    when(
      apiDown,
      () => ServerErrorPage(() => window.location.reload()),
      () =>
        when(
          authChecked,
          // Built only once authChecked is true, so `guarded`/`adminGuarded` see the resolved
          // currentUser instead of racing the in-flight /auth/me request on a hard page load.
          () => {
            const content = router(routes, () => NotFoundPage());
            return h(
              "div.stack",
              { style: { minHeight: "100vh" } },
              when(
                currentUser,
                () =>
                  h(
                    "div.shell",
                    {},
                    Sidebar(currentUser),
                    h(
                      "div.shell-main",
                      {},
                      Topbar(displayName, initials, currentUser, logout),
                      content,
                    ),
                  ),
                () => h("div.stack", { style: { minHeight: "100vh" } }, content),
              ),
            );
          },
          () => LoadingScreen(),
        ),
    ),
  );
}

function Sidebar(currentUser: ReturnType<typeof signal<User | null>>): Node {
  const isAdmin = computed(() => currentUser()?.system_role === "admin");
  return h(
    "aside.sidebar",
    {},
    h("div.sidebar-brand", {}, h("img", { src: "/icon.svg", alt: "Hearth", width: 26, height: 26 })),
    h(
      "nav.sidebar-nav",
      {},
      ...NAV_ITEMS.map((item) =>
        h(
          "a.sidebar-icon",
          {
            href: item.path,
            title: item.label,
            class: computed(() => (isActive(item.path) ? "active" : "")),
          },
          item.icon(20),
        ),
      ),
      when(isAdmin, () =>
        h(
          "a.sidebar-icon",
          {
            href: "/workspaces",
            title: "Workspaces (admin)",
            class: computed(() => (isActive("/workspaces") ? "active" : "")),
          },
          icons.building(20),
        ),
      ),
    ),
    h(
      "div.sidebar-nav-bottom",
      {},
      h(
        "a.sidebar-icon",
        {
          href: "/pomodoro",
          title: "Pomodoro",
          class: computed(() => (isActive("/pomodoro") ? "active" : "")),
        },
        icons.timer(20),
      ),
      h(
        "a.sidebar-icon",
        {
          href: "/settings",
          title: "Settings",
          class: computed(() => (isActive("/settings") ? "active" : "")),
        },
        icons.settings(20),
      ),
    ),
  );
}

function isActive(path: string): boolean {
  const cur = currentPath();
  if (path === "/") return cur === "/";
  return cur === path || cur.startsWith(path + "/");
}

function Topbar(
  displayName: ReturnType<typeof computed<string>>,
  initials: ReturnType<typeof computed<string>>,
  currentUser: ReturnType<typeof signal<User | null>>,
  logout: () => void,
): Node {
  return h(
    "header.topbar",
    {},
    h(
      "a.topnav-brand.row.gap-2",
      { href: "/" },
      h("img", { src: "/icon.svg", alt: "Hearth", width: 24, height: 24 }),
      "Hearth",
    ),
    h(
      "div.topbar-actions",
      {},
      h("button.topbar-icon-btn", { title: "Search" }, icons.search(18)),
      h("button.topbar-icon-btn", { title: "Notifications" }, icons.bell(18)),
      ThemeMenu(),
      Dropdown(
        (toggle) =>
          h(
            "button.topbar-user",
            { onclick: toggle },
            h("span.avatar", {}, initials),
            h("span", {}, displayName),
          ),
        (close) =>
          h(
            "div.dropdown-menu",
            {},
            h(
              "div.dropdown-header",
              {},
              h("div.dropdown-header-name", {}, displayName),
              h("div.dropdown-header-email", {}, computed(() => currentUser()?.email ?? "")),
            ),
            h("div.dropdown-divider", {}),
            h(
              "a.dropdown-item",
              { href: "/", onclick: close },
              icons.grid(16),
              "Dashboard",
            ),
            h(
              "a.dropdown-item",
              { href: "/projects", onclick: close },
              icons.folder(16),
              "Projects",
            ),
            h(
              "a.dropdown-item",
              { href: "/settings", onclick: close },
              icons.settings(16),
              "Settings",
            ),
            when(
              computed(() => currentUser()?.system_role === "admin"),
              () =>
                h(
                  "a.dropdown-item",
                  { href: "/workspaces", onclick: close },
                  icons.building(16),
                  "Workspaces",
                ),
            ),
            h("div.dropdown-divider", {}),
            h(
              "button.dropdown-item.danger",
              {
                onclick: () => {
                  close();
                  logout();
                },
              },
              icons.logout(16),
              "Log out",
            ),
            h("div.dropdown-footer", {}, "v0.1.0"),
          ),
      ),
    ),
  );
}

const THEME_OPTIONS: { pref: ThemePref; label: string; icon: (size?: number) => Node }[] = [
  { pref: "light", label: "Light", icon: icons.sun },
  { pref: "dark", label: "Dark", icon: icons.moon },
  { pref: "system", label: "System", icon: icons.monitor },
];

function ThemeMenu(): Node {
  return Dropdown(
    (toggle) => h("button.topbar-icon-btn", { title: "Theme", onclick: toggle }, icons.moon(18)),
    (close) =>
      h(
        "div.dropdown-menu",
        { style: { minWidth: "160px" } },
        ...THEME_OPTIONS.map((opt) =>
          h(
            "button.dropdown-item",
            {
              class: computed(() => (themePref() === opt.pref ? "active-item" : "")),
              onclick: () => {
                setTheme(opt.pref);
                close();
              },
            },
            opt.icon(16),
            opt.label,
          ),
        ),
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

function adminGuarded(currentUser: ReturnType<typeof signal<User | null>>, render: () => Node): Node {
  if (currentUser()?.system_role !== "admin") {
    return ForbiddenPage();
  }
  return render();
}
