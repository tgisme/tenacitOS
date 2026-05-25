"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Columns3,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Store,
  Truck,
  XCircle,
} from "lucide-react";

type ProviderStatus = "not-connected" | "configured" | "syncing" | "healthy" | "needs-attention" | "disabled";
type ChecklistStatus = "todo" | "in-progress" | "done" | "blocked";

interface IntegrationHealth {
  credentialConfigured: boolean;
  webhookConfigured: boolean;
  readScopeEnabled: boolean;
  writeScopeEnabled: boolean;
  lastError: string | null;
}

interface CommerceIntegrationProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  mode: "marketplace" | "fulfillment" | "analytics" | "other";
  authMode: "oauth" | "api-token" | "manual" | "other";
  lastSyncAt: string | null;
  nextStep: string;
  capabilities: string[];
  blockedActions: string[];
  approvalRules: string[];
  health: IntegrationHealth;
}

interface SetupChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  notes: string;
}

interface IntegrationsResponse {
  providers: CommerceIntegrationProvider[];
  guardrails: string[];
  setupChecklist: SetupChecklistItem[];
  stats: {
    providers: number;
    connected: number;
    needsAttention: number;
    blockedWriteActions: number;
    checklistDone: number;
    checklistTotal: number;
  };
}

const statusStyles: Record<ProviderStatus, { label: string; color: string; bg: string }> = {
  "not-connected": { label: "Not Connected", color: "var(--warning)", bg: "var(--warning-soft)" },
  configured: { label: "Configured", color: "var(--info)", bg: "var(--info-soft)" },
  syncing: { label: "Syncing", color: "var(--info)", bg: "var(--info-soft)" },
  healthy: { label: "Healthy", color: "var(--positive)", bg: "var(--positive-soft)" },
  "needs-attention": { label: "Needs Attention", color: "var(--negative)", bg: "var(--negative-soft)" },
  disabled: { label: "Disabled", color: "var(--text-secondary)", bg: "var(--surface-elevated)" },
};

const checklistStyles: Record<ChecklistStatus, { label: string; color: string; bg: string }> = {
  todo: { label: "Todo", color: "var(--text-secondary)", bg: "var(--surface-elevated)" },
  "in-progress": { label: "In Progress", color: "var(--info)", bg: "var(--info-soft)" },
  done: { label: "Done", color: "var(--positive)", bg: "var(--positive-soft)" },
  blocked: { label: "Blocked", color: "var(--negative)", bg: "var(--negative-soft)" },
};

function MetricTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Store;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="card" style={{ padding: "16px", borderRadius: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>{label}</p>
          <p style={{ color: "var(--text-primary)", fontSize: "24px", fontWeight: 700 }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
      <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{label}</span>
      <span className="badge" style={{ color: enabled ? "var(--positive)" : "var(--warning)", backgroundColor: enabled ? "var(--positive-soft)" : "var(--warning-soft)" }}>
        {enabled ? "Ready" : "Missing"}
      </span>
    </div>
  );
}

export default function CommerceIntegrationsPage() {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const providers = useMemo(() => data?.providers ?? [], [data?.providers]);
  const stats = data?.stats ?? {
    providers: 0,
    connected: 0,
    needsAttention: 0,
    blockedWriteActions: 0,
    checklistDone: 0,
    checklistTotal: 0,
  };

  const loadIntegrations = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/commerce/integrations");
      const nextData = await response.json();
      if (!response.ok) throw new Error(nextData?.error || "Failed to load commerce integrations");
      setData(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commerce integrations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const updateChecklist = async (item: SetupChecklistItem, status: ChecklistStatus) => {
    setUpdatingId(item.id);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to update setup item");
      setData(result);
      setNotice(`${item.label} marked ${checklistStyles[status].label.toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setup item");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            Commerce Integrations
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", maxWidth: "760px" }}>
            Etsy and Printify readiness, setup guardrails, and approval gates before any external commerce action is enabled.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Link className="btn-outline" href="/commerce/work-board">
            <Columns3 className="w-4 h-4" />
            Work Board
          </Link>
          <Link className="btn-outline" href="/commerce/approvals">
            <ClipboardList className="w-4 h-4" />
            Approvals
          </Link>
          <Link className="btn-outline" href="/commerce">
            <Store className="w-4 h-4" />
            Commerce Studio
          </Link>
          <button className="btn-outline" onClick={loadIntegrations} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricTile icon={Store} label="Providers" value={stats.providers} color="var(--info)" />
        <MetricTile icon={CheckCircle2} label="Connected" value={stats.connected} color="var(--positive)" />
        <MetricTile icon={AlertCircle} label="Attention" value={stats.needsAttention} color="var(--negative)" />
        <MetricTile icon={Lock} label="Blocked Writes" value={stats.blockedWriteActions} color="var(--warning)" />
        <MetricTile icon={ClipboardList} label="Setup Done" value={`${stats.checklistDone}/${stats.checklistTotal}`} color="var(--info)" />
      </section>

      {error && (
        <div className="card" style={{ borderRadius: "8px", padding: "14px 16px", display: "flex", gap: "10px", color: "var(--negative)" }}>
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="card" style={{ borderRadius: "8px", padding: "14px 16px", display: "flex", gap: "10px", color: "var(--positive)" }}>
          <CheckCircle2 className="w-5 h-5" />
          <span>{notice}</span>
        </div>
      )}

      <div
        className="card"
        style={{
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "var(--warning)",
          backgroundColor: "var(--warning-soft)",
        }}
      >
        <ShieldAlert className="w-5 h-5" />
        <span style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>
          External writes remain blocked until credentials, dry-run logging, and approval ledger are complete.
        </span>
      </div>

      {isLoading ? (
        <div className="card" style={{ borderRadius: "8px", padding: "40px", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {providers.map((provider) => {
              const status = statusStyles[provider.status];
              const Icon = provider.id === "printify" ? Truck : Store;

              return (
                <article key={provider.id} className="card" style={{ borderRadius: "8px", padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "8px",
                          display: "grid",
                          placeItems: "center",
                          backgroundColor: "var(--surface-elevated)",
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>{provider.name}</h2>
                          <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
                            {status.label}
                          </span>
                          <span className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                            {provider.authMode}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                          {provider.mode} integration · Last sync {provider.lastSyncAt ? new Date(provider.lastSyncAt).toLocaleString() : "never"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "16px" }}>{provider.nextStep}</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginTop: "16px" }}>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Capabilities</p>
                      <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", paddingLeft: "18px" }}>
                        {provider.capabilities.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Blocked Actions</p>
                      <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", paddingLeft: "18px" }}>
                        {provider.blockedActions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Health</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                        <HealthRow label="Credential" enabled={provider.health.credentialConfigured} />
                        <HealthRow label="Webhook" enabled={provider.health.webhookConfigured} />
                        <HealthRow label="Read scope" enabled={provider.health.readScopeEnabled} />
                        <HealthRow label="Write scope" enabled={provider.health.writeScopeEnabled} />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Approval Rules</p>
                    <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", paddingLeft: "18px" }}>
                      {provider.approvalRules.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <section className="card" style={{ borderRadius: "8px", padding: "18px" }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>Setup Checklist</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
                {(data?.setupChecklist ?? []).map((item) => {
                  const status = checklistStyles[item.status];
                  const isUpdating = updatingId === item.id;

                  return (
                    <div key={item.id} style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--surface-elevated)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 700 }}>{item.label}</p>
                          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>{item.notes}</p>
                        </div>
                        <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
                          {status.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                        <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => updateChecklist(item, "in-progress")}>
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          Start
                        </button>
                        <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => updateChecklist(item, "done")}>
                          <CheckCircle2 className="w-4 h-4" />
                          Done
                        </button>
                        <button className="btn-danger" type="button" disabled={isUpdating} onClick={() => updateChecklist(item, "blocked")}>
                          <XCircle className="w-4 h-4" />
                          Block
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card" style={{ borderRadius: "8px", padding: "18px" }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>Guardrails</h2>
              <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "12px", paddingLeft: "18px" }}>
                {(data?.guardrails ?? []).map((item) => (
                  <li key={item} style={{ marginTop: "8px" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </section>
      )}
    </div>
  );
}
