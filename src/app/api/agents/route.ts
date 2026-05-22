import { NextResponse } from "next/server";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import { OPENCLAW_CONFIG } from "@/lib/paths";
import { readOpenClawSessions } from "@/lib/openclaw-sessions";

export const dynamic = "force-dynamic";

interface Agent {
  id: string;
  name?: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  dmPolicy?: string;
  allowAgents?: string[];
  allowAgentsDetails?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  }>;
  botToken?: string;
  status: "online" | "offline";
  lastActivity?: string;
  activeSessions: number;
  sessionCount: number;
  needsAttention: number;
  abortedSessions: number;
  highContextSessions: number;
  staleContextSessions: number;
  sessionTypes: Record<string, number>;
}

interface OpenClawAgentConfig {
  id: string;
  name?: string;
  workspace: string;
  ui?: {
    emoji?: string;
    color?: string;
  };
  model?: {
    primary?: string;
  };
  subagents?: {
    allowAgents?: string[];
  };
}

interface OpenClawConfig {
  agents: {
    defaults: {
      workspace?: string;
      model: {
        primary: string;
      };
    };
    list?: OpenClawAgentConfig[];
  };
  channels?: {
    telegram?: {
      dmPolicy?: string;
      accounts?: Record<string, {
        botToken?: string;
        dmPolicy?: string;
      }>;
    };
  };
}

// Fallback config used when an agent doesn't define its own ui config in openclaw.json.
// The main agent reads name/emoji from env vars; all others fall back to generic defaults.
// Override via each agent's openclaw.json → ui.emoji / ui.color / name fields.
const DEFAULT_AGENT_CONFIG: Record<string, { emoji: string; color: string; name?: string }> = {
  main: {
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
    color: "#ff6b35",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
  },
};

/**
 * Get agent display info (emoji, color, name) from openclaw.json or defaults
 */
function getAgentDisplayInfo(agentId: string, agentConfig?: OpenClawAgentConfig | null): { emoji: string; color: string; name: string } {
  // First try to get from agent's own config in openclaw.json
  const configEmoji = agentConfig?.ui?.emoji;
  const configColor = agentConfig?.ui?.color;
  const configName = agentConfig?.name;

  // Then try defaults
  const defaults = DEFAULT_AGENT_CONFIG[agentId];

  return {
    emoji: configEmoji || defaults?.emoji || "🤖",
    color: configColor || defaults?.color || "#666666",
    name: configName || defaults?.name || agentId,
  };
}

function parseSessionType(key: string): string {
  const parts = key.split(":");
  return parts.includes("run") ? "run" : parts[2] || "unknown";
}

function getAgentSessionSummary(): Record<string, {
  activeSessions: number;
  lastActivity?: string;
  sessionCount: number;
  needsAttention: number;
  abortedSessions: number;
  highContextSessions: number;
  staleContextSessions: number;
  sessionTypes: Record<string, number>;
}> {
  try {
    const now = Date.now();
    const activeWindowMs = 30 * 60 * 1000;
    const summary: Record<string, {
      activeSessions: number;
      lastActivity?: string;
      sessionCount: number;
      needsAttention: number;
      abortedSessions: number;
      highContextSessions: number;
      staleContextSessions: number;
      sessionTypes: Record<string, number>;
    }> = {};

    for (const session of readOpenClawSessions()) {
      const agentId = session.agentId || session.key.split(":")[1];
      if (!agentId) continue;

      const entry = summary[agentId] || {
        activeSessions: 0,
        sessionCount: 0,
        needsAttention: 0,
        abortedSessions: 0,
        highContextSessions: 0,
        staleContextSessions: 0,
        sessionTypes: {},
      };
      const updatedAt = session.updatedAt || 0;
      const sessionType = parseSessionType(session.key);

      if (sessionType === "run") {
        continue;
      }

      const contextUsedPercent =
        session.contextTokens && session.contextTokens > 0 && session.totalTokensFresh
          ? Math.round(((session.totalTokens || 0) / session.contextTokens) * 100)
          : null;
      const aborted = session.abortedLastRun === true;
      const highContext = contextUsedPercent !== null && contextUsedPercent >= 80;
      const staleContext = (session.totalTokens || 0) > 0 && session.totalTokensFresh === false;

      if (updatedAt > 0 && now - updatedAt <= activeWindowMs) {
        entry.activeSessions += 1;
      }

      entry.sessionCount += 1;
      entry.sessionTypes[sessionType] = (entry.sessionTypes[sessionType] || 0) + 1;

      if (aborted) entry.abortedSessions += 1;
      if (highContext) entry.highContextSessions += 1;
      if (staleContext) entry.staleContextSessions += 1;
      if (aborted || highContext || staleContext) entry.needsAttention += 1;

      if (updatedAt > 0) {
        const activity = new Date(updatedAt).toISOString();
        if (!entry.lastActivity || activity > entry.lastActivity) {
          entry.lastActivity = activity;
        }
      }

      summary[agentId] = entry;
    }

    return summary;
  } catch (error) {
    console.error("Error reading session summary:", error);
    return {};
  }
}

export async function GET() {
  try {
    // Read openclaw config
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, "utf-8")) as OpenClawConfig;
    const sessionSummary = getAgentSessionSummary();
    const configuredAgents =
      config.agents.list && config.agents.list.length > 0
        ? config.agents.list
        : [
            {
              id: "main",
              name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
              workspace: config.agents.defaults.workspace || process.env.OPENCLAW_WORKSPACE || "",
              model: config.agents.defaults.model,
            },
          ];

    // Get agents from config
    const agents: Agent[] = configuredAgents.map((agent) => {
      const agentInfo = getAgentDisplayInfo(agent.id, agent);

      // Get telegram account info
      const telegramAccount =
        config.channels?.telegram?.accounts?.[agent.id];
      const botToken = telegramAccount?.botToken;

      // Check if agent has recent activity
      const memoryPath = join(agent.workspace, "memory");
      let lastActivity = undefined;
      let status: "online" | "offline" = "offline";
      const agentSessions = sessionSummary[agent.id];

      try {
        const today = new Date().toISOString().split("T")[0];
        const memoryFile = join(memoryPath, `${today}.md`);
        const stat = statSync(memoryFile);
        lastActivity = stat.mtime.toISOString();
        // Consider online if activity within last 5 minutes
        status =
          Date.now() - stat.mtime.getTime() < 5 * 60 * 1000
            ? "online"
            : "offline";
      } catch {
        // No recent activity
      }

      if (agentSessions?.lastActivity && (!lastActivity || agentSessions.lastActivity > lastActivity)) {
        lastActivity = agentSessions.lastActivity;
      }

      if (agentSessions?.activeSessions) {
        status = "online";
      }

      // Get details of allowed subagents
      const allowAgents = agent.subagents?.allowAgents || [];
      const allowAgentsDetails = allowAgents.map((subagentId: string) => {
        // Find subagent in config
        const subagentConfig = configuredAgents.find(
          (a) => a.id === subagentId
        );
        if (subagentConfig) {
          const subagentInfo = getAgentDisplayInfo(subagentId, subagentConfig);
          return {
            id: subagentId,
            name: subagentConfig.name || subagentInfo.name,
            emoji: subagentInfo.emoji,
            color: subagentInfo.color,
          };
        }
        // Fallback if subagent not found in config
        const fallbackInfo = getAgentDisplayInfo(subagentId, null);
        return {
          id: subagentId,
          name: fallbackInfo.name,
          emoji: fallbackInfo.emoji,
          color: fallbackInfo.color,
        };
      });

      return {
        id: agent.id,
        name: agent.name || agentInfo.name,
        emoji: agentInfo.emoji,
        color: agentInfo.color,
        model:
          agent.model?.primary || config.agents.defaults.model.primary,
        workspace: agent.workspace,
        dmPolicy:
          telegramAccount?.dmPolicy ||
          config.channels?.telegram?.dmPolicy ||
          "pairing",
        allowAgents,
        allowAgentsDetails,
        botToken: botToken ? "configured" : undefined,
        status,
        lastActivity,
        activeSessions: agentSessions?.activeSessions || 0,
        sessionCount: agentSessions?.sessionCount || 0,
        needsAttention: agentSessions?.needsAttention || 0,
        abortedSessions: agentSessions?.abortedSessions || 0,
        highContextSessions: agentSessions?.highContextSessions || 0,
        staleContextSessions: agentSessions?.staleContextSessions || 0,
        sessionTypes: agentSessions?.sessionTypes || {},
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error reading agents:", error);
    return NextResponse.json(
      { error: "Failed to load agents" },
      { status: 500 }
    );
  }
}
