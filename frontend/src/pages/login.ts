import { h } from "../core/dom.js";
import { effect, signal } from "../core/reactive.js";
import { api, ApiError, type User } from "../api/client.js";
import { navigate } from "../core/router.js";

export function LoginPage(onAuthenticated: (user: User) => void): Node {
  const email = signal("");
  const password = signal("");
  const error = signal("");
  const loading = signal(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    error.set("");
    loading.set(true);
    try {
      const user = await api.post<User>("/auth/login", {
        email: email(),
        password: password(),
      });
      onAuthenticated(user);
      navigate("/");
    } catch (err) {
      error.set(err instanceof ApiError ? err.message : "login failed");
    } finally {
      loading.set(false);
    }
  };

  const errorEl = h("div.error-banner", { style: { display: "none" } });
  effect(() => {
    const msg = error();
    errorEl.textContent = msg;
    errorEl.style.display = msg ? "block" : "none";
  });

  return h(
    "div.auth-shell",
    {},
    h(
      "form.auth-card.card",
      { onsubmit: submit },
      h("h1", {}, "Sign in to Snorlax"),
      h(
        "div.field",
        {},
        h("label", {}, "Email"),
        h("input.input", {
          type: "email",
          required: true,
          value: email(),
          oninput: (e: Event) => email.set((e.target as HTMLInputElement).value),
        }),
      ),
      h(
        "div.field",
        {},
        h("label", {}, "Password"),
        h("input.input", {
          type: "password",
          required: true,
          value: password(),
          oninput: (e: Event) => password.set((e.target as HTMLInputElement).value),
        }),
      ),
      errorEl,
      h("button.btn.btn-primary", { type: "submit" }, "Sign in"),
      h(
        "p",
        { style: { fontSize: "0.875rem", color: "var(--color-text-muted)" } },
        "No account? ",
        h("a", { href: "/register" }, "Register"),
      ),
    ),
  );
}
