import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type TrendStatus = "watching" | "promising" | "converted" | "dismissed" | "archived";
type TrendAuditAction = "created" | "updated" | "converted" | "dismissed" | "archived";

interface TrendEvidence {
  source: string;
  signal: string;
  url: string;
  observedAt: string;
}

interface TrendAuditEntry {
  id: string;
  timestamp: string;
  action: TrendAuditAction;
  note: string;
}

interface TrendBrief {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: TrendStatus;
  title: string;
  sourceAgent: string;
  marketplace: "etsy" | "printify" | "manual" | "other";
  niche: string;
  summary: string;
  evidence: TrendEvidence[];
  keywords: string[];
  suggestedProducts: string[];
  seasonality: string;
  competition: string;
  riskNotes: string;
  confidence: number;
  opportunityScore: number;
  linkedProductIds: string[];
  auditTrail: TrendAuditEntry[];
}

interface TrendStore {
  briefs: TrendBrief[];
}

type RawTrendBrief = Omit<Partial<TrendBrief>, "status" | "evidence"> & {
  status?: TrendStatus;
  evidence?: unknown;
};

const DATA_PATH = path.join(process.cwd(), "data", "commerce-trends.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-trends.example.json");

const VALID_STATUSES = new Set<TrendStatus>(["watching", "promising", "converted", "dismissed", "archived"]);
const VALID_MARKETPLACES = new Set<TrendBrief["marketplace"]>(["etsy", "printify", "manual", "other"]);

function normalizeList(value: unknown, limit = 16): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  return [];
}

function normalizeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeEvidence(value: unknown): TrendEvidence[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return { source: "Manual note", signal: item.trim(), url: "", observedAt: new Date().toISOString() };
        }

        const raw = item as Partial<TrendEvidence>;
        return {
          source: String(raw.source || "Manual note").trim(),
          signal: String(raw.signal || "").trim(),
          url: String(raw.url || "").trim(),
          observedAt: raw.observedAt || new Date().toISOString(),
        };
      })
      .filter((item) => item.signal)
      .slice(0, 12);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((signal) => signal.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((signal) => ({ source: "Manual note", signal, url: "", observedAt: new Date().toISOString() }));
  }

  return [];
}

function makeAudit(action: TrendAuditAction, note: string): TrendAuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    note,
  };
}

function normalizeBrief(raw: RawTrendBrief): TrendBrief {
  const status = raw.status && VALID_STATUSES.has(raw.status) ? raw.status : "watching";
  const marketplace = raw.marketplace && VALID_MARKETPLACES.has(raw.marketplace) ? raw.marketplace : "etsy";

  return {
    id: raw.id ?? randomUUID(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    status,
    title: raw.title ?? "Untitled trend brief",
    sourceAgent: raw.sourceAgent ?? "Manual entry",
    marketplace,
    niche: raw.niche ?? "Uncategorized",
    summary: raw.summary ?? "",
    evidence: normalizeEvidence(raw.evidence),
    keywords: normalizeList(raw.keywords, 20),
    suggestedProducts: normalizeList(raw.suggestedProducts, 12),
    seasonality: raw.seasonality ?? "",
    competition: raw.competition ?? "",
    riskNotes: raw.riskNotes ?? "",
    confidence: normalizeNumber(raw.confidence, 60),
    opportunityScore: normalizeNumber(raw.opportunityScore, 50),
    linkedProductIds: normalizeList(raw.linkedProductIds, 20),
    auditTrail: Array.isArray(raw.auditTrail) ? raw.auditTrail : [],
  };
}

async function loadStore(): Promise<TrendStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { briefs?: RawTrendBrief[] };
    return { briefs: Array.isArray(parsed.briefs) ? parsed.briefs.map(normalizeBrief) : [] };
  } catch {
    try {
      const raw = await fs.readFile(EXAMPLE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as { briefs?: RawTrendBrief[] };
      return { briefs: Array.isArray(parsed.briefs) ? parsed.briefs.map(normalizeBrief) : [] };
    } catch {
      return { briefs: [] };
    }
  }
}

async function saveStore(store: TrendStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function getStats(briefs: TrendBrief[]) {
  return {
    total: briefs.length,
    watching: briefs.filter((brief) => brief.status === "watching").length,
    promising: briefs.filter((brief) => brief.status === "promising").length,
    converted: briefs.filter((brief) => brief.status === "converted").length,
    averageOpportunity: briefs.length
      ? Math.round(briefs.reduce((sum, brief) => sum + brief.opportunityScore, 0) / briefs.length)
      : 0,
  };
}

export async function GET() {
  try {
    const store = await loadStore();
    const briefs = [...store.briefs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({ briefs, stats: getStats(briefs) });
  } catch (error) {
    console.error("[commerce-trends] Failed to load trend briefs:", error);
    return NextResponse.json({ error: "Failed to load trend briefs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const niche = String(body.niche || "").trim();

    if (!title || !niche) {
      return NextResponse.json({ error: "Missing required fields: title, niche" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rawMarketplace = String(body.marketplace || "etsy") as TrendBrief["marketplace"];
    const brief: TrendBrief = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: "watching",
      title,
      sourceAgent: String(body.sourceAgent || "Manual entry").trim(),
      marketplace: VALID_MARKETPLACES.has(rawMarketplace) ? rawMarketplace : "etsy",
      niche,
      summary: String(body.summary || "").trim(),
      evidence: normalizeEvidence(body.evidence),
      keywords: normalizeList(body.keywords, 20),
      suggestedProducts: normalizeList(body.suggestedProducts, 12),
      seasonality: String(body.seasonality || "").trim(),
      competition: String(body.competition || "").trim(),
      riskNotes: String(body.riskNotes || "").trim(),
      confidence: normalizeNumber(body.confidence, 60),
      opportunityScore: normalizeNumber(body.opportunityScore, 50),
      linkedProductIds: normalizeList(body.linkedProductIds, 20),
      auditTrail: [makeAudit("created", "Trend brief created locally. No external marketplace action was taken.")],
    };

    const store = await loadStore();
    store.briefs.unshift(brief);
    await saveStore(store);

    return NextResponse.json(brief, { status: 201 });
  } catch (error) {
    console.error("[commerce-trends] Failed to create trend brief:", error);
    return NextResponse.json({ error: "Failed to create trend brief" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = body.status as TrendStatus;
    const note = String(body.note || "").trim();

    if (!id || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Missing or invalid id/status" }, { status: 400 });
    }

    if (["converted", "dismissed", "archived"].includes(status) && !note) {
      return NextResponse.json({ error: "A note is required for final trend decisions" }, { status: 400 });
    }

    const store = await loadStore();
    const brief = store.briefs.find((item) => item.id === id);

    if (!brief) {
      return NextResponse.json({ error: "Trend brief not found" }, { status: 404 });
    }

    brief.status = status;
    brief.updatedAt = new Date().toISOString();
    brief.auditTrail.unshift(
      makeAudit(
        status === "converted" ? "converted" : status === "dismissed" ? "dismissed" : status === "archived" ? "archived" : "updated",
        note || `Status changed to ${status}`,
      ),
    );

    await saveStore(store);

    return NextResponse.json(brief);
  } catch (error) {
    console.error("[commerce-trends] Failed to update trend brief:", error);
    return NextResponse.json({ error: "Failed to update trend brief" }, { status: 500 });
  }
}
