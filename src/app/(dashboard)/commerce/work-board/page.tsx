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
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type WorkBoardKind = "trend" | "product" | "approval" | "integration";

interface WorkBoardItem {
  id: string;
  kind: WorkBoardKind;
  title: string;
  status: string;
  subtitle: string;
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

interface WorkBoardResponse {
  columns: WorkBoardColumn[];
  guardrail: string;
  stats: {
    openResearch: number;
    reviewQueue: number;
    setupBlockers: number;
    readyLocalWork: number;
  };
}

const kindStyles: Record<WorkBoardKind, { label: string; color: string; bg: string }> = {
  trend: { label: "Trend", color: "var(--info)", bg: "var(--info-soft)" },
  product: { label: "Product", color: "var(--warning)", bg: "var(--warning-soft)" },
  approval: { label: "Approval", color: "var(--positive)", bg: "var(--positive-soft)" },
  integration: { label: "Setup", color: "var(--negative)", bg: "var(--negative-soft)" },
};

function MetricTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Columns3;
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

function BoardCard({ item }: { item: WorkBoardItem }) {
  const kind = kindStyles[item.kind];

  return (
    <Link
      className="card"
      href={item.href}
      style={{
        borderRadius: "8px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: 700, lineHeight: 1.25 }}>{item.title}</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>{item.subtitle}</p>
        </div>
        <span className="badge" style={{ color: kind.color, backgroundColor: kind.bg }}>
          {kind.label}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <span className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
          {item.status}
        </span>
        {item.meta.map((meta) => (
          <span key={meta} className="badge" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
            {meta}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
        <span>Priority {item.priority}</span>
        <span>{item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : "Setup task"}</span>
      </div>
    </Link>
  );
}

export default function CommerceWorkBoardPage() {
  const [data, setData] = useState<WorkBoardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
  const stats = data?.stats ?? { openResearch: 0, reviewQueue: 0, setupBlockers: 0, readyLocalWork: 0 };

  const loadBoard = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/commerce/work-board");
      const nextData = await response.json();
      if (!response.ok) throw new Error(nextData?.error || "Failed to load work board");
      setData(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work board");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            Commerce Work Board
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", maxWidth: "760px" }}>
            A consolidated pipeline for trend research, product review, approval decisions, and integration blockers.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Link className="btn-outline" href="/commerce">
            <Store className="w-4 h-4" />
            Studio
          </Link>
          <Link className="btn-outline" href="/commerce/trends">
            <Search className="w-4 h-4" />
            Trends
          </Link>
          <Link className="btn-outline" href="/commerce/approvals">
            <ClipboardList className="w-4 h-4" />
            Approvals
          </Link>
          <Link className="btn-outline" href="/commerce/integrations">
            <KeyRound className="w-4 h-4" />
            Integrations
          </Link>
          <button className="btn-outline" onClick={loadBoard} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricTile icon={Search} label="Research" value={stats.openResearch} color="var(--info)" />
        <MetricTile icon={ClipboardList} label="Review Queue" value={stats.reviewQueue} color="var(--warning)" />
        <MetricTile icon={ShieldAlert} label="Setup Blockers" value={stats.setupBlockers} color="var(--negative)" />
        <MetricTile icon={CheckCircle2} label="Ready Local" value={stats.readyLocalWork} color="var(--positive)" />
      </section>

      <div
        className="card"
        style={{
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          gap: "10px",
          color: "var(--warning)",
          backgroundColor: "var(--warning-soft)",
        }}
      >
        <ShieldAlert className="w-5 h-5" />
        <span style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>
          {data?.guardrail ?? "External commerce actions remain blocked."}
        </span>
      </div>

      {error && (
        <div className="card" style={{ borderRadius: "8px", padding: "14px 16px", display: "flex", gap: "10px", color: "var(--negative)" }}>
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ borderRadius: "8px", padding: "40px", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {columns.map((column) => (
            <div key={column.id} style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
              <div>
                <h2 style={{ color: "var(--text-primary)", fontSize: "17px", fontWeight: 700 }}>{column.title}</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>{column.description}</p>
              </div>
              {column.items.length === 0 ? (
                <div className="card" style={{ borderRadius: "8px", padding: "18px", color: "var(--text-secondary)", fontSize: "13px" }}>
                  No items in this lane.
                </div>
              ) : (
                column.items.map((item) => <BoardCard key={item.id} item={item} />)
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
