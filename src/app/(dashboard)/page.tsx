"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/StatsCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { WeatherWidget } from "@/components/WeatherWidget";
import { Notepad } from "@/components/Notepad";
import {
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Circle,
  Bot,
  MessageSquare,
  Users,
  Brain,
  Puzzle,
  Zap,
  Server,
  Terminal,
  ShieldCheck,
  Radio,
  Gauge,
  Kanban,
  Search,
  Store,
  ShieldAlert,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  today: number;
  success: number;
  error: number;
  byType: Record<string, number>;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  status: "online" | "offline";
  lastActivity?: string;
  botToken?: string;
}

interface RuntimeInfo {
  mode: "local-only" | "network";
  baseUrl: string;
  gateway: {
    name: string;
    status: string;
    healthy: boolean;
  };
  host: {
    hostname: string;
    platform: string;
    uptime: number;
    nodeVersion: string;
  };
}

interface SessionSummary {
  total: number;
  sessions: Array<{
    id: string;
    typeLabel: string;
    updatedAt: number;
    totalTokens: number;
    contextUsedPercent: number | null;
    aborted: boolean;
  }>;
}

interface CommerceWorkBoardSummary {
  guardrail: string;
  stats: {
    openResearch: number;
    reviewQueue: number;
    setupBlockers: number;
    readyLocalWork: number;
  };
  columns: Array<{
    id: "research" | "review" | "setup" | "ready";
    title: string;
    items: Array<{
      id: string;
      title: string;
      subtitle: string;
      status: string;
      nextAction: string;
      href: string;
      priority: number;
      meta: string[];
    }>;
  }>;
}

function formatHostUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, success: 0, error: 0, byType: {} });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary>({ total: 0, sessions: [] });
  const [commerceSummary, setCommerceSummary] = useState<CommerceWorkBoardSummary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/activities/stats").then(r => r.json()),
      fetch("/api/agents").then(r => r.json()),
      fetch("/api/runtime").then(r => r.json()),
      fetch("/api/sessions").then(r => r.json()),
      fetch("/api/commerce/work-board").then(r => r.ok ? r.json() : null),
    ]).then(([actStats, agentsData, runtimeData, sessionsData, commerceData]) => {
      setStats({
        total: actStats.total || 0,
        today: actStats.today || 0,
        success: actStats.byStatus?.success || 0,
        error: actStats.byStatus?.error || 0,
        byType: actStats.byType || {},
      });
      setAgents(agentsData.agents || []);
      setRuntime(runtimeData);
      setSessionSummary({
        total: sessionsData.total || 0,
        sessions: sessionsData.sessions || [],
      });
      setCommerceSummary(commerceData);
    }).catch(console.error);
  }, []);

  const mainSession = sessionSummary.sessions[0];
  const commerceAttentionItems = commerceSummary?.columns
    .flatMap((column) => column.items.map((item) => ({ ...item, lane: column.title })))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3) ?? [];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 
          className="text-2xl md:text-3xl font-bold mb-1"
          style={{ 
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            letterSpacing: '-1.5px'
          }}
        >
          🦞 Mission Control
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Local dashboard for OpenClaw activity, agents, sessions, and system controls
        </p>
      </div>

      {/* Local Runtime */}
      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 md:mb-6"
      >
        <StatsCard
          title="Access Mode"
          value={runtime?.mode === "local-only" ? "Local" : "Network"}
          icon={<ShieldCheck className="w-5 h-5" />}
          iconColor={runtime?.mode === "local-only" ? "var(--success)" : "var(--warning)"}
        />
        <StatsCard
          title="Gateway"
          value={runtime?.gateway.healthy ? "Active" : runtime?.gateway.status || "Unknown"}
          icon={<Radio className="w-5 h-5" />}
          iconColor={runtime?.gateway.healthy ? "var(--success)" : "var(--error)"}
        />
        <StatsCard
          title="Sessions"
          value={sessionSummary.total.toLocaleString()}
          icon={<Terminal className="w-5 h-5" />}
          iconColor="var(--info)"
        />
        <StatsCard
          title="Context Used"
          value={mainSession?.contextUsedPercent !== null && mainSession?.contextUsedPercent !== undefined ? `${mainSession.contextUsedPercent}%` : "n/a"}
          icon={<Gauge className="w-5 h-5" />}
          iconColor={(mainSession?.contextUsedPercent || 0) > 75 ? "var(--warning)" : "var(--accent)"}
        />
      </div>

      {runtime && (
        <div
          className="mb-4 md:mb-6 px-4 py-3 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <span className="text-sm">
            Running on {runtime.host.hostname} · {runtime.host.platform} · uptime {formatHostUptime(runtime.host.uptime)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {runtime.baseUrl}
          </span>
        </div>
      )}

      {/* Stats Grid + Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 md:mb-6">
        {/* Stats */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard
            title="Total Activities"
            value={stats.total.toLocaleString()}
            icon={<Activity className="w-5 h-5" />}
            iconColor="var(--info)"
          />
          <StatsCard
            title="Today"
            value={stats.today.toLocaleString()}
            icon={<Zap className="w-5 h-5" />}
            iconColor="var(--accent)"
          />
          <StatsCard
            title="Successful"
            value={stats.success.toLocaleString()}
            icon={<CheckCircle className="w-5 h-5" />}
            iconColor="var(--success)"
          />
          <StatsCard
            title="Errors"
            value={stats.error.toLocaleString()}
            icon={<XCircle className="w-5 h-5" />}
            iconColor="var(--error)"
          />
        </div>

        {/* Weather Widget */}
        <div className="lg:col-span-1">
          <WeatherWidget />
        </div>
      </div>

      {/* Commerce Mission Queue */}
      <div
        className="mb-6 rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="accent-line" />
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)'
              }}
            >
              <Store className="inline-block w-5 h-5 mr-2 mb-1" />
              Commerce Mission Queue
            </h2>
          </div>
          <Link
            href="/commerce/work-board"
            className="text-sm font-medium inline-flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            Open board <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-5 grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2 grid grid-cols-2 gap-3">
            {[
              { label: "Research", value: commerceSummary?.stats.openResearch ?? 0, icon: Search, color: "var(--info)" },
              { label: "Review", value: commerceSummary?.stats.reviewQueue ?? 0, icon: ClipboardList, color: "var(--warning)" },
              { label: "Blockers", value: commerceSummary?.stats.setupBlockers ?? 0, icon: ShieldAlert, color: "var(--error)" },
              { label: "Ready Local", value: commerceSummary?.stats.readyLocalWork ?? 0, icon: Kanban, color: "var(--success)" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Link
                key={label}
                href="/commerce/work-board"
                className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
              </Link>
            ))}
          </div>

          <div className="xl:col-span-3">
            <div
              className="mb-3 rounded-lg px-3 py-2 flex items-start gap-2"
              style={{
                backgroundColor: 'var(--warning-soft)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <ShieldAlert className="w-4 h-4 mt-0.5" style={{ color: 'var(--warning)' }} />
              <span className="text-xs font-semibold">
                {commerceSummary?.guardrail ?? "Commerce actions are summarized locally and external writes stay blocked."}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {commerceAttentionItems.length > 0 ? commerceAttentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)', textDecoration: 'none' }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>{item.lane}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>P{item.priority}</span>
                  </div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)', lineHeight: 1.25 }}>{item.title}</h3>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{item.subtitle}</p>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-primary)', lineHeight: 1.35 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Next: </span>
                    {item.nextAction}
                  </p>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{item.status}</span>
                </Link>
              )) : (
                <div
                  className="md:col-span-3 rounded-lg p-4 text-sm"
                  style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                >
                  No commerce queue items need attention right now.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Agent Status */}
      <div 
        className="mb-6 rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div 
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="accent-line" />
            <h2 
              className="text-base font-semibold"
              style={{ 
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)'
              }}
            >
              <Users className="inline-block w-5 h-5 mr-2 mb-1" />
              Multi-Agent System
            </h2>
          </div>
          <div className="flex gap-2">
            <Link
              href="/agents"
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-3 rounded-lg transition-all hover:scale-105"
                style={{
                  backgroundColor: 'var(--card-elevated)',
                  border: `2px solid ${agent.color}`,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl">{agent.emoji}</div>
                  <Circle
                    className="w-2 h-2"
                    style={{
                      fill: agent.status === "online" ? "#4ade80" : "#6b7280",
                      color: agent.status === "online" ? "#4ade80" : "#6b7280",
                    }}
                  />
                </div>
                <div 
                  className="text-sm font-bold mb-1"
                  style={{ 
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {agent.name}
                </div>
                <div 
                  className="text-xs truncate mb-1"
                  style={{ color: 'var(--text-muted)' }}
                  title={agent.model}
                >
                  <Bot className="inline-block w-3 h-3 mr-1" />
                  {agent.model.split('/').pop()}
                </div>
                {agent.botToken && (
                  <div 
                    className="text-xs mt-1 flex items-center gap-1"
                    style={{ color: '#0088cc' }}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Connected
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Activity Feed */}
        <div 
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2 
                className="text-base font-semibold"
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)'
                }}
              >
                Recent Activity
              </h2>
            </div>
            <a
              href="/activity"
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </a>
          </div>
          <div className="p-0">
            <ActivityFeed limit={5} />
          </div>
        </div>

        {/* Quick Links */}
        <div 
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2 
                className="text-base font-semibold"
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)'
                }}
              >
                Quick Links
              </h2>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {[
              { href: "/cron", icon: Calendar, label: "Cron Jobs", color: "#a78bfa" },
              { href: "/actions", icon: Zap, label: "Quick Actions", color: "var(--accent)" },
              { href: "/commerce", icon: Store, label: "Commerce", color: "#22c55e" },
              { href: "/commerce/work-board", icon: Kanban, label: "Work Board", color: "#38bdf8" },
              { href: "/system", icon: Server, label: "System", color: "var(--success)" },
              { href: "/logs", icon: Terminal, label: "Live Logs", color: "#60a5fa" },
              { href: "/memory", icon: Brain, label: "Memory", color: "#f59e0b" },
              { href: "/skills", icon: Puzzle, label: "Skills", color: "#4ade80" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Notepad */}
          <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
            <Notepad />
          </div>
        </div>
      </div>
    </div>
  );
}
