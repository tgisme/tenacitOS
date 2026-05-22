import { readFileSync } from 'fs';
import { join } from 'path';
import { OPENCLAW_DIR } from '@/lib/paths';
import { runOpenClaw } from '@/lib/openclaw-command';

export interface RawOpenClawSession {
  key: string;
  kind?: string;
  updatedAt: number;
  ageMs: number;
  sessionId?: string;
  agentId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
}

function normalizeSession(key: string, value: Record<string, unknown>, now: number): RawOpenClawSession {
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : 0;

  return {
    key,
    kind: typeof value.kind === 'string' ? value.kind : undefined,
    updatedAt,
    ageMs: updatedAt > 0 ? Math.max(0, now - updatedAt) : 0,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
    agentId: typeof value.agentId === 'string' ? value.agentId : undefined,
    systemSent: typeof value.systemSent === 'boolean' ? value.systemSent : undefined,
    abortedLastRun: typeof value.abortedLastRun === 'boolean' ? value.abortedLastRun : undefined,
    inputTokens: typeof value.inputTokens === 'number' ? value.inputTokens : undefined,
    outputTokens: typeof value.outputTokens === 'number' ? value.outputTokens : undefined,
    totalTokens: typeof value.totalTokens === 'number' ? value.totalTokens : undefined,
    totalTokensFresh: typeof value.totalTokensFresh === 'boolean' ? value.totalTokensFresh : undefined,
    model: typeof value.model === 'string' ? value.model : undefined,
    modelProvider: typeof value.modelProvider === 'string' ? value.modelProvider : undefined,
    contextTokens: typeof value.contextTokens === 'number' ? value.contextTokens : undefined,
  };
}

export function readOpenClawSessions(): RawOpenClawSession[] {
  const sessionsPath = join(OPENCLAW_DIR, 'agents', 'main', 'sessions', 'sessions.json');

  try {
    const raw = JSON.parse(readFileSync(sessionsPath, 'utf-8')) as Record<string, Record<string, unknown>>;
    const now = Date.now();

    return Object.entries(raw).map(([key, value]) => normalizeSession(key, value, now));
  } catch {
    const output = runOpenClaw(['sessions', 'list', '--json'], 15000);
    const data = JSON.parse(output) as { sessions?: RawOpenClawSession[] };
    return data.sessions || [];
  }
}
