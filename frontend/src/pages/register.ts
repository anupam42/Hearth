import { h } from "../core/dom.js";
import { effect, signal } from "../core/reactive.js";
import { api, ApiError, type User } from "../api/client.js";
import { navigate } from "../core/router.js";

export function RegisterPage(onAuthenticated: (user: User) => void): Node {
  const email = signal("");
  const displayName = signal("");
  const password = signal("");
  const error = signal("");

  const submit = async (e: Event) => {
    e.preventDefault();
    error.set("");
    try {
      const user = await api.post<User>("/auth/register", {
        email: email(),
        display_name: displayName(),
        password: password(),
      });
      onAuthenticated(user);
      navigate("/");
    } catch (err) {
      error.set(err instanceof ApiError ? err.message : "registration failed");
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
      h("h1", {}, "Create your account"),
      h(
        "div.field",
        {},
        h("label", {}, "Name"),
        h("input.input", {
          required: true,
          value: displayName(),
          oninput: (e: Event) => displayName.set((e.target as HTMLInputElement).value),
        }),
      ),
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
          minlength: 8,
          value: password(),
          oninput: (e: Event) => password.set((e.target as HTMLInputElement).value),
        }),
      ),
      errorEl,
      h("button.btn.btn-primary", { type: "submit" }, "Create account"),
      h(
        "p",
        { style: { fontSize: "0.875rem", color: "var(--color-text-muted)" } },
        "Already have an account? ",
        h("a", { href: "/login" }, "Sign in"),
      ),
    ),
  );
}
