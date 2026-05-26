import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createOrFindCommerceTask, findOpenCommerceTaskForItem } from "../src/lib/commerce-work-board-tasks.js";

const queueItem = {
  id: "product-local-mug",
  kind: "product",
  title: "Local Mug",
  subtitle: "Home office - Manual entry",
  status: "needs-review",
  nextAction: "Review copy, risk notes, and margin before approving or rejecting.",
  href: "/commerce",
  priority: 82,
  meta: ["Confidence 82%", "Margin $12"],
};

async function withTempTasksFile(run) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "commerce-tasks-"));
  const tasksPath = path.join(tempDir, "data", "tasks.json");

  try {
    await run(tasksPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

test("creates a local task from a commerce work board item", async () => {
  await withTempTasksFile(async (tasksPath) => {
    const result = await createOrFindCommerceTask(queueItem, tasksPath, new Date("2026-05-25T22:00:00.000Z"));
    const saved = JSON.parse(await fs.readFile(tasksPath, "utf-8"));

    assert.equal(result.created, true);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, result.task.id);
    assert.equal(saved[0].name, "Commerce: Local Mug");
    assert.equal(saved[0].description, [
      "Review copy, risk notes, and margin before approving or rejecting.",
      "Context: Home office - Manual entry",
      "Status: needs-review",
    ].join("\n"));
    assert.deepEqual(saved[0].source, {
      type: "commerce-work-board",
      itemId: "product-local-mug",
      kind: "product",
      href: "/commerce",
    });
    assert.deepEqual(saved[0].metadata, {
      priority: 82,
      meta: ["Confidence 82%", "Margin $12"],
      externalActionBlocked: true,
    });
  });
});

test("returns an existing open commerce task instead of creating a duplicate", async () => {
  await withTempTasksFile(async (tasksPath) => {
    const first = await createOrFindCommerceTask(queueItem, tasksPath, new Date("2026-05-25T22:00:00.000Z"));
    const second = await createOrFindCommerceTask(queueItem, tasksPath, new Date("2026-05-25T22:30:00.000Z"));
    const saved = JSON.parse(await fs.readFile(tasksPath, "utf-8"));

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.task.id, first.task.id);
    assert.equal(saved.length, 1);
  });
});

test("finds an existing open commerce task for a work board item", () => {
  const tasks = [
    {
      id: "done-task",
      lastStatus: "done",
      source: {
        type: "commerce-work-board",
        itemId: "product-local-mug",
      },
    },
    {
      id: "open-task",
      lastStatus: "todo",
      source: {
        type: "commerce-work-board",
        itemId: "product-local-mug",
      },
    },
    {
      id: "other-task",
      lastStatus: "todo",
      source: {
        type: "commerce-work-board",
        itemId: "product-other",
      },
    },
  ];

  const existing = findOpenCommerceTaskForItem(tasks, queueItem);

  assert.equal(existing.id, "open-task");
});

test("does not treat completed commerce tasks as existing open work", () => {
  const tasks = [
    {
      id: "done-task",
      lastStatus: "done",
      source: {
        type: "commerce-work-board",
        itemId: "product-local-mug",
      },
    },
  ];

  const existing = findOpenCommerceTaskForItem(tasks, queueItem);

  assert.equal(existing, undefined);
});

test("creates a new task when the matching commerce task is already done", async () => {
  await withTempTasksFile(async (tasksPath) => {
    await fs.mkdir(path.dirname(tasksPath), { recursive: true });
    await fs.writeFile(tasksPath, JSON.stringify([
      {
        id: "finished-task",
        name: "Commerce: Local Mug",
        schedule: null,
        timezone: "UTC",
        description: "Finished old task",
        lastStatus: "done",
        nextRun: null,
        source: {
          type: "commerce-work-board",
          itemId: "product-local-mug",
          kind: "product",
          href: "/commerce",
        },
      },
    ], null, 2));

    const result = await createOrFindCommerceTask(queueItem, tasksPath, new Date("2026-05-25T23:00:00.000Z"));
    const saved = JSON.parse(await fs.readFile(tasksPath, "utf-8"));

    assert.equal(result.created, true);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].id, result.task.id);
    assert.equal(saved[1].id, "finished-task");
  });
});
