import { h } from "../core/dom.js";
import { effect, signal } from "../core/reactive.js";
import { api, ApiError, type User } from "../api/client.js";
import { navigate } from "../core/router.js";
import { AuthShell, AuthSwitchLink, PasswordField } from "../core/auth-shell.js";

export function LoginPage(onAuthenticated: (user: User) => void): Node {
  const email = signal("");
  const password = signal("");
  const remember = signal(true);
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
        remember: remember(),
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

  const form = h(
    "form.stack.gap-4",
    { onsubmit: submit },
    h(
      "div.field",
      {},
      h("label", {}, "Email"),
      h("input.input", {
        type: "email",
        required: true,
        placeholder: "yourname@mail.com",
        value: email(),
        oninput: (e: Event) => email.set((e.target as HTMLInputElement).value),
      }),
    ),
    h(
      "div.field",
      {},
      h("label", {}, "Password"),
      PasswordField(password, (v) => password.set(v)),
    ),
    h(
      "label.remember-row",
      {},
      h("input", {
        type: "checkbox",
        checked: remember(),
        onchange: (e: Event) => remember.set((e.target as HTMLInputElement).checked),
      }),
      "Remember me",
    ),
    errorEl,
    h("button.btn.btn-primary.btn-block", { type: "submit", disabled: loading() }, "Sign in"),
  );

  return AuthShell("Sign in to Hearth", AuthSwitchLink("Don't have an account?", "Sign up", "/register"), form);
}
