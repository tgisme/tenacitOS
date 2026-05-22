import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

import { OPENCLAW_DIR, OPENCLAW_WORKSPACE } from '@/lib/paths';

const execFileAsync = promisify(execFile);

async function getUserServiceStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('systemctl', ['--user', 'is-active', name], {
      timeout: 3000,
    });
    return stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const gatewayStatus = await getUserServiceStatus('openclaw-gateway.service');

  return NextResponse.json({
    mode: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') ? 'local-only' : 'network',
    baseUrl,
    gateway: {
      name: 'OpenClaw Gateway',
      status: gatewayStatus,
      healthy: gatewayStatus === 'active',
    },
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: os.uptime(),
      nodeVersion: process.version,
    },
    paths: {
      openclawDir: OPENCLAW_DIR,
      workspace: OPENCLAW_WORKSPACE,
    },
    timestamp: new Date().toISOString(),
  });
}
