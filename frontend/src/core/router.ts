import { effect, signal, untrack, type Signal } from "./reactive.js";

export interface Route {
  pattern: string; // e.g. "/projects/:id"
  render: (params: Record<string, string>) => Node;
}

const currentPath: Signal<string> = signal(window.location.pathname);

function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const actual = pathParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = decodeURIComponent(actual);
    } else if (pp !== actual) {
      return null;
    }
  }
  return params;
}

export function navigate(path: string): void {
  if (path === currentPath()) return;
  window.history.pushState({}, "", path);
  currentPath.set(path);
}

window.addEventListener("popstate", () => {
  currentPath.set(window.location.pathname);
});

/** Intercepts clicks on same-origin anchor tags so navigation stays client-side. */
export function installLinkInterceptor(): void {
  document.addEventListener("click", (e) => {
    const anchor = (e.target as Element).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/") || anchor.target === "_blank") return;
    e.preventDefault();
    navigate(href);
  });
}

export function router(routes: Route[], notFound: () => Node): Node {
  const container = document.createElement("div");
  container.style.display = "contents";

  // A route's render (e.g. an auth guard) can call `navigate()` synchronously, which — since
  // signal.set() re-runs subscribers immediately, not batched — reenters this same effect
  // mid-render. Without this guard, the reentrant call renders the redirected-to page correctly,
  // but the stale outer call then finishes and overwrites the container with its own (now wrong)
  // result. Queue a follow-up render instead of recursing, so the outermost call always yields to
  // the freshest path.
  let isRendering = false;
  let pending = false;

  const render = () => {
    if (isRendering) {
      pending = true;
      return;
    }
    isRendering = true;
    try {
      const path = currentPath();
      for (const route of routes) {
        const params = matchRoute(route.pattern, path);
        if (params) {
          container.replaceChildren(untrack(() => route.render(params)));
          return;
        }
      }
      container.replaceChildren(untrack(notFound));
    } finally {
      isRendering = false;
      if (pending) {
        pending = false;
        render();
      }
    }
  };

  effect(render);
  return container;
}

export { currentPath };
