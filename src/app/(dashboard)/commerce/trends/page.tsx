"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Columns3,
  KeyRound,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TrendStatus = "watching" | "promising" | "converted" | "dismissed" | "archived";

interface TrendEvidence {
  source: string;
  signal: string;
  url: string;
  observedAt: string;
}

interface TrendAuditEntry {
  id: string;
  timestamp: string;
  action: string;
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

interface TrendResponse {
  briefs: TrendBrief[];
  stats: {
    total: number;
    watching: number;
    promising: number;
    converted: number;
    averageOpportunity: number;
  };
}

interface BriefFormState {
  title: string;
  sourceAgent: string;
  marketplace: TrendBrief["marketplace"];
  niche: string;
  summary: string;
  evidence: string;
  keywords: string;
  suggestedProducts: string;
  seasonality: string;
  competition: string;
  riskNotes: string;
  confidence: string;
  opportunityScore: string;
}

const EMPTY_BRIEF: BriefFormState = {
  title: "",
  sourceAgent: "Trend Scout",
  marketplace: "etsy",
  niche: "",
  summary: "",
  evidence: "",
  keywords: "",
  suggestedProducts: "",
  seasonality: "",
  competition: "",
  riskNotes: "",
  confidence: "60",
  opportunityScore: "50",
};

const statusStyles: Record<TrendStatus, { label: string; color: string; bg: string }> = {
  watching: { label: "Watching", color: "var(--info)", bg: "var(--info-soft)" },
  promising: { label: "Promising", color: "var(--warning)", bg: "var(--warning-soft)" },
  converted: { label: "Converted", color: "var(--positive)", bg: "var(--positive-soft)" },
  dismissed: { label: "Dismissed", color: "var(--negative)", bg: "var(--negative-soft)" },
  archived: { label: "Archived", color: "var(--text-secondary)", bg: "var(--surface-elevated)" },
};

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function buildSuggestionHref(trend: TrendBrief) {
  const productAngle = trend.suggestedProducts[0] ? titleCase(trend.suggestedProducts[0]) : "Product Concept";
  const params = new URLSearchParams({
    fromTrend: "1",
    title: `${productAngle} - ${trend.title}`,
    niche: trend.niche,
    sourceAgent: trend.sourceAgent,
    confidence: String(trend.confidence),
    trendSummary: trend.summary,
    trendEvidence: trend.evidence.map((item) => item.signal).join("\n"),
    seasonality: trend.seasonality,
    competition: trend.competition,
    tags: trend.keywords.join(", "),
    riskNotes: trend.riskNotes,
    etsyTitle: `${productAngle} for ${trend.niche}`,
    seoNotes: `Seeded from trend brief: ${trend.title}. Keywords: ${trend.keywords.join(", ")}`,
  });

  return `/commerce?${params.toString()}`;
}

function MetricTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Search;
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

export default function CommerceTrendsPage() {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [brief, setBrief] = useState<BriefFormState>(EMPTY_BRIEF);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const briefs = useMemo(() => data?.briefs ?? [], [data?.briefs]);
  const stats = data?.stats ?? { total: 0, watching: 0, promising: 0, converted: 0, averageOpportunity: 0 };

  const loadTrends = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/commerce/trends");
      const nextData = await response.json();
      if (!response.ok) throw new Error(nextData?.error || "Failed to load trend briefs");
      setData(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trend briefs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const updateBrief = (field: keyof BriefFormState, value: string) => {
    setBrief((current) => ({ ...current, [field]: value }));
  };

  const createBrief = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to create trend brief");
      setBrief(EMPTY_BRIEF);
      setNotice("Trend brief saved locally.");
      await loadTrends();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trend brief");
    } finally {
      setIsSaving(false);
    }
  };

  const setStatus = async (trend: TrendBrief, status: TrendStatus) => {
    const note = decisionNotes[trend.id]?.trim() ?? "";
    setUpdatingId(trend.id);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce/trends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trend.id, status, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to update trend brief");
      setDecisionNotes((current) => ({ ...current, [trend.id]: "" }));
      setNotice(`${trend.title} marked ${statusStyles[status].label.toLowerCase()}.`);
      await loadTrends();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trend brief");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            Trend Research Briefs
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", maxWidth: "760px" }}>
            Local Etsy and fulfillment trend evidence for agents to turn into product suggestions. No marketplace writes happen here.
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
          <Link className="btn-outline" href="/commerce/integrations">
            <KeyRound className="w-4 h-4" />
            Integrations
          </Link>
          <Link className="btn-outline" href="/commerce">
            <Store className="w-4 h-4" />
            Commerce Studio
          </Link>
          <button className="btn-outline" onClick={loadTrends} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricTile icon={Search} label="Briefs" value={stats.total} color="var(--info)" />
        <MetricTile icon={ClipboardList} label="Watching" value={stats.watching} color="var(--info)" />
        <MetricTile icon={Lightbulb} label="Promising" value={stats.promising} color="var(--warning)" />
        <MetricTile icon={CheckCircle2} label="Converted" value={stats.converted} color="var(--positive)" />
        <MetricTile icon={ShieldAlert} label="Avg. Opportunity" value={`${stats.averageOpportunity}%`} color="var(--warning)" />
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

      <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
        <form className="card" onSubmit={createBrief} style={{ borderRadius: "8px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>New Trend Brief</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Add researched signals before creating product suggestions.
            </p>
          </div>

          <Field label="Title" value={brief.title} onChange={(value) => updateBrief("title", value)} placeholder="AI Builder Desk Setup Gifts" required />
          <Field label="Niche" value={brief.niche} onChange={(value) => updateBrief("niche", value)} placeholder="AI builders and automation hobbyists" required />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Source Agent" value={brief.sourceAgent} onChange={(value) => updateBrief("sourceAgent", value)} />
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Marketplace</span>
              <select className="input" value={brief.marketplace} onChange={(event) => updateBrief("marketplace", event.target.value)}>
                <option value="etsy">Etsy</option>
                <option value="printify">Printify</option>
                <option value="manual">Manual</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <Field label="Summary" value={brief.summary} onChange={(value) => updateBrief("summary", value)} multiline />
          <Field label="Evidence" value={brief.evidence} onChange={(value) => updateBrief("evidence", value)} placeholder="One signal per line" multiline />
          <Field label="Keywords" value={brief.keywords} onChange={(value) => updateBrief("keywords", value)} placeholder="desk setup, developer gift, ai workflow" />
          <Field label="Suggested Products" value={brief.suggestedProducts} onChange={(value) => updateBrief("suggestedProducts", value)} placeholder="desk mat, notebook, wall print" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Confidence" value={brief.confidence} onChange={(value) => updateBrief("confidence", value)} placeholder="72" />
            <Field label="Opportunity Score" value={brief.opportunityScore} onChange={(value) => updateBrief("opportunityScore", value)} placeholder="68" />
          </div>
          <Field label="Seasonality" value={brief.seasonality} onChange={(value) => updateBrief("seasonality", value)} />
          <Field label="Competition" value={brief.competition} onChange={(value) => updateBrief("competition", value)} multiline />
          <Field label="Risk Notes" value={brief.riskNotes} onChange={(value) => updateBrief("riskNotes", value)} multiline />

          <button className="btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Save Brief
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isLoading ? (
            <div className="card" style={{ borderRadius: "8px", padding: "40px", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : briefs.length === 0 ? (
            <div className="card" style={{ borderRadius: "8px", padding: "28px", color: "var(--text-secondary)" }}>
              No trend briefs yet.
            </div>
          ) : (
            briefs.map((trend) => {
              const status = statusStyles[trend.status];
              const isUpdating = updatingId === trend.id;

              return (
                <article key={trend.id} className="card" style={{ borderRadius: "8px", padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>{trend.title}</h2>
                        <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
                          {status.label}
                        </span>
                        <span className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                          {trend.opportunityScore}% opportunity
                        </span>
                        <span className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                          {trend.confidence}% confidence
                        </span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                        {trend.marketplace.toUpperCase()} · {trend.niche} · sourced by {trend.sourceAgent}
                      </p>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {formatDistanceToNow(new Date(trend.updatedAt), { addSuffix: true })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: "16px" }}>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Summary</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>{trend.summary || "No summary yet."}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Evidence</p>
                      {trend.evidence.length > 0 ? (
                        <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px", paddingLeft: "18px" }}>
                          {trend.evidence.slice(0, 4).map((item) => (
                            <li key={`${item.source}-${item.signal}`}>{item.signal}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>No evidence captured.</p>
                      )}
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Products</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>
                        {trend.suggestedProducts.join(", ") || "No product angles yet."}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Risk</p>
                      <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "4px" }}>{trend.riskNotes || "No risk notes yet."}</p>
                    </div>
                  </div>

                  {trend.keywords.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "14px" }}>
                      {trend.keywords.map((keyword) => (
                        <span key={keyword} className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      className="input"
                      value={decisionNotes[trend.id] ?? ""}
                      onChange={(event) => setDecisionNotes((current) => ({ ...current, [trend.id]: event.target.value }))}
                      placeholder="Decision note required for convert, dismiss, or archive"
                      rows={2}
                      style={{ resize: "vertical" }}
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => setStatus(trend, "watching")}>
                        <ClipboardList className="w-4 h-4" />
                        Watch
                      </button>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => setStatus(trend, "promising")}>
                        <Lightbulb className="w-4 h-4" />
                        Promising
                      </button>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => setStatus(trend, "converted")}>
                        <CheckCircle2 className="w-4 h-4" />
                        Converted
                      </button>
                      <Link className="btn-primary" href={buildSuggestionHref(trend)}>
                        <Store className="w-4 h-4" />
                        Create Suggestion
                      </Link>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => setStatus(trend, "archived")}>
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                      <button className="btn-danger" type="button" disabled={isUpdating} onClick={() => setStatus(trend, "dismissed")}>
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Dismiss
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
