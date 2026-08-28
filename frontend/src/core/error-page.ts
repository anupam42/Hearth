import { h } from "./dom.js";
import { navigate } from "./router.js";

interface ErrorPageOptions {
  code: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function ErrorPage(opts: ErrorPageOptions): Node {
  return h(
    "div.error-page",
    {},
    h("div.error-mascot-wrap", {}, h("img.error-mascot", { src: "/icon.svg", alt: "" })),
    h("div.error-code", {}, opts.code),
    h("h1.error-title", {}, opts.title),
    h("p.error-message", {}, opts.message),
    h(
      "div.error-actions",
      {},
      h("button.btn.btn-primary", { onclick: opts.onAction }, opts.actionLabel),
      opts.secondaryLabel && opts.onSecondary
        ? h("button.btn.btn-secondary", { onclick: opts.onSecondary }, opts.secondaryLabel)
        : null,
    ),
  );
}

export function NotFoundPage(): Node {
  return ErrorPage({
    code: "404",
    title: "Nothing to see here",
    message: "That page has wandered off, or never existed in the first place.",
    actionLabel: "Take me home",
    onAction: () => navigate("/"),
  });
}

export function ForbiddenPage(): Node {
  return ErrorPage({
    code: "403",
    title: "This one's admin-only",
    message: "You don't have access to this page. If that seems wrong, check with an admin on your team.",
    actionLabel: "Take me home",
    onAction: () => navigate("/"),
  });
}

export function ServerErrorPage(onRetry: () => void): Node {
  return ErrorPage({
    code: "500",
    title: "Something went wrong on our end",
    message: "Hearth couldn't reach the server. It might be restarting — try again in a moment.",
    actionLabel: "Try again",
    onAction: onRetry,
  });
}
