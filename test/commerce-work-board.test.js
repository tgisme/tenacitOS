import assert from "node:assert/strict";
import test from "node:test";

import { buildCommerceWorkBoardPayload } from "../src/lib/commerce-work-board.js";

const product = {
  id: "local-mug",
  updatedAt: "2026-05-25T21:30:00.000Z",
  status: "needs-review",
  title: "Local Mug",
  niche: "Home office",
  sourceAgent: "Manual entry",
  confidence: 82,
  trendBrief: {
    summary: "A useful local product draft.",
  },
  financials: {
    expectedMargin: 12,
  },
};

test("work board payload attaches an existing open local task to matching review items", () => {
  const payload = buildCommerceWorkBoardPayload({
    products: [product],
    localTasks: [
      {
        id: "done-task",
        name: "Commerce: Local Mug",
        lastStatus: "done",
        source: {
          type: "commerce-work-board",
          itemId: "product-local-mug",
          href: "/commerce",
        },
      },
      {
        id: "open-task",
        name: "Commerce: Local Mug",
        lastStatus: "todo",
        source: {
          type: "commerce-work-board",
          itemId: "product-local-mug",
          href: "/commerce",
        },
      },
    ],
  });

  const reviewColumn = payload.columns.find((column) => column.id === "review");
  const boardItem = reviewColumn.items.find((item) => item.id === "product-local-mug");

  assert.equal(payload.stats.reviewQueue, 1);
  assert.equal(boardItem.localTask.id, "open-task");
  assert.equal(boardItem.localTask.lastStatus, "todo");
});

test("work board payload marks review items without open local tasks as null", () => {
  const payload = buildCommerceWorkBoardPayload({
    products: [product],
    localTasks: [
      {
        id: "done-task",
        name: "Commerce: Local Mug",
        lastStatus: "done",
        source: {
          type: "commerce-work-board",
          itemId: "product-local-mug",
          href: "/commerce",
        },
      },
    ],
  });

  const reviewColumn = payload.columns.find((column) => column.id === "review");
  const boardItem = reviewColumn.items.find((item) => item.id === "product-local-mug");

  assert.equal(boardItem.localTask, null);
});
