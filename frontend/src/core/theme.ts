import { effect, signal } from "./reactive.js";

export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "hearth_theme";

function readStored(): ThemePref {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "light";
}

export const themePref = signal<ThemePref>(readStored());

export function setTheme(pref: ThemePref): void {
  localStorage.setItem(STORAGE_KEY, pref);
  themePref.set(pref);
}

effect(() => {
  const pref = themePref();
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
});
