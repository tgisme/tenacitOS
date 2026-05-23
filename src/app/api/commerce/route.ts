import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type CommerceStatus = "draft" | "needs-review" | "approved" | "rejected" | "revision";
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
  mockupNotes: string;
  pricingAssumptions: string;
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
  };
  auditTrail: CommerceAuditEntry[];
}

interface CommerceStore {
  products: CommerceProductDraft[];
}

const DATA_PATH = path.join(process.cwd(), "data", "commerce-products.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-products.example.json");
const VALID_STATUSES = new Set<CommerceStatus>(["draft", "needs-review", "approved", "rejected", "revision"]);

async function loadStore(): Promise<CommerceStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CommerceStore;
    return { products: Array.isArray(parsed.products) ? parsed.products : [] };
  } catch {
    try {
      const raw = await fs.readFile(EXAMPLE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as CommerceStore;
      return { products: Array.isArray(parsed.products) ? parsed.products : [] };
    } catch {
      return { products: [] };
    }
  }
}

async function saveStore(store: CommerceStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 13);
  }

  if (typeof value === "string") {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 13);
  }

  return [];
}

function makeAudit(action: CommerceAuditAction, note: string): CommerceAuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    note,
  };
}

function getStats(products: CommerceProductDraft[]) {
  return {
    total: products.length,
    needsReview: products.filter((product) => product.status === "needs-review").length,
    approved: products.filter((product) => product.status === "approved").length,
    blockedExternalActions: products.filter((product) => product.external.publishingEnabled === false).length,
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
    const product: CommerceProductDraft = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: body.status === "draft" ? "draft" : "needs-review",
      title,
      niche,
      mockupNotes: String(body.mockupNotes || "").trim(),
      pricingAssumptions: String(body.pricingAssumptions || "").trim(),
      tags: normalizeTags(body.tags),
      riskNotes: String(body.riskNotes || "").trim(),
      etsyCopy: {
        title: String(body.etsyTitle || title).trim(),
        description: String(body.etsyDescription || "").trim(),
        seoNotes: String(body.seoNotes || "").trim(),
      },
      external: {
        publishingEnabled: false,
      },
      auditTrail: [makeAudit("created", "Local draft created. No external commerce action was taken.")],
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

    if ((status === "approved" || status === "rejected" || status === "revision") && !note) {
      return NextResponse.json({ error: "A review note is required for approval decisions" }, { status: 400 });
    }

    const store = await loadStore();
    const product = store.products.find((item) => item.id === id);

    if (!product) {
      return NextResponse.json({ error: "Commerce product not found" }, { status: 404 });
    }

    product.status = status;
    product.updatedAt = new Date().toISOString();
    product.auditTrail.unshift(makeAudit(
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "revision" ? "revision-requested" : "updated",
      note || `Status changed to ${status}`,
    ));

    await saveStore(store);

    return NextResponse.json(product);
  } catch (error) {
    console.error("[commerce] Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update commerce product" }, { status: 500 });
  }
}
