import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type CommerceStatus =
  | "researching"
  | "proposed"
  | "designing"
  | "listing-ready"
  | "needs-review"
  | "approved"
  | "published"
  | "selling"
  | "paused"
  | "rejected"
  | "revision";

type CommerceAuditAction = "created" | "updated" | "approved" | "rejected" | "revision-requested";

interface CommerceAuditEntry {
  id: string;
  timestamp: string;
  action: CommerceAuditAction;
  note: string;
}

interface CommerceProductDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: CommerceStatus;
  title: string;
  niche: string;
  sourceAgent: string;
  confidence: number;
  trendBrief: {
    summary: string;
    evidence: string[];
    seasonality: string;
    competition: string;
  };
  mockupNotes: string;
  pricingAssumptions: string;
  financials: {
    targetPrice: number | null;
    productionCost: number | null;
    shippingCost: number | null;
    etsyFeeEstimate: number | null;
    expectedMargin: number | null;
  };
  tags: string[];
  riskNotes: string;
  etsyCopy: {
    title: string;
    description: string;
    seoNotes: string;
  };
  external: {
    etsyListingId?: string;
    printifyProductId?: string;
    publishingEnabled: false;
    etsyStatus: "disabled" | "not-connected" | "draft-ready" | "drafted" | "published";
    printifyStatus: "disabled" | "not-connected" | "product-ready" | "linked";
  };
  auditTrail: CommerceAuditEntry[];
}

interface CommerceStore {
  products: CommerceProductDraft[];
}

type RawProduct = Omit<Partial<CommerceProductDraft>, "status" | "financials" | "trendBrief" | "external"> & {
  status?: CommerceStatus | "draft";
  financials?: Partial<CommerceProductDraft["financials"]>;
  trendBrief?: Partial<CommerceProductDraft["trendBrief"]>;
  external?: Partial<CommerceProductDraft["external"]>;
};

const DATA_PATH = path.join(process.cwd(), "data", "commerce-products.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-products.example.json");

const VALID_STATUSES = new Set<CommerceStatus>([
  "researching",
  "proposed",
  "designing",
  "listing-ready",
  "needs-review",
  "approved",
  "published",
  "selling",
  "paused",
  "rejected",
  "revision",
]);

const REVIEW_STATUSES = new Set<CommerceStatus>(["approved", "rejected", "revision"]);

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 13);
  }

  if (typeof value === "string") {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 13);
  }

  return [];
}

function normalizeEvidence(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }

  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }

  return [];
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateMargin(financials: CommerceProductDraft["financials"]): number | null {
  if (!financials.targetPrice) return null;
  const costs = (financials.productionCost ?? 0) + (financials.shippingCost ?? 0) + (financials.etsyFeeEstimate ?? 0);
  return Number((financials.targetPrice - costs).toFixed(2));
}

function makeAudit(action: CommerceAuditAction, note: string): CommerceAuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    note,
  };
}

function normalizeProduct(raw: RawProduct): CommerceProductDraft {
  const status = raw.status === "draft" ? "proposed" : raw.status;
  const financials = {
    targetPrice: raw.financials?.targetPrice ?? null,
    productionCost: raw.financials?.productionCost ?? null,
    shippingCost: raw.financials?.shippingCost ?? null,
    etsyFeeEstimate: raw.financials?.etsyFeeEstimate ?? null,
    expectedMargin: raw.financials?.expectedMargin ?? null,
  };

  return {
    id: raw.id ?? randomUUID(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    status: status && VALID_STATUSES.has(status) ? status : "proposed",
    title: raw.title ?? "Untitled product idea",
    niche: raw.niche ?? "Uncategorized",
    sourceAgent: raw.sourceAgent ?? "Manual entry",
    confidence: Math.max(0, Math.min(100, raw.confidence ?? 60)),
    trendBrief: {
      summary: raw.trendBrief?.summary ?? "",
      evidence: normalizeEvidence(raw.trendBrief?.evidence),
      seasonality: raw.trendBrief?.seasonality ?? "",
      competition: raw.trendBrief?.competition ?? "",
    },
    mockupNotes: raw.mockupNotes ?? "",
    pricingAssumptions: raw.pricingAssumptions ?? "",
    financials: {
      ...financials,
      expectedMargin: financials.expectedMargin ?? calculateMargin(financials),
    },
    tags: normalizeTags(raw.tags),
    riskNotes: raw.riskNotes ?? "",
    etsyCopy: {
      title: raw.etsyCopy?.title ?? raw.title ?? "Untitled product idea",
      description: raw.etsyCopy?.description ?? "",
      seoNotes: raw.etsyCopy?.seoNotes ?? "",
    },
    external: {
      etsyListingId: raw.external?.etsyListingId,
      printifyProductId: raw.external?.printifyProductId,
      publishingEnabled: false,
      etsyStatus: raw.external?.etsyStatus ?? "disabled",
      printifyStatus: raw.external?.printifyStatus ?? "disabled",
    },
    auditTrail: Array.isArray(raw.auditTrail) ? raw.auditTrail : [],
  };
}

async function loadStore(): Promise<CommerceStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { products?: RawProduct[] };
    return { products: Array.isArray(parsed.products) ? parsed.products.map(normalizeProduct) : [] };
  } catch {
    try {
      const raw = await fs.readFile(EXAMPLE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as { products?: RawProduct[] };
      return { products: Array.isArray(parsed.products) ? parsed.products.map(normalizeProduct) : [] };
    } catch {
      return { products: [] };
    }
  }
}

async function saveStore(store: CommerceStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function getStats(products: CommerceProductDraft[]) {
  const totalExpectedMargin = products.reduce((sum, product) => sum + (product.financials.expectedMargin ?? 0), 0);

  return {
    total: products.length,
    needsReview: products.filter((product) => ["proposed", "listing-ready", "needs-review"].includes(product.status)).length,
    approved: products.filter((product) => product.status === "approved").length,
    researching: products.filter((product) => product.status === "researching").length,
    published: products.filter((product) => ["published", "selling"].includes(product.status)).length,
    blockedExternalActions: products.filter((product) => product.external.publishingEnabled === false).length,
    totalExpectedMargin: Number(totalExpectedMargin.toFixed(2)),
  };
}

export async function GET() {
  try {
    const store = await loadStore();
    const products = [...store.products].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({
      products,
      stats: getStats(products),
      externalIntegrations: {
        etsy: "disabled",
        printify: "disabled",
        reason: "Credentials and approval rules are not configured.",
      },
    });
  } catch (error) {
    console.error("[commerce] Failed to load products:", error);
    return NextResponse.json({ error: "Failed to load commerce products" }, { status: 500 });
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
    const financials: CommerceProductDraft["financials"] = {
      targetPrice: normalizeNumber(body.targetPrice),
      productionCost: normalizeNumber(body.productionCost),
      shippingCost: normalizeNumber(body.shippingCost),
      etsyFeeEstimate: normalizeNumber(body.etsyFeeEstimate),
      expectedMargin: null,
    };

    const product: CommerceProductDraft = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: VALID_STATUSES.has(body.status) ? body.status : "proposed",
      title,
      niche,
      sourceAgent: String(body.sourceAgent || "Manual entry").trim(),
      confidence: Math.max(0, Math.min(100, normalizeNumber(body.confidence) ?? 60)),
      trendBrief: {
        summary: String(body.trendSummary || "").trim(),
        evidence: normalizeEvidence(body.trendEvidence),
        seasonality: String(body.seasonality || "").trim(),
        competition: String(body.competition || "").trim(),
      },
      mockupNotes: String(body.mockupNotes || "").trim(),
      pricingAssumptions: String(body.pricingAssumptions || "").trim(),
      financials: {
        ...financials,
        expectedMargin: calculateMargin(financials),
      },
      tags: normalizeTags(body.tags),
      riskNotes: String(body.riskNotes || "").trim(),
      etsyCopy: {
        title: String(body.etsyTitle || title).trim(),
        description: String(body.etsyDescription || "").trim(),
        seoNotes: String(body.seoNotes || "").trim(),
      },
      external: {
        publishingEnabled: false,
        etsyStatus: "disabled",
        printifyStatus: "disabled",
      },
      auditTrail: [makeAudit("created", "Product suggestion created locally. No external commerce action was taken.")],
    };

    const store = await loadStore();
    store.products.unshift(product);
    await saveStore(store);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("[commerce] Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create commerce product" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = body.status as CommerceStatus;
    const note = String(body.note || "").trim();

    if (!id || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Missing or invalid id/status" }, { status: 400 });
    }

    if (REVIEW_STATUSES.has(status) && !note) {
      return NextResponse.json({ error: "A review note is required for approval decisions" }, { status: 400 });
    }

    const store = await loadStore();
    const product = store.products.find((item) => item.id === id);

    if (!product) {
      return NextResponse.json({ error: "Commerce product not found" }, { status: 404 });
    }

    product.status = status;
    product.updatedAt = new Date().toISOString();
    product.auditTrail.unshift(
      makeAudit(
        status === "approved"
          ? "approved"
          : status === "rejected"
            ? "rejected"
            : status === "revision"
              ? "revision-requested"
              : "updated",
        note || `Status changed to ${status}`,
      ),
    );

    await saveStore(store);

    return NextResponse.json(product);
  } catch (error) {
    console.error("[commerce] Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update commerce product" }, { status: 500 });
  }
}
