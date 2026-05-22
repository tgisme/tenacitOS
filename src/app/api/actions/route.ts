/**
 * Quick Actions API
 * POST /api/actions  body: { action }
 * Available actions: git-status, restart-gateway, clear-temp, usage-stats, heartbeat
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { logActivity } from '@/lib/activities-db';
import { OPENCLAW_DIR, OPENCLAW_WORKSPACE } from '@/lib/paths';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const WORKSPACE = OPENCLAW_WORKSPACE;
const ACTION_TIMEOUT_MS = 20000;
const DANGEROUS_ACTIONS = new Set([
  'restart-gateway',
  'restart-dashboard',
  'clear-stale-sessions',
  'clear-temp',
]);
const USER_SERVICES = new Set(['openclaw-gateway', 'mission-control']);

interface ActionResult {
  action: string;
  status: 'success' | 'error';
  output: string;
  duration_ms: number;
  timestamp: string;
}

async function runAction(action: string): Promise<ActionResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    let output = '';

    switch (action) {
      case 'git-status': {
        // Find all git repos in workspace and get their status
        const { stdout: dirs } = await execAsync(`find "${WORKSPACE}" -maxdepth 2 -name ".git" -type d 2>/dev/null | head -10`);
        const repoPaths = dirs.trim().split('\n').filter(Boolean).map((d) => d.replace('/.git', ''));

        const results: string[] = [];
        for (const repoPath of repoPaths) {
          const name = repoPath.split('/').pop() || repoPath;
          try {
            const { stdout: status } = await execAsync(`cd "${repoPath}" && git status --short && git log --oneline -3 2>&1`);
            results.push(`📁 ${name}:\n${status || '(clean)'}`);
          } catch {
            results.push(`📁 ${name}: (error reading git status)`);
          }
        }
        output = results.length ? results.join('\n\n') : 'No git repos found in workspace';
        break;
      }

      case 'restart-gateway': {
        output = await restartSystemdService('openclaw-gateway');
        break;
      }

      case 'restart-dashboard': {
        output = await restartDashboard();
        break;
      }

      case 'gateway-logs': {
        const { stdout } = await execFileAsync('journalctl', ['--user', '-u', 'openclaw-gateway', '-n', '160', '--no-pager'], {
          timeout: ACTION_TIMEOUT_MS,
          encoding: 'utf-8',
        });
        output = stdout.trim() || 'No gateway logs returned';
        break;
      }

      case 'clear-stale-sessions': {
        output = clearStaleSessions();
        break;
      }

      case 'clear-temp': {
        const commands = [
          'find /tmp -maxdepth 1 -type f -mtime +1 -delete 2>/dev/null; echo "Cleaned /tmp"',
          `find "${WORKSPACE}" \\( -name "*.tmp" -o -name "*.bak" \\) -type f | head -20 | xargs -r trash 2>/dev/null; echo "Moved workspace tmp/bak files to trash where available"`,
          `find "${OPENCLAW_DIR}/logs" -name "*.log" -size +50M -exec truncate -s 10M {} \\; 2>/dev/null; echo "Trimmed large OpenClaw logs"`,
        ];
        const results = await Promise.all(commands.map((cmd) => execAsync(cmd, { timeout: ACTION_TIMEOUT_MS }).then((r) => r.stdout).catch((e) => e.message)));
        output = results.join('\n');
        break;
      }

      case 'usage-stats': {
        const { stdout: du } = await execAsync(`du -sh "${WORKSPACE}" 2>/dev/null || echo "N/A"`, { timeout: ACTION_TIMEOUT_MS });
        const { stdout: df } = await execFileAsync('df', ['-h', '/'], { timeout: ACTION_TIMEOUT_MS, encoding: 'utf-8' });
        const { stdout: mem } = await execFileAsync('free', ['-h'], { timeout: ACTION_TIMEOUT_MS, encoding: 'utf-8' });
        const { stdout: uptime } = await execFileAsync('uptime', ['-p'], { timeout: ACTION_TIMEOUT_MS, encoding: 'utf-8' });
        output = `Workspace: ${du.trim()}\n\nDisk:\n${df.trim()}\n\nMemory:\n${mem.split('\n').slice(0, 2).join('\n').trim()}\n\nUptime: ${uptime.trim()}`;
        break;
      }

      case 'heartbeat': {
        const results: string[] = [];

        try {
          const { stdout } = await execFileAsync('systemctl', ['--user', 'is-active', 'openclaw-gateway'], {
            timeout: ACTION_TIMEOUT_MS,
            encoding: 'utf-8',
          });
          const status = stdout.trim();
          results.push(`${status === 'active' ? 'OK' : 'WARN'} openclaw-gateway: ${status}`);
        } catch {
          results.push('WARN openclaw-gateway: inactive or unavailable');
        }

        try {
          const { stdout } = await execFileAsync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', 'http://127.0.0.1:3000'], {
            timeout: ACTION_TIMEOUT_MS,
            encoding: 'utf-8',
          });
          results.push(`OK dashboard-local: HTTP ${stdout.trim()}`);
        } catch {
          results.push('WARN dashboard-local: unreachable');
        }

        output = results.join('\n');
        break;
      }

      case 'npm-audit': {
        const { stdout, stderr } = await execAsync(`npm audit --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf-8');const j=JSON.parse(d);console.log('Vulnerabilities: '+JSON.stringify(j.metadata?.vulnerabilities||{}))" 2>&1`, {
          cwd: process.cwd(),
          timeout: ACTION_TIMEOUT_MS,
        }).catch((e) => ({ stdout: '', stderr: e.message }));
        output = stdout || stderr || 'Audit completed';
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const duration_ms = Date.now() - start;
    logActivity('command', `Quick action: ${action}`, 'success', { duration_ms, metadata: { action } });

    return { action, status: 'success', output, duration_ms, timestamp };
  } catch (err) {
    const duration_ms = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    logActivity('command', `Quick action failed: ${action}`, 'error', { duration_ms, metadata: { action, error: errMsg } });
    return { action, status: 'error', output: errMsg, duration_ms, timestamp };
  }
}

async function restartSystemdService(service: string): Promise<string> {
  const args = USER_SERVICES.has(service)
    ? ['--user', 'restart', service]
    : ['restart', service];

  await execFileAsync('systemctl', args, {
    timeout: ACTION_TIMEOUT_MS,
    encoding: 'utf-8',
  });

  const statusArgs = USER_SERVICES.has(service)
    ? ['--user', 'is-active', service]
    : ['is-active', service];

  const { stdout } = await execFileAsync('systemctl', statusArgs, {
    timeout: ACTION_TIMEOUT_MS,
    encoding: 'utf-8',
  });

  return `${service} restart requested\nStatus: ${stdout.trim()}`;
}

async function restartDashboard(): Promise<string> {
  try {
    return await restartSystemdService('mission-control');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      'Dashboard restart was not executed because this dev server is not managed by the mission-control systemd service.',
      'The local Next.js dev process is still running under the current shell.',
      '',
      `Systemd detail: ${message}`,
    ].join('\n');
  }
}

function clearStaleSessions(): string {
  const sessionsPath = join(OPENCLAW_DIR, 'agents', 'main', 'sessions', 'sessions.json');

  if (!existsSync(sessionsPath)) {
    return `No session index found at ${sessionsPath}`;
  }

  const raw = readFileSync(sessionsPath, 'utf-8');
  const sessions = JSON.parse(raw) as Record<string, Record<string, unknown>>;
  const entries = Object.entries(sessions);
  const staleCutoffMs = Date.now() - 1000 * 60 * 60 * 24 * 14;
  const kept: Record<string, Record<string, unknown>> = {};
  const removed: string[] = [];

  for (const [key, value] of entries) {
    const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : 0;
    const isRunEntry = key.split(':').includes('run');
    const isAborted = value.abortedLastRun === true;
    const isStaleTokenSnapshot = value.totalTokensFresh === false && updatedAt > 0 && updatedAt < staleCutoffMs;

    if (isRunEntry || isAborted || isStaleTokenSnapshot) {
      removed.push(key);
      continue;
    }

    kept[key] = value;
  }

  if (removed.length === 0) {
    return 'No stale, aborted, or duplicate run session records found.';
  }

  const backupPath = `${sessionsPath}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  writeFileSync(backupPath, raw);
  writeFileSync(sessionsPath, `${JSON.stringify(kept, null, 2)}\n`);

  return [
    `Backed up session index to ${backupPath}`,
    `Removed ${removed.length} record(s):`,
    ...removed.slice(0, 40).map((key) => `- ${key}`),
    removed.length > 40 ? `...and ${removed.length - 40} more` : '',
  ].filter(Boolean).join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, confirmed } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const validActions = [
      'git-status',
      'restart-gateway',
      'restart-dashboard',
      'gateway-logs',
      'clear-stale-sessions',
      'clear-temp',
      'usage-stats',
      'heartbeat',
      'npm-audit',
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Unknown action. Valid: ${validActions.join(', ')}` }, { status: 400 });
    }

    if (DANGEROUS_ACTIONS.has(action) && confirmed !== true) {
      return NextResponse.json(
        { error: 'This action requires explicit confirmation.', confirmationRequired: true },
        { status: 409 },
      );
    }

    const result = await runAction(action);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[actions] Error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
