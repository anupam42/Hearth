import { h, list, when } from "../core/dom.js";
import { computed, signal } from "../core/reactive.js";
import { icons } from "../core/icons.js";
import { EmptyState } from "../core/empty-state.js";
import { Spinner } from "../core/loading.js";
import { toast } from "../core/toast.js";
import { api, type AuditEntry, type AuditVerifyResult } from "../api/client.js";

function timeAgo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function detailSummary(details: string): string {
  try {
    const d = JSON.parse(details) as Record<string, unknown>;
    if (typeof d.key === "string" && typeof d.name === "string") return `${d.key} — ${d.name}`;
    if (typeof d.display_id === "string" && typeof d.title === "string")
      return `${d.display_id} — ${d.title}`;
    if (typeof d.name === "string") return d.name;
    if (typeof d.title === "string") return d.title;
    if (typeof d.status === "string") return `status → ${d.status}`;
  } catch {
    // details isn't JSON or doesn't match a known shape — no summary, just show the row plainly
  }
  return "";
}

const ACTION_META: Record<string, { verb: string; icon: (size?: number) => Node }> = {
  "user.register": { verb: "created their account", icon: icons.user },
  "user.login": { verb: "signed in", icon: icons.checkCircle },
  "user.update_profile": { verb: "updated their profile", icon: icons.settings },
  "project.create": { verb: "created project", icon: icons.folder },
  "task.create": { verb: "created task", icon: icons.checklist },
  "task.update": { verb: "updated task", icon: icons.checklist },
  "label.create": { verb: "created label", icon: icons.tag },
  "label.delete": { verb: "deleted label", icon: icons.trash },
  "task.label.assign": { verb: "added a label to a task", icon: icons.tag },
  "task.label.unassign": { verb: "removed a label from a task", icon: icons.tag },
  "workspace.create": { verb: "created workspace", icon: icons.building },
  "token.create": { verb: "created a personal access token", icon: icons.key },
  "token.revoke": { verb: "revoked a personal access token", icon: icons.key },
};

function actionMeta(action: string): { verb: string; icon: (size?: number) => Node } {
  return ACTION_META[action] ?? { verb: action.replace(/\./g, " "), icon: icons.checklist };
}

export function AuditPage(): Node {
  const entries = signal<AuditEntry[]>([]);
  const loading = signal(true);
  const loadError = signal("");
  const verifying = signal(false);
  const verifyResult = signal<AuditVerifyResult | null>(null);

  const load = async () => {
    loading.set(true);
    loadError.set("");
    try {
      entries.set(await api.get<AuditEntry[]>("/audit"));
    } catch {
      loadError.set("Couldn't load the audit trail.");
    } finally {
      loading.set(false);
    }
  };
  load();

  const runVerify = async () => {
    verifying.set(true);
    try {
      const result = await api.get<AuditVerifyResult>("/audit/verify");
      verifyResult.set(result);
      if (result.intact) {
        toast.success("Chain verified", {
          message: `${entries().length} entries checked — no tampering detected.`,
        });
      } else {
        toast.error("Integrity check failed", {
          message: result.error ?? "The audit chain has been tampered with.",
        });
      }
    } catch {
      toast.error("Couldn't run the integrity check");
    } finally {
      verifying.set(false);
    }
  };

  const hasEntries = computed(() => entries().length > 0);
  const hasVerifyResult = computed(() => verifyResult() !== null);
  const verifyIntact = computed(() => verifyResult()?.intact ?? false);

  return h(
    "div.page",
    {},
    h(
      "div.page-header.spacious",
      {},
      h("h1.page-title", {}, icons.shield(24), "Audit Trail"),
      h("p.page-subtitle", {}, "Every mutating action, hash-chained for tamper evidence. Admin-only."),
    ),
    h(
      "div",
      { style: { padding: "0 24px 24px" } },
      h(
        "div.audit-toolbar",
        {},
        h(
          "button.btn.btn-secondary",
          { onclick: runVerify, disabled: verifying() },
          when(
            verifying,
            () => Spinner(14),
            () => icons.shield(16),
          ),
          computed(() => (verifying() ? "Verifying…" : "Verify Integrity")),
        ),
        when(hasVerifyResult, () =>
          h(
            "div.audit-verify-banner",
            { class: computed(() => (verifyIntact() ? "ok" : "broken")) },
            when(
              verifyIntact,
              () => icons.checkCircle(16),
              () => icons.alertTriangle(16),
            ),
            h(
              "span",
              {},
              computed(() =>
                verifyIntact()
                  ? "Chain verified — no tampering detected."
                  : `Integrity check failed: ${verifyResult()?.error ?? "unknown error"}`,
              ),
            ),
          ),
        ),
      ),
      when(
        computed(() => loadError().length > 0),
        () => h("div.error-banner", {}, loadError),
      ),
      when(
        loading,
        () => h("div.audit-loading", {}, Spinner(20), h("span", {}, "Loading audit trail…")),
        () =>
          when(
            hasEntries,
            () =>
              h(
                "div.audit-list",
                {},
                list(entries, (entry) => {
                  const meta = actionMeta(entry.action);
                  const summary = detailSummary(entry.details);
                  return h(
                    "div.audit-row",
                    {},
                    h("span.audit-row-icon", {}, meta.icon(15)),
                    h(
                      "div.audit-row-body",
                      {},
                      h(
                        "div.audit-row-line",
                        {},
                        h("strong", {}, entry.actor_name ?? entry.actor_email ?? "Unknown user"),
                        ` ${meta.verb}`,
                        summary ? h("span.audit-row-summary", {}, ` — ${summary}`) : null,
                      ),
                      h(
                        "div.audit-row-meta",
                        {},
                        h("span", {}, entry.entity_type),
                        h("span", {}, "·"),
                        h("span", {}, timeAgo(entry.created_at)),
                        h("span", {}, "·"),
                        h("code.audit-hash", { title: entry.hash }, entry.hash.slice(0, 10)),
                      ),
                    ),
                  );
                }),
              ),
            () =>
              EmptyState(
                icons.shield(24),
                "No activity yet",
                "Actions across the app will show up here as they happen.",
              ),
          ),
      ),
    ),
  );
}
