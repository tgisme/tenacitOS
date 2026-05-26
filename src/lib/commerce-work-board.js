import fs from "fs/promises";
import path from "path";
import { findOpenCommerceTaskForItem, loadLocalTasks } from "./commerce-work-board-tasks.js";

const PRODUCTS_PATH = path.join(process.cwd(), "data", "commerce-products.json");
const PRODUCTS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-products.example.json");
const TRENDS_PATH = path.join(process.cwd(), "data", "commerce-trends.json");
const TRENDS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-trends.example.json");
const APPROVALS_PATH = path.join(process.cwd(), "data", "commerce-approvals.json");
const APPROVALS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-approvals.example.json");
const INTEGRATIONS_PATH = path.join(process.cwd(), "data", "commerce-integrations.json");
const INTEGRATIONS_EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-integrations.example.json");

async function readJson(dataPath, examplePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(dataPath, "utf-8"));
  } catch {
    try {
      return JSON.parse(await fs.readFile(examplePath, "utf-8"));
    } catch {
      return fallback;
    }
  }
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function asDateString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatMargin(value) {
  return value === null || value === undefined ? "Margin n/a" : `Margin $${value}`;
}

function formatCurrency(value) {
  return value === null || value === undefined ? "n/a" : `$${value}`;
}

function formatBoolean(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined || value === "" ? "n/a" : String(value);
}

function normalizeAuditTrail(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => ({
      timestamp: asDateString(entry.timestamp),
      action: asString(entry.action, "updated"),
      note: asString(entry.note, "No note recorded."),
    }))
    .filter((entry) => entry.note)
    .slice(0, 5);
}

function formatTrendEvidence(value) {
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

function sortByPriority(items) {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });
}

function productDetail(product) {
  return {
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
      asString(product.trendBrief?.competition) ? `Competition: ${product.trendBrief.competition}` : "",
      asString(product.trendBrief?.seasonality) ? `Seasonality: ${product.trendBrief.seasonality}` : "",
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
  };
}

function approvalDetail(approval) {
  return {
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
  };
}

export function buildCommerceWorkBoardPayload({ products = [], trends = [], approvals = [], integrations = [], localTasks = [] }) {
  const withLocalTask = (item) => ({
    ...item,
    localTask: findOpenCommerceTaskForItem(localTasks, item) ?? null,
  });

  const researchItems = trends
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
    }))
    .map(withLocalTask);

  const productReviewItems = products
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
      detail: productDetail(product),
    }))
    .map(withLocalTask);

  const approvalItems = approvals
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
      detail: approvalDetail(approval),
    }))
    .map(withLocalTask);

  const setupItems = integrations
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
    }))
    .map(withLocalTask);

  const readyItems = [
    ...products
      .filter((product) => ["approved", "published", "selling"].includes(product.status))
      .map((product) => ({
        id: `ready-product-${product.id}`,
        kind: "product",
        title: asString(product.title, "Untitled product"),
        status: product.status,
        subtitle: asString(product.niche, "Uncategorized"),
        nextAction: "Continue local listing, mockup, or cost work without publishing externally.",
        updatedAt: asDateString(product.updatedAt),
        href: "/commerce",
        priority: asNumber(product.confidence),
        meta: [formatMargin(product.financials?.expectedMargin)],
        detail: productDetail(product),
      }))
      .map(withLocalTask),
    ...approvals
      .filter((approval) => ["approved", "executed-locally"].includes(approval.status))
      .map((approval) => ({
        id: `ready-approval-${approval.id}`,
        kind: "approval",
        title: asString(approval.productTitle, "Untitled product"),
        status: approval.status,
        subtitle: asString(approval.requestedAction, "Approved action"),
        nextAction: "Use this approval as local evidence only; external execution still needs explicit approval.",
        updatedAt: asDateString(approval.updatedAt),
        href: "/commerce/approvals",
        priority: 70,
        meta: [approval.blockedExternalAction ? "External action still blocked" : "Local execution recorded"],
        detail: approvalDetail(approval),
      }))
      .map(withLocalTask),
  ];

  return {
    columns: [
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
    ],
    stats: {
      openResearch: researchItems.length,
      reviewQueue: productReviewItems.length + approvalItems.length,
      setupBlockers: setupItems.length,
      readyLocalWork: readyItems.length,
    },
    guardrail: "This board is read-only. It summarizes local commerce work and does not publish, spend money, or change any external shop.",
  };
}

export async function loadCommerceWorkBoardPayload() {
  const [productStore, trendStore, approvalStore, integrationStore, localTasks] = await Promise.all([
    readJson(PRODUCTS_PATH, PRODUCTS_EXAMPLE_PATH, { products: [] }),
    readJson(TRENDS_PATH, TRENDS_EXAMPLE_PATH, { briefs: [] }),
    readJson(APPROVALS_PATH, APPROVALS_EXAMPLE_PATH, { records: [] }),
    readJson(INTEGRATIONS_PATH, INTEGRATIONS_EXAMPLE_PATH, { providers: [] }),
    loadLocalTasks(),
  ]);

  return buildCommerceWorkBoardPayload({
    products: Array.isArray(productStore.products) ? productStore.products : [],
    trends: Array.isArray(trendStore.briefs) ? trendStore.briefs : [],
    approvals: Array.isArray(approvalStore.records) ? approvalStore.records : [],
    integrations: Array.isArray(integrationStore.providers) ? integrationStore.providers : [],
    localTasks,
  });
}
