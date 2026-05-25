import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

type ProductStatus =
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

type TrendStatus = "watching" | "promising" | "converted" | "dismissed" | "archived";
type ApprovalStatus = "requested" | "approved" | "rejected" | "needs-revision" | "executed-locally";

interface ProductSummary {
  id: string;
  title: string;
  status: ProductStatus;
  niche: string;
  sourceAgent: string;
  confidence: number;
  updatedAt: string;
  financials?: {
    expectedMargin?: number | null;
  };
}

interface TrendSummary {
  id: string;
  title: string;
  status: TrendStatus;
  niche: string;
  opportunityScore: number;
  updatedAt: string;
  linkedProductIds: string[];
}

interface ApprovalSummary {
  id: string;
  status: ApprovalStatus;
  productId: string;
  productTitle: string;
  requestedAction: string;
  updatedAt: string;
  blockedExternalAction: boolean;
}

interface IntegrationSummary {
  id: string;
  name: string;
  status: string;
  blockedActions: string[];
  nextStep: string;
}

interface WorkBoardItem {
  id: string;
  kind: "trend" | "product" | "approval" | "integration";
  title: string;
  status: string;
  subtitle: string;
  nextAction: string;
  updatedAt: string | null;
  href: string;
  priority: number;
  meta: string[];
}

interface WorkBoardColumn {
  id: "research" | "review" | "setup" | "ready";
  title: string;
  description: string;
  items: WorkBoardItem[];
}

const PRODUCTS_PATH = path.join(process.cwd(), "data", "commerce-products.json");
const PRODUCTS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-products.example.json");
const TRENDS_PATH = path.join(process.cwd(), "data", "commerce-trends.json");
const TRENDS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-trends.example.json");
const APPROVALS_PATH = path.join(process.cwd(), "data", "commerce-approvals.json");
const APPROVALS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-approvals.example.json");
const INTEGRATIONS_PATH = path.join(process.cwd(), "data", "commerce-integrations.json");
const INTEGRATIONS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-integrations.example.json");

async function readJson<T>(dataPath: string, examplePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(dataPath, "utf-8")) as T;
  } catch {
    try {
      return JSON.parse(await fs.readFile(examplePath, "utf-8")) as T;
    } catch {
      return fallback;
    }
  }
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function asDateString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatMargin(value: number | null | undefined) {
  return value === null || value === undefined ? "Margin n/a" : `Margin $${value}`;
}

function sortByPriority(items: WorkBoardItem[]) {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });
}

export async function GET() {
  try {
    const [productStore, trendStore, approvalStore, integrationStore] = await Promise.all([
      readJson<{ products?: ProductSummary[] }>(PRODUCTS_PATH, PRODUCTS_EXAMPLE_PATH, { products: [] }),
      readJson<{ briefs?: TrendSummary[] }>(TRENDS_PATH, TRENDS_EXAMPLE_PATH, { briefs: [] }),
      readJson<{ records?: ApprovalSummary[] }>(APPROVALS_PATH, APPROVALS_EXAMPLE_PATH, { records: [] }),
      readJson<{ providers?: IntegrationSummary[] }>(INTEGRATIONS_PATH, INTEGRATIONS_EXAMPLE_PATH, { providers: [] }),
    ]);

    const products = Array.isArray(productStore.products) ? productStore.products : [];
    const trends = Array.isArray(trendStore.briefs) ? trendStore.briefs : [];
    const approvals = Array.isArray(approvalStore.records) ? approvalStore.records : [];
    const integrations = Array.isArray(integrationStore.providers) ? integrationStore.providers : [];

    const researchItems: WorkBoardItem[] = trends
      .filter((trend) => ["watching", "promising"].includes(trend.status))
      .map((trend) => ({
        id: `trend-${trend.id}`,
        kind: "trend",
        title: asString(trend.title, "Untitled trend"),
        status: trend.status,
        subtitle: asString(trend.niche, "Uncategorized"),
        nextAction: trend.status === "promising" ? "Convert into a product draft or dismiss with notes." : "Add evidence until this has enough signal to convert.",
        updatedAt: asDateString(trend.updatedAt),
        href: "/commerce/trends",
        priority: asNumber(trend.opportunityScore),
        meta: [`Opportunity ${asNumber(trend.opportunityScore)}%`, `${asStringArray(trend.linkedProductIds).length} linked products`],
      }));

    const productReviewItems: WorkBoardItem[] = products
      .filter((product) => ["proposed", "listing-ready", "needs-review", "revision"].includes(product.status))
      .map((product) => ({
        id: `product-${product.id}`,
        kind: "product",
        title: asString(product.title, "Untitled product"),
        status: product.status,
        subtitle: `${asString(product.niche, "Uncategorized")} · ${asString(product.sourceAgent, "Manual entry")}`,
        nextAction: product.status === "revision" ? "Resolve requested changes and return it to review." : "Review copy, risk notes, and margin before approving or rejecting.",
        updatedAt: asDateString(product.updatedAt),
        href: "/commerce",
        priority: asNumber(product.confidence),
        meta: [`Confidence ${asNumber(product.confidence)}%`, formatMargin(product.financials?.expectedMargin)],
      }));

    const approvalItems: WorkBoardItem[] = approvals
      .filter((approval) => ["requested", "needs-revision"].includes(approval.status))
      .map((approval) => ({
        id: `approval-${approval.id}`,
        kind: "approval",
        title: asString(approval.productTitle, "Untitled product"),
        status: approval.status,
        subtitle: asString(approval.requestedAction, "Review requested"),
        nextAction: approval.blockedExternalAction ? "Approve only the local preparation step; external writes stay blocked." : "Approve, reject, or request revision in the ledger.",
        updatedAt: asDateString(approval.updatedAt),
        href: "/commerce/approvals",
        priority: approval.blockedExternalAction ? 90 : 60,
        meta: [approval.blockedExternalAction ? "External action blocked" : "Local action", asString(approval.productId, "No product id")],
      }));

    const setupItems: WorkBoardItem[] = integrations
      .filter((provider) => provider.status !== "healthy")
      .map((provider) => ({
        id: `integration-${provider.id}`,
        kind: "integration",
        title: asString(provider.name, "Unknown provider"),
        status: provider.status,
        subtitle: asString(provider.nextStep, "Configure provider"),
        nextAction: "Complete the setup checklist before enabling any marketplace or fulfillment writes.",
        updatedAt: null,
        href: "/commerce/integrations",
        priority: asStringArray(provider.blockedActions).length,
        meta: [`${asStringArray(provider.blockedActions).length} blocked actions`],
      }));

    const readyItems: WorkBoardItem[] = [
      ...products
        .filter((product) => ["approved", "published", "selling"].includes(product.status))
        .map((product) => ({
          id: `ready-product-${product.id}`,
          kind: "product" as const,
          title: asString(product.title, "Untitled product"),
          status: product.status,
          subtitle: asString(product.niche, "Uncategorized"),
          nextAction: "Continue local listing, mockup, or cost work without publishing externally.",
          updatedAt: asDateString(product.updatedAt),
          href: "/commerce",
          priority: asNumber(product.confidence),
          meta: [formatMargin(product.financials?.expectedMargin)],
        })),
      ...approvals
        .filter((approval) => ["approved", "executed-locally"].includes(approval.status))
        .map((approval) => ({
          id: `ready-approval-${approval.id}`,
          kind: "approval" as const,
          title: asString(approval.productTitle, "Untitled product"),
          status: approval.status,
          subtitle: asString(approval.requestedAction, "Approved action"),
          nextAction: "Use this approval as local evidence only; external execution still needs explicit approval.",
          updatedAt: asDateString(approval.updatedAt),
          href: "/commerce/approvals",
          priority: 70,
          meta: [approval.blockedExternalAction ? "External action still blocked" : "Local execution recorded"],
        })),
    ];

    const columns: WorkBoardColumn[] = [
      {
        id: "research",
        title: "Research",
        description: "Trend briefs with enough signal to watch or convert into product ideas.",
        items: sortByPriority(researchItems),
      },
      {
        id: "review",
        title: "Review",
        description: "Product ideas and approval requests that need a human decision.",
        items: sortByPriority([...productReviewItems, ...approvalItems]),
      },
      {
        id: "setup",
        title: "Setup Blockers",
        description: "Commerce integrations that still prevent real marketplace or fulfillment writes.",
        items: sortByPriority(setupItems),
      },
      {
        id: "ready",
        title: "Approved Local Work",
        description: "Approved items that can continue locally while external actions stay gated.",
        items: sortByPriority(readyItems),
      },
    ];

    return NextResponse.json({
      columns,
      stats: {
        openResearch: researchItems.length,
        reviewQueue: productReviewItems.length + approvalItems.length,
        setupBlockers: setupItems.length,
        readyLocalWork: readyItems.length,
      },
      guardrail: "This board is read-only. It summarizes local commerce work and does not publish, spend money, or change any external shop.",
    });
  } catch (error) {
    console.error("[commerce-work-board] Failed to load work board:", error);
    return NextResponse.json({ error: "Failed to load commerce work board" }, { status: 500 });
  }
}
