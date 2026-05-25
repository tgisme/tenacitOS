import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

export const TASKS_PATH = path.join(process.cwd(), "data", "tasks.json");

export async function loadLocalTasks(tasksPath = TASKS_PATH) {
  try {
    const parsed = JSON.parse(await fs.readFile(tasksPath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createCommerceTaskFromItem(item, now = new Date()) {
  return {
    id: `commerce-${randomUUID()}`,
    name: `Commerce: ${item.title}`,
    schedule: null,
    timezone: "UTC",
    description: [
      item.nextAction,
      item.subtitle ? `Context: ${item.subtitle}` : "",
      item.status ? `Status: ${item.status}` : "",
    ].filter(Boolean).join("\n"),
    lastStatus: "todo",
    nextRun: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    source: {
      type: "commerce-work-board",
      itemId: item.id,
      kind: item.kind,
      href: item.href,
    },
    metadata: {
      priority: item.priority ?? 0,
      meta: Array.isArray(item.meta) ? item.meta : [],
      externalActionBlocked: true,
    },
  };
}

export async function createOrFindCommerceTask(item, tasksPath = TASKS_PATH, now = new Date()) {
  const tasks = await loadLocalTasks(tasksPath);
  const existing = tasks.find(
    (task) =>
      task.source?.type === "commerce-work-board" &&
      task.source.itemId === item.id &&
      task.lastStatus !== "done",
  );

  if (existing) {
    return { task: existing, created: false };
  }

  const task = createCommerceTaskFromItem(item, now);
  tasks.unshift(task);
  await fs.mkdir(path.dirname(tasksPath), { recursive: true });
  await fs.writeFile(tasksPath, `${JSON.stringify(tasks, null, 2)}\n`);

  return { task, created: true };
}
