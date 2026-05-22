"use client";

import { BRANDING } from "@/config/branding";

interface Workflow {
  id: string;
  emoji: string;
  name: string;
  description: string;
  schedule: string;
  steps: string[];
  status: "active" | "inactive";
  trigger: "cron" | "demand";
}

const WORKFLOWS: Workflow[] = [
  {
    id: "social-radar",
    emoji: "🔭",
    name: "Social Radar",
    description: "Monitors mentions, collaboration opportunities, and relevant conversations across social networks and forums.",
    schedule: "9:30 and 17:30 (daily)",
    trigger: "cron",
    status: "active",
    steps: [
      `Search for ${BRANDING.twitterHandle} mentions on Twitter/X, LinkedIn, and Instagram`,
      "Review Reddit threads in r/webdev, r/javascript, and r/learnprogramming",
      `Detect collaboration opportunities and inbound collabs (${BRANDING.ownerCollabEmail})`,
      "Monitor aprendiendo.dev in conversations and mentions",
      "Send a Telegram summary when something relevant appears",
    ],
  },
  {
    id: "noticias-ia",
    emoji: "📰",
    name: "AI and Web News",
    description: "Summarizes the most relevant AI and web development news from the Twitter timeline to start the day informed.",
    schedule: "7:45 (daily)",
    trigger: "cron",
    status: "active",
    steps: [
      "Read the Twitter/X timeline via bird CLI",
      "Filter AI, web dev, architecture, and developer tooling news",
      "Select the 5-7 most relevant stories for the target niche",
      "Generate a structured summary with links and context",
      "Send the digest by Telegram",
    ],
  },
  {
    id: "trend-monitor",
    emoji: "🔥",
    name: "Trend Monitor",
    description: "Urgent trend radar for the tech niche. Detects viral topics before they explode so content can catch the wave.",
    schedule: "7:00, 10:00, 15:00, and 20:00 (daily)",
    trigger: "cron",
    status: "active",
    steps: [
      "Monitor Twitter/X trending topics related to tech and programming",
      "Search Hacker News, dev.to, and GitHub Trending",
      "Evaluate whether the trend is relevant for the channel",
      "If something urgent appears, notify immediately with context",
      "Suggest a content angle when the trend has potential",
    ],
  },
  {
    id: "daily-linkedin",
    emoji: "📊",
    name: "Daily LinkedIn Brief",
    description: "Generates the day's LinkedIn post from the most relevant news on Hacker News, dev.to, and the tech web.",
    schedule: "9:00 (daily)",
    trigger: "cron",
    status: "active",
    steps: [
      "Collect top Hacker News posts from the tech/dev front page",
      "Review dev.to trending posts and featured articles",
      "Select the topic with the strongest engagement potential for the audience",
      "Draft a LinkedIn post in the target voice: professional and approachable, with no emojis or hashtags",
      "Send the draft by Telegram for review and publication",
    ],
  },
  {
    id: "newsletter-digest",
    emoji: "📬",
    name: "Newsletter Digest",
    description: "Curated digest of the day's newsletters. Consolidates the best subscription content into an actionable summary.",
    schedule: "20:00 (daily)",
    trigger: "cron",
    status: "active",
    steps: [
      "Access Gmail and find newsletters received today",
      "Filter by relevant senders: tech, AI, productivity, and investing",
      "Extract the key points from each newsletter",
      "Generate a structured digest by category",
      "Send the summary by Telegram",
    ],
  },
  {
    id: "email-categorization",
    emoji: "📧",
    name: "Email Categorization",
    description: "Categorizes and summarizes the day's email so the day can start without inbox anxiety.",
    schedule: "7:45 (daily)",
    trigger: "cron",
    status: "active",
    steps: [
      "Access Gmail and read today's unread emails",
      "Categorize: urgent / collabs / invoices / university / newsletters / other",
      "Summarize each category with recommended action",
      "Detect client emails with overdue invoices over 90 days",
      "Send a structured summary by Telegram",
    ],
  },
  {
    id: "weekly-newsletter",
    emoji: "📅",
    name: "Weekly Newsletter",
    description: "Automatic weekly recap of tweets and LinkedIn posts to use as the newsletter base.",
    schedule: "Sundays 18:00",
    trigger: "cron",
    status: "active",
    steps: [
      `Collect the week's tweets (${BRANDING.twitterHandle} via bird CLI)`,
      "Collect published LinkedIn posts",
      "Organize by topic and relevance",
      "Generate a weekly recap draft in a newsletter tone",
      "Send by Telegram for review before publishing",
    ],
  },
  {
    id: "advisory-board",
    emoji: "🏛️",
    name: "Advisory Board",
    description: "Seven AI advisors with their own personalities and memories. Consult any advisor or convene the full board.",
    schedule: "On demand",
    trigger: "demand",
    status: "active",
    steps: [
      "User sends /cfo, /cmo, /cto, /legal, /growth, /coach, or /product",
      "Load the advisory-board/SKILL.md skill",
      "Read the relevant advisor memory file in memory/advisors/",
      "Respond in the advisor's voice and personality with user context",
      "Update the memory file with what was learned in the consultation",
      "/board convenes all seven advisors in sequence and compiles a full board meeting",
    ],
  },
  {
    id: "git-backup",
    emoji: "🔄",
    name: "Git Backup",
    description: "Auto-commit and push the workspace every four hours so nothing gets lost.",
    schedule: "Every 4h",
    trigger: "cron",
    status: "active",
    steps: [
      "Check whether the workspace has changes",
      "If there are changes: git add -A",
      "Generate an automatic commit message with timestamp and change summary",
      "git push to the remote repository",
      "Stay quiet if there are no changes; only notify on error",
    ],
  },
  {
    id: "nightly-evolution",
    emoji: "🌙",
    name: "Nightly Evolution",
    description: "Autonomous nightly session that implements Mission Control improvements from the ROADMAP or proposes useful new features.",
    schedule: "3:00 (nightly)",
    trigger: "cron",
    status: "active",
    steps: [
      "Read Mission Control ROADMAP.md to select the next feature",
      "If no feature is clear, analyze the current state and propose something useful",
      "Implement the complete feature: code, tests when applicable, and UI",
      "Verify that the Next.js build passes",
      "Notify by Telegram with a summary of what was implemented",
    ],
  },
  {
    id: "commerce-studio",
    emoji: "🛍️",
    name: "Commerce Studio",
    description: "Future Etsy and Printify workflow for product ideation, approval, listing prep, and fulfillment tracking.",
    schedule: "On demand",
    trigger: "demand",
    status: "inactive",
    steps: [
      "Generate new product ideas from trends, memory, and shop constraints",
      "Prepare draft artwork notes, Etsy copy, tags, pricing assumptions, and risk notes",
      "Wait for explicit approval before creating or publishing anything externally",
      "Draft approved products for Etsy once credentials and approval rules are configured",
      "Track Printify production and shipping after an approved order workflow exists",
    ],
  },
];

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <div style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: status === "active" ? "var(--positive)" : "var(--text-muted)",
      }} />
      <span style={{
        fontFamily: "var(--font-body)",
        fontSize: "10px",
        fontWeight: 600,
        color: status === "active" ? "var(--positive)" : "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}>
        {status === "active" ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

function TriggerBadge({ trigger }: { trigger: "cron" | "demand" }) {
  return (
    <div style={{
      padding: "2px 7px",
      backgroundColor: trigger === "cron"
        ? "rgba(59, 130, 246, 0.12)"
        : "rgba(168, 85, 247, 0.12)",
      border: `1px solid ${trigger === "cron" ? "rgba(59, 130, 246, 0.25)" : "rgba(168, 85, 247, 0.25)"}`,
      borderRadius: "5px",
      fontFamily: "var(--font-body)",
      fontSize: "10px",
      fontWeight: 600,
      color: trigger === "cron" ? "#60a5fa" : "var(--accent)",
      letterSpacing: "0.4px",
      textTransform: "uppercase" as const,
    }}>
      {trigger === "cron" ? "⏱ Cron" : "⚡ On demand"}
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "24px",
          fontWeight: 700,
          letterSpacing: "-1px",
          color: "var(--text-primary)",
          marginBottom: "4px",
        }}>
          Workflows
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
          {WORKFLOWS.filter(w => w.status === "active").length} active workflows · {WORKFLOWS.filter(w => w.trigger === "cron").length} automated crons · {WORKFLOWS.filter(w => w.trigger === "demand").length} on demand
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap" }}>
        {[
          { label: "Total workflows", value: WORKFLOWS.length, color: "var(--text-primary)" },
          { label: "Active crons", value: WORKFLOWS.filter(w => w.trigger === "cron" && w.status === "active").length, color: "#60a5fa" },
          { label: "On demand", value: WORKFLOWS.filter(w => w.trigger === "demand").length, color: "var(--accent)" },
        ].map((stat) => (
          <div key={stat.label} style={{
            padding: "16px 20px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            minWidth: "140px",
          }}>
            <div style={{
              fontFamily: "var(--font-heading)",
              fontSize: "28px",
              fontWeight: 700,
              color: stat.color,
              letterSpacing: "-1px",
            }}>
              {stat.value}
            </div>
            <div style={{
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "2px",
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Workflow cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {WORKFLOWS.map((workflow) => (
          <div key={workflow.id} style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px 24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}>
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "var(--surface-elevated)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  border: "1px solid var(--border-strong)",
                  flexShrink: 0,
                }}>
                  {workflow.emoji}
                </div>
                <div>
                  <h3 style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.3px",
                    marginBottom: "2px",
                  }}>
                    {workflow.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TriggerBadge trigger={workflow.trigger} />
                    <StatusBadge status={workflow.status} />
                  </div>
                </div>
              </div>
              {/* Schedule */}
              <div style={{
                padding: "6px 12px",
                backgroundColor: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap" as const,
                flexShrink: 0,
              }}>
                🕐 {workflow.schedule}
              </div>
            </div>

            {/* Description */}
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: "1.6",
              marginBottom: "16px",
            }}>
              {workflow.description}
            </p>

            {/* Steps */}
            <div style={{
              backgroundColor: "var(--surface-elevated)",
              borderRadius: "10px",
              padding: "12px 16px",
              border: "1px solid var(--border)",
            }}>
              <div style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                marginBottom: "8px",
              }}>
                Steps
              </div>
              <ol style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {workflow.steps.map((step, i) => (
                  <li key={i} style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    lineHeight: "1.5",
                  }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
