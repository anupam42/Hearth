import { api } from "../api/client.js";

// Must comfortably beat the backend's 45-minute idle window (see backend/src/auth/mod.rs)
// so an active user always gets refreshed well before their token would actually expire.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

let lastActivity = Date.now();
let lastRefresh = 0;
let started = false;

function markActive(): void {
  lastActivity = Date.now();
}

async function tick(): Promise<void> {
  const now = Date.now();
  const activeRecently = now - lastActivity < REFRESH_INTERVAL_MS;
  const dueForRefresh = now - lastRefresh >= REFRESH_INTERVAL_MS;
  if (!activeRecently || !dueForRefresh) return;

  lastRefresh = now;
  try {
    await api.post("/auth/refresh");
  } catch {
    // If the session already lapsed, the next real API call surfaces it via `unauthorized`
    // in api/client.ts, which app.ts reacts to — nothing to do here.
  }
}

/** Starts tracking activity and sliding the session forward. Safe to call more than once. */
export function startSessionTracking(): void {
  if (started) return;
  started = true;
  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, markActive, { passive: true });
  }
  setInterval(tick, CHECK_INTERVAL_MS);
}
