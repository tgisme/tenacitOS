import { NextRequest, NextResponse } from "next/server";
import { loadCommerceWorkBoardPayload } from "@/lib/commerce-work-board";
import { createOrFindCommerceTask } from "@/lib/commerce-work-board-tasks";

interface WorkBoardItem {
  id: string;
  kind: "trend" | "product" | "approval" | "integration";
  title: string;
  status?: string;
  subtitle?: string;
  nextAction: string;
  href: string;
  priority?: number;
  meta?: string[];
}

export async function GET() {
  try {
    return NextResponse.json(await loadCommerceWorkBoardPayload());
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
