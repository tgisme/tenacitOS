import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type ApprovalStatus = "requested" | "approved" | "rejected" | "needs-revision" | "executed-locally";
type ApprovalAction = "created" | "updated" | "approved" | "rejected" | "revision-requested" | "local-execution-recorded";

interface ApprovalAuditEntry {
  id: string;
  timestamp: string;
  action: ApprovalAction;
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

interface ApprovalStore {
  records: ApprovalRecord[];
}

type RawApprovalRecord = Partial<Omit<ApprovalRecord, "status" | "auditTrail">> & {
  status?: ApprovalStatus;
  auditTrail?: ApprovalAuditEntry[];
};

const DATA_PATH = path.join(process.cwd(), "data", "commerce-approvals.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "commerce-approvals.example.json");

const VALID_STATUSES = new Set<ApprovalStatus>(["requested", "approved", "rejected", "needs-revision", "executed-locally"]);

function normalizeList(value: unknown, limit = 12): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }

  return [];
}

function makeAudit(action: ApprovalAction, note: string): ApprovalAuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    note,
  };
}

function normalizeRecord(raw: RawApprovalRecord): ApprovalRecord {
  const status = raw.status && VALID_STATUSES.has(raw.status) ? raw.status : "requested";

  return {
    id: raw.id ?? randomUUID(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    status,
    productId: String(raw.productId || ""),
    productTitle: String(raw.productTitle || "Untitled product"),
    requestedAction: String(raw.requestedAction || "prepare-local-draft"),
    reviewer: String(raw.reviewer || "Unassigned"),
    decisionNote: String(raw.decisionNote || ""),
    riskChecks: normalizeList(raw.riskChecks),
    blockedExternalAction: raw.blockedExternalAction ?? true,
    auditTrail: Array.isArray(raw.auditTrail) ? raw.auditTrail : [],
  };
}

async function loadStore(): Promise<ApprovalStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { records?: RawApprovalRecord[] };
    return { records: Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord) : [] };
  } catch {
    try {
      const raw = await fs.readFile(EXAMPLE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as { records?: RawApprovalRecord[] };
      return { records: Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord) : [] };
    } catch {
      return { records: [] };
    }
  }
}

async function saveStore(store: ApprovalStore): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function getStats(records: ApprovalRecord[]) {
  return {
    total: records.length,
    requested: records.filter((record) => record.status === "requested").length,
    approved: records.filter((record) => record.status === "approved").length,
    rejected: records.filter((record) => record.status === "rejected").length,
    blockedExternalActions: records.filter((record) => record.blockedExternalAction).length,
  };
}

export async function GET() {
  try {
    const store = await loadStore();
    const records = [...store.records].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({
      records,
      stats: getStats(records),
      guardrail: "Approval records are local evidence only. External Etsy and Printify writes remain blocked.",
    });
  } catch (error) {
    console.error("[commerce-approvals] Failed to load approval ledger:", error);
    return NextResponse.json({ error: "Failed to load commerce approval ledger" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productTitle = String(body.productTitle || "").trim();
    const requestedAction = String(body.requestedAction || "").trim();
    const reviewer = String(body.reviewer || "").trim();

    if (!productTitle || !requestedAction || !reviewer) {
      return NextResponse.json({ error: "Missing required fields: productTitle, requestedAction, reviewer" }, { status: 400 });
    }

    const status = body.status as ApprovalStatus;
    const now = new Date().toISOString();
    const record: ApprovalRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: status && VALID_STATUSES.has(status) ? status : "requested",
      productId: String(body.productId || "").trim(),
      productTitle,
      requestedAction,
      reviewer,
      decisionNote: String(body.decisionNote || "").trim(),
      riskChecks: normalizeList(body.riskChecks),
      blockedExternalAction: true,
      auditTrail: [makeAudit("created", "Approval record created locally. No external commerce action was taken.")],
    };

    const store = await loadStore();
    store.records.unshift(record);
    await saveStore(store);

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("[commerce-approvals] Failed to create approval record:", error);
    return NextResponse.json({ error: "Failed to create approval record" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = body.status as ApprovalStatus;
    const note = String(body.note || "").trim();

    if (!id || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Missing or invalid id/status" }, { status: 400 });
    }

    if (["approved", "rejected", "needs-revision"].includes(status) && !note) {
      return NextResponse.json({ error: "A decision note is required" }, { status: 400 });
    }

    const store = await loadStore();
    const record = store.records.find((item) => item.id === id);

    if (!record) {
      return NextResponse.json({ error: "Approval record not found" }, { status: 404 });
    }

    record.status = status;
    record.updatedAt = new Date().toISOString();
    record.decisionNote = note || record.decisionNote;
    record.blockedExternalAction = true;
    record.auditTrail.unshift(
      makeAudit(
        status === "approved"
          ? "approved"
          : status === "rejected"
            ? "rejected"
            : status === "needs-revision"
              ? "revision-requested"
              : status === "executed-locally"
                ? "local-execution-recorded"
                : "updated",
        note || `Status changed to ${status}`,
      ),
    );

    await saveStore(store);

    return NextResponse.json({ ...store, stats: getStats(store.records) });
  } catch (error) {
    console.error("[commerce-approvals] Failed to update approval record:", error);
    return NextResponse.json({ error: "Failed to update approval record" }, { status: 500 });
  }
}
