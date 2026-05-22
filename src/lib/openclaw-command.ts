import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

const bundledNode = path.join(os.homedir(), '.nvm', 'versions', 'node', 'v26.2.0', 'bin', 'node');
const bundledCli = path.join(os.homedir(), '.nvm', 'versions', 'node', 'v26.2.0', 'lib', 'node_modules', 'openclaw', 'openclaw.mjs');

export function runOpenClaw(args: string[], timeout = 10000): string {
  if (existsSync(bundledNode) && existsSync(bundledCli)) {
    return execFileSync(bundledNode, [bundledCli, ...args], {
      timeout,
      encoding: 'utf-8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  return execFileSync('openclaw', args, {
    timeout,
    encoding: 'utf-8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
