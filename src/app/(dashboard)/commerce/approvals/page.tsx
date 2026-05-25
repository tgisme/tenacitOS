"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ApprovalStatus = "requested" | "approved" | "rejected" | "needs-revision" | "executed-locally";

interface ApprovalAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  note: string;
}

interface ApprovalRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ApprovalStatus;
  productId: string;
  productTitle: string;
  requestedAction: string;
  reviewer: string;
  decisionNote: string;
  riskChecks: string[];
  blockedExternalAction: boolean;
  auditTrail: ApprovalAuditEntry[];
}

interface ApprovalsResponse {
  records: ApprovalRecord[];
  guardrail: string;
  stats: {
    total: number;
    requested: number;
    approved: number;
    rejected: number;
    blockedExternalActions: number;
  };
}

interface ApprovalFormState {
  productId: string;
  productTitle: string;
  requestedAction: string;
  reviewer: string;
  decisionNote: string;
  riskChecks: string;
}

const EMPTY_APPROVAL: ApprovalFormState = {
  productId: "",
  productTitle: "",
  requestedAction: "prepare-etsy-draft",
  reviewer: "T",
  decisionNote: "",
  riskChecks: "",
};

const statusStyles: Record<ApprovalStatus, { label: string; color: string; bg: string }> = {
  requested: { label: "Requested", color: "var(--warning)", bg: "var(--warning-soft)" },
  approved: { label: "Approved", color: "var(--positive)", bg: "var(--positive-soft)" },
  rejected: { label: "Rejected", color: "var(--negative)", bg: "var(--negative-soft)" },
  "needs-revision": { label: "Needs Revision", color: "var(--info)", bg: "var(--info-soft)" },
  "executed-locally": { label: "Executed Locally", color: "var(--positive)", bg: "var(--positive-soft)" },
};

function MetricTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ClipboardList;
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

export default function CommerceApprovalsPage() {
  const [data, setData] = useState<ApprovalsResponse | null>(null);
  const [approval, setApproval] = useState<ApprovalFormState>(EMPTY_APPROVAL);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const records = useMemo(() => data?.records ?? [], [data?.records]);
  const stats = data?.stats ?? { total: 0, requested: 0, approved: 0, rejected: 0, blockedExternalActions: 0 };

  const loadApprovals = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/commerce/approvals");
      const nextData = await response.json();
      if (!response.ok) throw new Error(nextData?.error || "Failed to load approval ledger");
      setData(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approval ledger");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const updateApproval = (field: keyof ApprovalFormState, value: string) => {
    setApproval((current) => ({ ...current, [field]: value }));
  };

  const createApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approval),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to create approval record");
      setApproval(EMPTY_APPROVAL);
      setNotice("Approval record saved locally. No external commerce action was taken.");
      await loadApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create approval record");
    } finally {
      setIsSaving(false);
    }
  };

  const updateRecord = async (record: ApprovalRecord, status: ApprovalStatus) => {
    setUpdatingId(record.id);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/commerce/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, status, note: decisionNotes[record.id] ?? "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Failed to update approval record");
      setDecisionNotes((current) => ({ ...current, [record.id]: "" }));
      setNotice(`${record.productTitle} marked ${statusStyles[status].label.toLowerCase()}.`);
      await loadApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update approval record");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            Commerce Approval Ledger
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", maxWidth: "760px" }}>
            Local approval evidence for product actions, risk checks, and decisions before any external Etsy or Printify workflow can run.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Link className="btn-outline" href="/commerce/work-board">
            <Columns3 className="w-4 h-4" />
            Work Board
          </Link>
          <Link className="btn-outline" href="/commerce">
            <Store className="w-4 h-4" />
            Commerce Studio
          </Link>
          <Link className="btn-outline" href="/commerce/trends">
            <Search className="w-4 h-4" />
            Trend Briefs
          </Link>
          <Link className="btn-outline" href="/commerce/integrations">
            <KeyRound className="w-4 h-4" />
            Integrations
          </Link>
          <button className="btn-outline" onClick={loadApprovals} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricTile icon={ClipboardList} label="Records" value={stats.total} color="var(--info)" />
        <MetricTile icon={ShieldAlert} label="Requested" value={stats.requested} color="var(--warning)" />
        <MetricTile icon={CheckCircle2} label="Approved" value={stats.approved} color="var(--positive)" />
        <MetricTile icon={XCircle} label="Rejected" value={stats.rejected} color="var(--negative)" />
        <MetricTile icon={KeyRound} label="Blocked Writes" value={stats.blockedExternalActions} color="var(--warning)" />
      </section>

      <div className="card" style={{ borderRadius: "8px", padding: "14px 16px", display: "flex", gap: "10px", color: "var(--warning)", backgroundColor: "var(--warning-soft)" }}>
        <ShieldAlert className="w-5 h-5" />
        <span style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>
          {data?.guardrail ?? "Approval records are local evidence only. External Etsy and Printify writes remain blocked."}
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
        <form className="card" onSubmit={createApproval} style={{ borderRadius: "8px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>New Approval Record</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Record a local decision request with risk checks and reviewer context.
            </p>
          </div>

          <Field label="Product Title" value={approval.productTitle} onChange={(value) => updateApproval("productTitle", value)} placeholder="AI Workflow Desk Mat" required />
          <Field label="Product ID" value={approval.productId} onChange={(value) => updateApproval("productId", value)} placeholder="example-local-draft" />
          <Field label="Requested Action" value={approval.requestedAction} onChange={(value) => updateApproval("requestedAction", value)} placeholder="prepare-etsy-draft" required />
          <Field label="Reviewer" value={approval.reviewer} onChange={(value) => updateApproval("reviewer", value)} required />
          <Field label="Decision Note" value={approval.decisionNote} onChange={(value) => updateApproval("decisionNote", value)} multiline />
          <Field label="Risk Checks" value={approval.riskChecks} onChange={(value) => updateApproval("riskChecks", value)} placeholder="One check per line" multiline />

          <button className="btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            Save Approval
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isLoading ? (
            <div className="card" style={{ borderRadius: "8px", padding: "40px", display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="card" style={{ borderRadius: "8px", padding: "28px", color: "var(--text-secondary)" }}>
              No approval records yet.
            </div>
          ) : (
            records.map((record) => {
              const status = statusStyles[record.status];
              const isUpdating = updatingId === record.id;

              return (
                <article key={record.id} className="card" style={{ borderRadius: "8px", padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>{record.productTitle}</h2>
                        <span className="badge" style={{ color: status.color, backgroundColor: status.bg }}>
                          {status.label}
                        </span>
                        {record.blockedExternalAction && (
                          <span className="badge" style={{ color: "var(--negative)", backgroundColor: "var(--negative-soft)" }}>
                            External blocked
                          </span>
                        )}
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                        {record.requestedAction} · reviewer {record.reviewer}
                      </p>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {formatDistanceToNow(new Date(record.updatedAt), { addSuffix: true })}
                    </span>
                  </div>

                  <p style={{ color: "var(--text-primary)", fontSize: "14px", marginTop: "14px" }}>
                    {record.decisionNote || "No decision note recorded yet."}
                  </p>

                  {record.riskChecks.length > 0 && (
                    <div style={{ marginTop: "14px" }}>
                      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700 }}>Risk Checks</p>
                      <ul style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", paddingLeft: "18px" }}>
                        {record.riskChecks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      className="input"
                      value={decisionNotes[record.id] ?? ""}
                      onChange={(event) => setDecisionNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                      placeholder="Decision note required for approve, reject, or revision"
                      rows={2}
                      style={{ resize: "vertical" }}
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => updateRecord(record, "approved")}>
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => updateRecord(record, "needs-revision")}>
                        <RefreshCw className="w-4 h-4" />
                        Revision
                      </button>
                      <button className="btn-outline" type="button" disabled={isUpdating} onClick={() => updateRecord(record, "executed-locally")}>
                        <ClipboardList className="w-4 h-4" />
                        Local Done
                      </button>
                      <button className="btn-danger" type="button" disabled={isUpdating} onClick={() => updateRecord(record, "rejected")}>
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Audit Trail</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {record.auditTrail.slice(0, 3).map((entry) => (
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
    </div>
  );
}
