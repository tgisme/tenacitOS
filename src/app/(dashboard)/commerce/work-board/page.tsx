"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Columns3,
  ExternalLink,
  Filter,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type WorkBoardKind = "trend" | "product" | "approval" | "integration";
type WorkBoardLane = "all" | "research" | "review" | "setup" | "ready";
type WorkBoardKindFilter = "all" | WorkBoardKind;

interface WorkBoardDetail {
  summary: string;
  evidence: string[];
  riskNotes: string[];
  pricing: Array<{ label: string; value: string }>;
  auditTrail: Array<{ timestamp: string | null; action: string; note: string }>;
}

interface WorkBoardItem {
  id: string;
  kind: WorkBoardKind;
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

interface LocalCommerceTask {
  id: string;
  name: string;
  lastStatus?: string;
  updatedAt?: string;
  source?: {
    href?: string;
  };
}

type TaskActionState =
  | { status: "created" | "existing"; task: LocalCommerceTask }
  | { status: "error"; message: string };

const kindStyles: Record<WorkBoardKind, { label: string; color: string; bg: string }> = {
  trend: { label: "Trend", color: "var(--info)", bg: "var(--info-soft)" },
  product: { label: "Product", color: "var(--warning)", bg: "var(--warning-soft)" },
  approval: { label: "Approval", color: "var(--positive)", bg: "var(--positive-soft)" },
  integration: { label: "Setup", color: "var(--negative)", bg: "var(--negative-soft)" },
};

const laneOptions: Array<{ id: WorkBoardLane; label: string }> = [
  { id: "all", label: "All lanes" },
  { id: "research", label: "Research" },
  { id: "review", label: "Review" },
  { id: "setup", label: "Setup" },
  { id: "ready", label: "Ready" },
];

const kindOptions: Array<{ id: WorkBoardKindFilter; label: string }> = [
  { id: "all", label: "All types" },
  { id: "trend", label: "Trends" },
  { id: "product", label: "Products" },
  { id: "approval", label: "Approvals" },
  { id: "integration", label: "Setup" },
];

const laneIds = new Set<WorkBoardLane>(laneOptions.map((option) => option.id));
const kindIds = new Set<WorkBoardKindFilter>(kindOptions.map((option) => option.id));

function isLaneFilter(value: string | null): value is WorkBoardLane {
  return value !== null && laneIds.has(value as WorkBoardLane);
}

function isKindFilter(value: string | null): value is WorkBoardKindFilter {
  return value !== null && kindIds.has(value as WorkBoardKindFilter);
}

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

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h3 style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 800 }}>{title}</h3>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5 }}>{children}</p>;
}

function formatTaskId(id: string) {
  return id.length > 18 ? `${id.slice(0, 18)}...` : id;
}

function BoardCard({ item, onOpen }: { item: WorkBoardItem; onOpen: (item: WorkBoardItem) => void }) {
  const kind = kindStyles[item.kind];

  return (
    <button
      className="card"
      onClick={() => onOpen(item)}
      style={{
        borderRadius: "8px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        textDecoration: "none",
        textAlign: "left",
        width: "100%",
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

      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "10px",
          color: "var(--text-primary)",
          fontSize: "13px",
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Next: </span>
        {item.nextAction}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
        <span>Priority {item.priority}</span>
        <span>{item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : "Setup task"}</span>
      </div>
    </button>
  );
}

function WorkBoardDrawer({ item, onClose }: { item: WorkBoardItem; onClose: () => void }) {
  const kind = kindStyles[item.kind];
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskAction, setTaskAction] = useState<TaskActionState | null>(null);
  const taskSearchHref = taskAction?.status === "created" || taskAction?.status === "existing"
    ? `/search?q=${encodeURIComponent(taskAction.task.name || taskAction.task.id)}`
    : null;
  const hasLocalTask = taskAction?.status === "created" || taskAction?.status === "existing";
  const taskButtonLabel = isCreatingTask
    ? "Creating..."
    : taskAction?.status === "created"
      ? "Task created"
      : taskAction?.status === "existing"
        ? "Task exists"
        : taskAction?.status === "error"
          ? "Retry create"
          : "Create task";

  const createTask = async () => {
    try {
      setIsCreatingTask(true);
      setTaskAction(null);
      const response = await fetch("/api/commerce/work-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to create task");
      setTaskAction({ status: result.created ? "created" : "existing", task: result.task });
    } catch (error) {
      setTaskAction({ status: "error", message: error instanceof Error ? error.message : "Failed to create task" });
    } finally {
      setIsCreatingTask(false);
    }
  };

  useEffect(() => {
    setTaskAction(null);
    setIsCreatingTask(false);
  }, [item.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${item.title} details`}>
      <button
        aria-label="Close details"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.55)", width: "100%", height: "100%" }}
      />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-2xl"
        style={{
          backgroundColor: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="badge" style={{ color: kind.color, backgroundColor: kind.bg }}>
              {kind.label}
            </span>
            <h2 style={{ color: "var(--text-primary)", fontSize: "22px", fontWeight: 800, marginTop: "10px", lineHeight: 1.2 }}>
              {item.title}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px" }}>{item.subtitle}</p>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close details">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "22px" }}>
          {taskAction && (
            <div
              className="card"
              style={{
                borderRadius: "8px",
                padding: "14px",
                color: taskAction.status === "error" ? "var(--negative)" : "var(--positive)",
                backgroundColor: taskAction.status === "error" ? "var(--negative-soft)" : "var(--positive-soft)",
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              {taskAction.status === "error" ? (
                <AlertCircle className="w-5 h-5" style={{ flexShrink: 0 }} />
              ) : (
                <CheckCircle2 className="w-5 h-5" style={{ flexShrink: 0 }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                <p style={{ color: "inherit", fontSize: "13px", fontWeight: 800 }}>
                  {taskAction.status === "created"
                    ? "Local task created"
                    : taskAction.status === "existing"
                      ? "Local task already exists"
                      : "Task creation failed"}
                </p>
                {taskAction.status === "error" ? (
                  <p style={{ color: "inherit", fontSize: "13px", lineHeight: 1.45 }}>{taskAction.message}</p>
                ) : (
                  <>
                    <p style={{ color: "var(--text-primary)", fontSize: "13px", lineHeight: 1.45 }}>
                      {taskAction.task.name}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <span className="badge" style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
                        {taskAction.task.lastStatus || "todo"}
                      </span>
                      <span className="badge" title={taskAction.task.id} style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
                        ID {formatTaskId(taskAction.task.id)}
                      </span>
                    </div>
                    {taskSearchHref && (
                      <Link className="btn-ghost" href={taskSearchHref} style={{ alignSelf: "flex-start", marginTop: "2px" }}>
                        <Search className="w-4 h-4" />
                        Find task
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <DetailSection title="Next Action">
            <div className="card" style={{ borderRadius: "8px", padding: "14px", backgroundColor: "var(--surface-elevated)" }}>
              <p style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.5 }}>{item.nextAction}</p>
            </div>
          </DetailSection>

          <DetailSection title="Summary">
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.55 }}>{item.detail.summary}</p>
          </DetailSection>

          <DetailSection title="Evidence">
            {item.detail.evidence.length === 0 ? (
              <EmptyNote>No evidence recorded yet.</EmptyNote>
            ) : (
              <ul style={{ display: "flex", flexDirection: "column", gap: "8px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.45 }}>
                {item.detail.evidence.map((entry) => (
                  <li key={entry} style={{ paddingLeft: "2px" }}>
                    {entry}
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title={item.kind === "integration" ? "Health" : "Pricing"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {item.detail.pricing.map((entry) => (
                <div key={`${entry.label}-${entry.value}`} className="card" style={{ borderRadius: "8px", padding: "12px", backgroundColor: "var(--surface-elevated)" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>{entry.label}</p>
                  <p style={{ color: "var(--text-primary)", fontSize: "13px", marginTop: "4px", lineHeight: 1.35 }}>{entry.value}</p>
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection title="Risk Notes">
            {item.detail.riskNotes.length === 0 ? (
              <EmptyNote>No risk notes recorded yet.</EmptyNote>
            ) : (
              <ul style={{ display: "flex", flexDirection: "column", gap: "8px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.45 }}>
                {item.detail.riskNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Audit History">
            {item.detail.auditTrail.length === 0 ? (
              <EmptyNote>No audit entries recorded yet.</EmptyNote>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {item.detail.auditTrail.map((entry) => (
                  <div key={`${entry.timestamp}-${entry.action}-${entry.note}`} className="card" style={{ borderRadius: "8px", padding: "12px", backgroundColor: "var(--surface-elevated)" }}>
                    <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 700 }}>{entry.action}</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px", lineHeight: 1.45 }}>{entry.note}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "6px" }}>
                      {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : "No timestamp"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "10px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "12px", alignSelf: "center" }}>
            {hasLocalTask ? "Local task linked" : "Read-only local detail"}
          </span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn-outline" onClick={createTask} disabled={isCreatingTask || hasLocalTask}>
              {isCreatingTask ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasLocalTask ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ClipboardList className="w-4 h-4" />
              )}
              {taskButtonLabel}
            </button>
            <Link className="btn-primary" href={item.href}>
              <ExternalLink className="w-4 h-4" />
              Open source
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function CommerceWorkBoardPage() {
  const [data, setData] = useState<WorkBoardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [laneFilter, setLaneFilter] = useState<WorkBoardLane>("all");
  const [kindFilter, setKindFilter] = useState<WorkBoardKindFilter>("all");
  const [selectedItem, setSelectedItem] = useState<WorkBoardItem | null>(null);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
  const stats = data?.stats ?? { openResearch: 0, reviewQueue: 0, setupBlockers: 0, readyLocalWork: 0 };
  const totalItems = columns.reduce((count, column) => count + column.items.length, 0);
  const normalizedQuery = query.trim().toLowerCase();
  const hasFilters = normalizedQuery.length > 0 || laneFilter !== "all" || kindFilter !== "all";
  const filteredColumns = useMemo(
    () =>
      columns
        .filter((column) => laneFilter === "all" || column.id === laneFilter)
        .map((column) => ({
          ...column,
          items: column.items.filter((item) => {
            const matchesKind = kindFilter === "all" || item.kind === kindFilter;
            const searchableText = [
              item.title,
              item.subtitle,
              item.status,
              item.nextAction,
              ...item.meta,
            ].join(" ").toLowerCase();
            const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

            return matchesKind && matchesQuery;
          }),
        })),
    [columns, kindFilter, laneFilter, normalizedQuery],
  );
  const visibleItems = filteredColumns.reduce((count, column) => count + column.items.length, 0);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextQuery = params.get("q") ?? "";
    const nextLane = params.get("lane");
    const nextKind = params.get("type");

    setQuery(nextQuery);
    setLaneFilter(isLaneFilter(nextLane) ? nextLane : "all");
    setKindFilter(isKindFilter(nextKind) ? nextKind : "all");
    setFiltersLoaded(true);
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;

    const url = new URL(window.location.href);
    if (query.trim()) {
      url.searchParams.set("q", query.trim());
    } else {
      url.searchParams.delete("q");
    }

    if (laneFilter === "all") {
      url.searchParams.delete("lane");
    } else {
      url.searchParams.set("lane", laneFilter);
    }

    if (kindFilter === "all") {
      url.searchParams.delete("type");
    } else {
      url.searchParams.set("type", kindFilter);
    }

    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [filtersLoaded, kindFilter, laneFilter, query]);

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

      <section
        className="card"
        style={{
          borderRadius: "8px",
          padding: "14px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <label style={{ position: "relative", minWidth: "220px", flex: "1 1 280px" }}>
          <Search
            className="w-4 h-4"
            style={{
              color: "var(--text-muted)",
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search queue..."
            style={{ paddingLeft: "36px", width: "100%" }}
          />
        </label>

        <select
          className="input"
          value={laneFilter}
          onChange={(event) => setLaneFilter(event.target.value as WorkBoardLane)}
          style={{ minWidth: "150px", flex: "0 1 180px" }}
        >
          {laneOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value as WorkBoardKindFilter)}
          style={{ minWidth: "150px", flex: "0 1 180px" }}
        >
          {kindOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", alignItems: "center", flex: "1 1 180px" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>
            {visibleItems} / {totalItems} shown
          </span>
          {hasFilters && (
            <button
              className="btn-outline"
              onClick={() => {
                setQuery("");
                setLaneFilter("all");
                setKindFilter("all");
              }}
            >
              <Filter className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
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
          {filteredColumns.map((column) => (
            <div key={column.id} style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
              <div>
                <h2 style={{ color: "var(--text-primary)", fontSize: "17px", fontWeight: 700 }}>
                  {column.title}{" "}
                  <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 700 }}>
                    {column.items.length}
                  </span>
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>{column.description}</p>
              </div>
              {column.items.length === 0 ? (
                <div className="card" style={{ borderRadius: "8px", padding: "18px", color: "var(--text-secondary)", fontSize: "13px" }}>
                  No items in this lane.
                </div>
              ) : (
                column.items.map((item) => <BoardCard key={item.id} item={item} onOpen={setSelectedItem} />)
              )}
            </div>
          ))}
        </section>
      )}
      {selectedItem && <WorkBoardDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}
