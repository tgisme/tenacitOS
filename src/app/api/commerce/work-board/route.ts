import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createOrFindCommerceTask } from "@/lib/commerce-work-board-tasks";

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
  createdAt?: string;
  title: string;
  status: ProductStatus;
  niche: string;
  sourceAgent: string;
  confidence: number;
  updatedAt: string;
  trendBrief?: {
    summary?: string;
    evidence?: string[];
    seasonality?: string;
    competition?: string;
  };
  mockupNotes?: string;
  pricingAssumptions?: string;
  financials?: {
    targetPrice?: number | null;
    productionCost?: number | null;
    shippingCost?: number | null;
    etsyFeeEstimate?: number | null;
    expectedMargin?: number | null;
  };
  tags?: string[];
  riskNotes?: string;
  etsyCopy?: {
    title?: string;
    description?: string;
    seoNotes?: string;
  };
  auditTrail?: AuditEntry[];
}

interface TrendSummary {
  id: string;
  createdAt?: string;
  title: string;
  status: TrendStatus;
  sourceAgent?: string;
  marketplace?: string;
  niche: string;
  summary?: string;
  evidence?: Array<string | { source?: string; signal?: string; url?: string; observedAt?: string }>;
  keywords?: string[];
  suggestedProducts?: string[];
  seasonality?: string;
  competition?: string;
  riskNotes?: string;
  confidence?: number;
  opportunityScore: number;
  updatedAt: string;
  linkedProductIds: string[];
  auditTrail?: AuditEntry[];
}

interface ApprovalSummary {
  id: string;
  createdAt?: string;
  status: ApprovalStatus;
  productId: string;
  productTitle: string;
  requestedAction: string;
  reviewer?: string;
  decisionNote?: string;
  riskChecks?: string[];
  updatedAt: string;
  blockedExternalAction: boolean;
  auditTrail?: AuditEntry[];
}

interface IntegrationSummary {
  id: string;
  name: string;
  status: string;
  mode?: string;
  authMode?: string;
  lastSyncAt?: string | null;
  blockedActions: string[];
  nextStep: string;
  capabilities?: string[];
  approvalRules?: string[];
  health?: Record<string, boolean | string | null>;
}

interface AuditEntry {
  id?: string;
  timestamp?: string;
  action?: string;
  note?: string;
}

interface WorkBoardDetail {
  summary: string;
  evidence: string[];
  riskNotes: string[];
  pricing: Array<{ label: string; value: string }>;
  auditTrail: Array<{ timestamp: string | null; action: string; note: string }>;
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
  detail: WorkBoardDetail;
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

function formatCurrency(value: number | null | undefined) {
  return value === null || value === undefined ? "n/a" : `$${value}`;
}

function formatBoolean(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined || value === "" ? "n/a" : String(value);
}

function normalizeAuditTrail(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const raw = entry as AuditEntry;
      return {
        timestamp: asDateString(raw.timestamp),
        action: asString(raw.action, "updated"),
        note: asString(raw.note, "No note recorded."),
      };
    })
    .filter((entry) => entry.note)
    .slice(0, 5);
}

function formatTrendEvidence(value: TrendSummary["evidence"]) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      const signal = asString(entry.signal);
      const source = asString(entry.source);
      return [source, signal].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .slice(0, 6);
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
        detail: {
          summary: asString(trend.summary, "No trend summary recorded yet."),
          evidence: [
            ...formatTrendEvidence(trend.evidence),
            ...asStringArray(trend.keywords).slice(0, 4).map((keyword) => `Keyword: ${keyword}`),
            ...asStringArray(trend.suggestedProducts).slice(0, 3).map((product) => `Suggested product: ${product}`),
          ].slice(0, 8),
          riskNotes: [
            asString(trend.riskNotes),
            asString(trend.competition) ? `Competition: ${trend.competition}` : "",
            asString(trend.seasonality) ? `Seasonality: ${trend.seasonality}` : "",
          ].filter(Boolean),
          pricing: [
            { label: "Opportunity", value: `${asNumber(trend.opportunityScore)}%` },
            { label: "Confidence", value: `${asNumber(trend.confidence)}%` },
            { label: "Marketplace", value: asString(trend.marketplace, "n/a") },
            { label: "Source", value: asString(trend.sourceAgent, "Manual entry") },
          ],
          auditTrail: normalizeAuditTrail(trend.auditTrail),
        },
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
        detail: {
          summary: asString(product.trendBrief?.summary, asString(product.etsyCopy?.description, "No product summary recorded yet.")),
          evidence: [
            ...asStringArray(product.trendBrief?.evidence),
            asString(product.mockupNotes) ? `Mockup: ${product.mockupNotes}` : "",
            asString(product.etsyCopy?.title) ? `Listing title: ${product.etsyCopy?.title}` : "",
            asString(product.etsyCopy?.seoNotes) ? `SEO: ${product.etsyCopy?.seoNotes}` : "",
            ...asStringArray(product.tags).slice(0, 5).map((tag) => `Tag: ${tag}`),
          ].filter(Boolean).slice(0, 8),
          riskNotes: [
            asString(product.riskNotes),
            asString(product.trendBrief?.competition) ? `Competition: ${product.trendBrief?.competition}` : "",
            asString(product.trendBrief?.seasonality) ? `Seasonality: ${product.trendBrief?.seasonality}` : "",
          ].filter(Boolean),
          pricing: [
            { label: "Target price", value: formatCurrency(product.financials?.targetPrice) },
            { label: "Production", value: formatCurrency(product.financials?.productionCost) },
            { label: "Shipping", value: formatCurrency(product.financials?.shippingCost) },
            { label: "Etsy fees", value: formatCurrency(product.financials?.etsyFeeEstimate) },
            { label: "Expected margin", value: formatCurrency(product.financials?.expectedMargin) },
            { label: "Assumptions", value: asString(product.pricingAssumptions, "n/a") },
          ],
          auditTrail: normalizeAuditTrail(product.auditTrail),
        },
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
        detail: {
          summary: asString(approval.decisionNote, "Approval decision details are not recorded yet."),
          evidence: asStringArray(approval.riskChecks),
          riskNotes: [
            approval.blockedExternalAction ? "External commerce action remains blocked." : "Approved action is local-only.",
            asString(approval.productId) ? `Product id: ${approval.productId}` : "",
          ].filter(Boolean),
          pricing: [
            { label: "Requested action", value: asString(approval.requestedAction, "n/a") },
            { label: "Reviewer", value: asString(approval.reviewer, "Unassigned") },
            { label: "External write", value: approval.blockedExternalAction ? "Blocked" : "Not blocked" },
          ],
          auditTrail: normalizeAuditTrail(approval.auditTrail),
        },
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
        detail: {
          summary: asString(provider.nextStep, "Configure provider credentials and approval rules."),
          evidence: asStringArray(provider.capabilities).map((capability) => `Capability: ${capability}`),
          riskNotes: [...asStringArray(provider.blockedActions), ...asStringArray(provider.approvalRules)].slice(0, 8),
          pricing: [
            { label: "Mode", value: asString(provider.mode, "n/a") },
            { label: "Auth", value: asString(provider.authMode, "n/a") },
            { label: "Last sync", value: asString(provider.lastSyncAt, "Never") },
            { label: "Credentials", value: formatBoolean(provider.health?.credentialConfigured) },
            { label: "Read scope", value: formatBoolean(provider.health?.readScopeEnabled) },
            { label: "Write scope", value: formatBoolean(provider.health?.writeScopeEnabled) },
            { label: "Last error", value: formatBoolean(provider.health?.lastError) },
          ],
          auditTrail: [],
        },
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
          detail: {
            summary: asString(product.trendBrief?.summary, asString(product.etsyCopy?.description, "No product summary recorded yet.")),
            evidence: [
              ...asStringArray(product.trendBrief?.evidence),
              asString(product.mockupNotes) ? `Mockup: ${product.mockupNotes}` : "",
              asString(product.etsyCopy?.title) ? `Listing title: ${product.etsyCopy?.title}` : "",
              asString(product.etsyCopy?.seoNotes) ? `SEO: ${product.etsyCopy?.seoNotes}` : "",
              ...asStringArray(product.tags).slice(0, 5).map((tag) => `Tag: ${tag}`),
            ].filter(Boolean).slice(0, 8),
            riskNotes: [
              asString(product.riskNotes),
              asString(product.trendBrief?.competition) ? `Competition: ${product.trendBrief?.competition}` : "",
              asString(product.trendBrief?.seasonality) ? `Seasonality: ${product.trendBrief?.seasonality}` : "",
            ].filter(Boolean),
            pricing: [
              { label: "Target price", value: formatCurrency(product.financials?.targetPrice) },
              { label: "Production", value: formatCurrency(product.financials?.productionCost) },
              { label: "Shipping", value: formatCurrency(product.financials?.shippingCost) },
              { label: "Etsy fees", value: formatCurrency(product.financials?.etsyFeeEstimate) },
              { label: "Expected margin", value: formatCurrency(product.financials?.expectedMargin) },
              { label: "Assumptions", value: asString(product.pricingAssumptions, "n/a") },
            ],
            auditTrail: normalizeAuditTrail(product.auditTrail),
          },
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
          detail: {
            summary: asString(approval.decisionNote, "Approval decision details are not recorded yet."),
            evidence: asStringArray(approval.riskChecks),
            riskNotes: [
              approval.blockedExternalAction ? "External commerce action remains blocked." : "Approved action is local-only.",
              asString(approval.productId) ? `Product id: ${approval.productId}` : "",
            ].filter(Boolean),
            pricing: [
              { label: "Requested action", value: asString(approval.requestedAction, "n/a") },
              { label: "Reviewer", value: asString(approval.reviewer, "Unassigned") },
              { label: "External write", value: approval.blockedExternalAction ? "Blocked" : "Not blocked" },
            ],
            auditTrail: normalizeAuditTrail(approval.auditTrail),
          },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item = body?.item as Partial<WorkBoardItem> | undefined;

    if (!item?.id || !item.title || !item.kind || !item.nextAction || !item.href) {
      return NextResponse.json({ error: "Missing queue item fields" }, { status: 400 });
    }

    const result = await createOrFindCommerceTask(item);

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error("[commerce-work-board] Failed to create local task:", error);
    return NextResponse.json({ error: "Failed to create local commerce task" }, { status: 500 });
  }
}
