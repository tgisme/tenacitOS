import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

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
  id: "etsy" | "printify" | string;
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

interface CommerceIntegrationsStore {
  providers: CommerceIntegrationProvider[];
  guardrails: string[];
  setupChecklist: SetupChecklistItem[];
}

type RawProvider = Partial<Omit<CommerceIntegrationProvider, "health">> & {
  health?: Partial<IntegrationHealth>;
};

type RawChecklistItem = Partial<SetupChecklistItem>;

const DATA_PATH = path.join(process.cwd(), "data", "commerce-integrations.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-integrations.example.json");

const VALID_PROVIDER_STATUSES = new Set<ProviderStatus>([
  "not-connected",
  "configured",
  "syncing",
  "healthy",
  "needs-attention",
  "disabled",
]);

const VALID_CHECKLIST_STATUSES = new Set<ChecklistStatus>(["todo", "in-progress", "done", "blocked"]);

function normalizeList(value: unknown, limit = 20): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  return [];
}

function normalizeProvider(raw: RawProvider): CommerceIntegrationProvider {
  const status = raw.status && VALID_PROVIDER_STATUSES.has(raw.status) ? raw.status : "not-connected";

  return {
    id: String(raw.id || "unknown"),
    name: String(raw.name || "Unknown provider"),
    status,
    mode: raw.mode ?? "other",
    authMode: raw.authMode ?? "manual",
    lastSyncAt: raw.lastSyncAt ?? null,
    nextStep: raw.nextStep ?? "Configure provider credentials and approval rules.",
    capabilities: normalizeList(raw.capabilities),
    blockedActions: normalizeList(raw.blockedActions),
    approvalRules: normalizeList(raw.approvalRules),
    health: {
      credentialConfigured: Boolean(raw.health?.credentialConfigured),
      webhookConfigured: Boolean(raw.health?.webhookConfigured),
      readScopeEnabled: Boolean(raw.health?.readScopeEnabled),
      writeScopeEnabled: Boolean(raw.health?.writeScopeEnabled),
      lastError: raw.health?.lastError ?? null,
    },
  };
}

function normalizeChecklistItem(raw: RawChecklistItem): SetupChecklistItem {
  const status = raw.status && VALID_CHECKLIST_STATUSES.has(raw.status) ? raw.status : "todo";

  return {
    id: String(raw.id || raw.label || "setup-item"),
    label: String(raw.label || "Setup item"),
    status,
    notes: String(raw.notes || ""),
  };
}

async function loadStore(): Promise<CommerceIntegrationsStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CommerceIntegrationsStore>;

    return {
      providers: Array.isArray(parsed.providers) ? parsed.providers.map(normalizeProvider) : [],
      guardrails: normalizeList(parsed.guardrails),
      setupChecklist: Array.isArray(parsed.setupChecklist) ? parsed.setupChecklist.map(normalizeChecklistItem) : [],
    };
  } catch {
    const raw = await fs.readFile(EXAMPLE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CommerceIntegrationsStore>;

    return {
      providers: Array.isArray(parsed.providers) ? parsed.providers.map(normalizeProvider) : [],
      guardrails: normalizeList(parsed.guardrails),
      setupChecklist: Array.isArray(parsed.setupChecklist) ? parsed.setupChecklist.map(normalizeChecklistItem) : [],
    };
  }
}

async function saveStore(store: CommerceIntegrationsStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function getStats(store: CommerceIntegrationsStore) {
  return {
    providers: store.providers.length,
    connected: store.providers.filter((provider) => ["configured", "syncing", "healthy"].includes(provider.status)).length,
    needsAttention: store.providers.filter((provider) => provider.status === "needs-attention").length,
    blockedWriteActions: store.providers.reduce((sum, provider) => sum + provider.blockedActions.length, 0),
    checklistDone: store.setupChecklist.filter((item) => item.status === "done").length,
    checklistTotal: store.setupChecklist.length,
  };
}

export async function GET() {
  try {
    const store = await loadStore();
    return NextResponse.json({ ...store, stats: getStats(store) });
  } catch (error) {
    console.error("[commerce-integrations] Failed to load integrations:", error);
    return NextResponse.json({ error: "Failed to load commerce integrations" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const itemId = String(body.itemId || "");
    const status = body.status as ChecklistStatus;

    if (!itemId || !VALID_CHECKLIST_STATUSES.has(status)) {
      return NextResponse.json({ error: "Missing or invalid checklist item/status" }, { status: 400 });
    }

    const store = await loadStore();
    const item = store.setupChecklist.find((entry) => entry.id === itemId);

    if (!item) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    item.status = status;
    await saveStore(store);

    return NextResponse.json({ ...store, stats: getStats(store) });
  } catch (error) {
    console.error("[commerce-integrations] Failed to update checklist:", error);
    return NextResponse.json({ error: "Failed to update commerce integration checklist" }, { status: 500 });
  }
}
