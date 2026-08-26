import { h } from "../core/dom.js";
import { effect, signal } from "../core/reactive.js";
import { api, ApiError, type User } from "../api/client.js";
import { navigate } from "../core/router.js";
import { AuthShell, AuthSwitchLink, PasswordField } from "../core/auth-shell.js";

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

  const form = h(
    "form.stack.gap-4",
    { onsubmit: submit },
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
        placeholder: "yourname@mail.com",
        value: email(),
        oninput: (e: Event) => email.set((e.target as HTMLInputElement).value),
      }),
    ),
    h(
      "div.field",
      {},
      h("label", {}, "Password"),
      PasswordField(password, (v) => password.set(v), { minlength: 8 }),
    ),
    errorEl,
    h("button.btn.btn-primary.btn-block", { type: "submit" }, "Create account"),
  );

  return AuthShell(
    "Create your account",
    AuthSwitchLink("Already have an account?", "Sign in", "/login"),
    form,
  );
}
