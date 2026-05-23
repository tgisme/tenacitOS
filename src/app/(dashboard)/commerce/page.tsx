"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Lightbulb,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

interface CommerceAuditEntry {
  id: string;
  timestamp: string;
  action: string;
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

interface CommerceResponse {
  products: CommerceProductDraft[];
  stats: {
    total: number;
    needsReview: number;
    approved: number;
    researching: number;
    published: number;
    blockedExternalActions: number;
    totalExpectedMargin: number;
  };
  externalIntegrations: {
    etsy: "disabled";
    printify: "disabled";
    reason: string;
  };
}

interface DraftFormState {
  title: string;
  niche: string;
  sourceAgent: string;
  confidence: string;
  trendSummary: string;
  trendEvidence: string;
  seasonality: string;
  competition: string;
  mockupNotes: string;
  pricingAssumptions: string;
  targetPrice: string;
  productionCost: string;
  shippingCost: string;
  etsyFeeEstimate: string;
  tags: string;
  riskNotes: string;
  etsyTitle: string;
  etsyDescription: string;
  seoNotes: string;
}

const EMPTY_DRAFT: DraftFormState = {
  title: "",
  niche: "",
  sourceAgent: "Manual entry",
  confidence: "60",
  trendSummary: "",
  trendEvidence: "",
  seasonality: "",
  competition: "",
  mockupNotes: "",
  pricingAssumptions: "",
  targetPrice: "",
  productionCost: "",
  shippingCost: "",
  etsyFeeEstimate: "",
  tags: "",
  riskNotes: "",
  etsyTitle: "",
  etsyDescription: "",
  seoNotes: "",
};

const statusStyles: Record<CommerceStatus, { label: string; color: string; bg: string }> = {
  researching: { label: "Researching", color: "var(--info)", bg: "var(--info-soft)" },
  proposed: { label: "Proposed", color: "var(--warning)", bg: "var(--warning-soft)" },
  designing: { label: "Designing", color: "var(--info)", bg: "var(--info-soft)" },
  "listing-ready": { label: "Listing Ready", color: "var(--warning)", bg: "var(--warning-soft)" },
  "needs-review": { label: "Needs Review", color: "var(--warning)", bg: "var(--warning-soft)" },
  approved: { label: "Approved", color: "var(--positive)", bg: "var(--positive-soft)" },
  published: { label: "Published", color: "var(--positive)", bg: "var(--positive-soft)" },
  selling: { label: "Selling", color: "var(--positive)", bg: "var(--positive-soft)" },
  paused: { label: "Paused", color: "var(--text-secondary)", bg: "var(--surface-elevated)" },
  rejected: { label: "Rejected", color: "var(--negative)", bg: "var(--negative-soft)" },
  revision: { label: "Revision", color: "var(--info)", bg: "var(--info-soft)" },
};

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ minWidth: "92px" }}>
      <p style={{ color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>{label}</p>
      <p style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: 700, marginTop: "3px" }}>{value}</p>
    </div>
  );
}

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

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>{label}</span>
      {multiline ? (
        <textarea
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          rows={4}
          style={{ resize: "vertical", minHeight: "96px" }}
        />
      ) : (
        <input
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}

export default function CommerceStudioPage() {
  const [data, setData] = useState<CommerceResponse | null>(null);
  const [draft, setDraft] = useState<DraftFormState>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const stats = data?.stats ?? {
    total: 0,
    needsReview: 0,
    approved: 0,
    researching: 0,
    published: 0,
    blockedExternalActions: 0,
    totalExpectedMargin: 0,
  };

  const latestAudit = useMemo(() => {
    return products
      .flatMap((product) => product.auditTrail.map((entry) => ({ ...entry, productTitle: product.title })))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [products]);

  const loadCommerce = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/commerce");
      const nextData = await response.json();
      if (!response.ok) throw new Error(nextData?.error || "Failed to load commerce products");
      setData(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commerce products");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommerce();
  }, [loadCommerce]);

  const updateDraft = (field: keyof DraftFormState, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const createDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to create suggestion");
      setDraft(EMPTY_DRAFT);
      setNotice("Product suggestion saved locally for review.");
      await loadCommerce();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suggestion");
    } finally {
      setIsSaving(false);
    }
  };

  const reviewProduct = async (product: CommerceProductDraft, status: CommerceStatus) => {
    const note = reviewNotes[product.id]?.trim() ?? "";
    setReviewingId(product.id);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, status, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to update review status");
      setReviewNotes((current) => ({ ...current, [product.id]: "" }));
      setNotice(`${product.title} marked ${statusStyles[status].label.toLowerCase()}.`);
      await loadCommerce();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update review status");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            Commerce Studio
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", maxWidth: "760px" }}>
            Product suggestions, Etsy trend evidence, margins, and approval decisions for the commerce autopilot.
            External publishing is intentionally disabled.
          </p>
        </div>
        <button className="btn-outline" onClick={loadCommerce} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricTile icon={Lightbulb} label="Suggestions" value={stats.total} color="var(--info)" />
        <MetricTile icon={Search} label="Researching" value={stats.researching} color="var(--info)" />
        <MetricTile icon={ClipboardList} label="Queue" value={stats.needsReview} color="var(--warning)" />
        <MetricTile icon={PackageCheck} label="Approved" value={stats.approved} color="var(--positive)" />
        <MetricTile icon={DollarSign} label="Est. Margin" value={formatMoney(stats.totalExpectedMargin)} color="var(--positive)" />
      </section>

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
          Etsy: {data?.externalIntegrations.etsy ?? "disabled"} · Printify: {data?.externalIntegrations.printify ?? "disabled"}
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          {data?.externalIntegrations.reason ?? "External integrations are disabled until credentials and approval rules are configured."}
        </span>
      </div>

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

      <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
        <form className="card" onSubmit={createDraft} style={{ borderRadius: "8px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>New Product Suggestion</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Capture an agent or manual product idea with trend evidence, cost assumptions, and Etsy listing copy.
            </p>
          </div>

          <Field label="Product Title" value={draft.title} onChange={(value) => updateDraft("title", value)} placeholder="AI Workflow Desk Mat" required />
          <Field label="Niche" value={draft.niche} onChange={(value) => updateDraft("niche", value)} placeholder="AI builders and automation hobbyists" required />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Source Agent" value={draft.sourceAgent} onChange={(value) => updateDraft("sourceAgent", value)} placeholder="Trend Scout" />
            <Field label="Confidence" value={draft.confidence} onChange={(value) => updateDraft("confidence", value)} placeholder="72" />
          </div>
          <Field label="Trend Summary" value={draft.trendSummary} onChange={(value) => updateDraft("trendSummary", value)} multiline />
          <Field label="Trend Evidence" value={draft.trendEvidence} onChange={(value) => updateDraft("trendEvidence", value)} placeholder="One evidence point per line" multiline />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Seasonality" value={draft.seasonality} onChange={(value) => updateDraft("seasonality", value)} />
            <Field label="Competition" value={draft.competition} onChange={(value) => updateDraft("competition", value)} />
          </div>
          <Field label="Mockup Notes" value={draft.mockupNotes} onChange={(value) => updateDraft("mockupNotes", value)} multiline />
          <Field label="Pricing Assumptions" value={draft.pricingAssumptions} onChange={(value) => updateDraft("pricingAssumptions", value)} multiline />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Price" value={draft.targetPrice} onChange={(value) => updateDraft("targetPrice", value)} placeholder="29.95" />
            <Field label="Production Cost" value={draft.productionCost} onChange={(value) => updateDraft("productionCost", value)} placeholder="12.50" />
            <Field label="Shipping Cost" value={draft.shippingCost} onChange={(value) => updateDraft("shippingCost", value)} placeholder="4.99" />
            <Field label="Etsy Fee Est." value={draft.etsyFeeEstimate} onChange={(value) => updateDraft("etsyFeeEstimate", value)} placeholder="2.70" />
          </div>
          <Field label="Tags" value={draft.tags} onChange={(value) => updateDraft("tags", value)} placeholder="ai workflow, desk setup, developer gift" />
          <Field label="Risk Notes" value={draft.riskNotes} onChange={(value) => updateDraft("riskNotes", value)} multiline />
          <Field label="Etsy Listing Title" value={draft.etsyTitle} onChange={(value) => updateDraft("etsyTitle", value)} />
          <Field label="Etsy Description" value={draft.etsyDescription} onChange={(value) => updateDraft("etsyDescription", value)} multiline />
          <Field label="SEO Notes" value={draft.seoNotes} onChange={(value) => updateDraft("seoNotes", value)} multiline />

          <button className="btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
            Save Suggestion
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isLoading ? (
            <div className="card" style={{ borderRadius: "8px", padding: "40px", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="card" style={{ borderRadius: "8px", padding: "28px", color: "var(--text-secondary)" }}>
              No product suggestions yet.
            </div>
          ) : (
            products.map((product) => {
              const status = statusStyles[product.status];
              const isReviewing = reviewingId === product.id;

              return (
                <article key={product.id} className="card" style={{ borderRadius: "8px", padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>{product.title}</h2>
                        <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
                          {status.label}
                        </span>
                        <span className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                          {product.confidence}% confidence
                        </span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                        {product.niche} · sourced by {product.sourceAgent}
                      </p>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {formatDistanceToNow(new Date(product.updatedAt), { addSuffix: true })}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "16px",
                      marginTop: "16px",
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "var(--surface-elevated)",
                    }}
                  >
                    <MiniStat label="Price" value={formatMoney(product.financials.targetPrice)} />
                    <MiniStat label="Cost" value={formatMoney(product.financials.productionCost)} />
                    <MiniStat label="Shipping" value={formatMoney(product.financials.shippingCost)} />
                    <MiniStat label="Etsy Fees" value={formatMoney(product.financials.etsyFeeEstimate)} />
                    <MiniStat label="Margin" value={formatMoney(product.financials.expectedMargin)} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: "16px" }}>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Trend Brief</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>{product.trendBrief.summary || "No trend summary yet."}</p>
                      {product.trendBrief.evidence.length > 0 && (
                        <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", paddingLeft: "18px" }}>
                          {product.trendBrief.evidence.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Mockup</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>{product.mockupNotes || "No mockup notes yet."}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Pricing</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>{product.pricingAssumptions || "No pricing assumptions yet."}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Etsy Copy</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px", fontWeight: 600 }}>{product.etsyCopy.title}</p>
                      <p className="line-clamp-3" style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>{product.etsyCopy.description || "No description drafted."}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Market Timing</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>
                        {product.trendBrief.seasonality || "No seasonality notes."}
                      </p>
                      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px" }}>
                        {product.trendBrief.competition || "No competition notes."}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Risk Notes</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>{product.riskNotes || "No risk notes yet."}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
                    <span className="badge" style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}>
                      Etsy {product.external.etsyStatus}
                    </span>
                    <span className="badge" style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}>
                      Printify {product.external.printifyStatus}
                    </span>
                    <span className="badge" style={{ backgroundColor: "var(--negative-soft)", color: "var(--negative)" }}>
                      Publishing blocked
                    </span>
                  </div>

                  {product.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "14px" }}>
                      {product.tags.map((tag) => (
                        <span key={tag} className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      className="input"
                      value={reviewNotes[product.id] ?? ""}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [product.id]: event.target.value }))}
                      placeholder="Review note required for approve, reject, or revision"
                      rows={2}
                      style={{ resize: "vertical" }}
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button className="btn-outline" type="button" disabled={isReviewing} onClick={() => reviewProduct(product, "needs-review")}>
                        <ClipboardList className="w-4 h-4" />
                        Needs Review
                      </button>
                      <button className="btn-outline" type="button" disabled={isReviewing} onClick={() => reviewProduct(product, "revision")}>
                        <RefreshCw className="w-4 h-4" />
                        Revision
                      </button>
                      <button className="btn-outline" type="button" disabled={isReviewing} onClick={() => reviewProduct(product, "approved")}>
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button className="btn-danger" type="button" disabled={isReviewing} onClick={() => reviewProduct(product, "rejected")}>
                        {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Reject
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Audit Trail</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {product.auditTrail.slice(0, 3).map((entry) => (
                        <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "var(--text-secondary)", fontSize: "12px" }}>
                          <span style={{ color: "var(--text-primary)" }}>{entry.note}</span>
                          <span style={{ whiteSpace: "nowrap" }}>{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {latestAudit.length > 0 && (
        <section className="card" style={{ borderRadius: "8px", padding: "18px" }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>Recent Commerce Activity</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {latestAudit.map((entry) => (
              <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "var(--text-secondary)", fontSize: "13px" }}>
                <span>
                  <strong style={{ color: "var(--text-primary)" }}>{entry.productTitle}</strong> · {entry.note}
                </span>
                <span style={{ whiteSpace: "nowrap" }}>{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
