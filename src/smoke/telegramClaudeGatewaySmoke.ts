import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { NotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { createApp } from '../app/createApp.js';
import type { AppRuntime } from '../app/createApp.js';
import { hasTelegramCredentials } from '../telegram/tdlibClient.js';

const SMOKE_TIMEOUT_MS = 180_000;
const ClaudeChannelNotificationSchema = NotificationSchema.extend({
  method: z.literal('notifications/claude/channel')
});

async function main(): Promise<void> {
  const existingGatewayWsUrl = process.env.AGENTG_GATEWAY_WS_URL;
  if (existingGatewayWsUrl !== undefined && existingGatewayWsUrl.length > 0) {
    await runSmokeAgainstGateway(existingGatewayWsUrl);
    return;
  }

  const gatewayPort = await reservePort();
  const cwd = mkdtempSync(join(tmpdir(), 'agentg-telegram-claude-'));
  process.env.AGENTG_SQLITE_PATH = join(cwd, 'agentg.sqlite');
  process.env.GATEWAY_ENABLED = 'true';
  process.env.GATEWAY_HOST = '127.0.0.1';
  process.env.GATEWAY_PORT = String(gatewayPort);

  const app = createApp();
  if (!hasTelegramCredentials(app.config.tdlib)) {
    throw new Error('Real Telegram smoke requires TELEGRAM_API_ID and TELEGRAM_API_HASH');
  }

  const appStart = app.start();
  await waitForGatewayHandle(app);

  try {
    await runSmokeAgainstGateway(`ws://127.0.0.1:${String(gatewayPort)}/`, async () => {
      await appStart;
    });
  } finally {
    await app.stop();
  }
}

async function runSmokeAgainstGateway(
  gatewayWsUrl: string,
  beforeWait?: () => Promise<void>
): Promise<void> {
  const mcpClient = new Client(
    { name: 'agentg-smoke', version: '0.1.0' },
    {
      capabilities: {
        experimental: {
          'claude/channel': {}
        }
      }
    }
  );
  const channelNotification = waitForClaudeChannelEvent(
    mcpClient,
    'telegram.message.created',
    SMOKE_TIMEOUT_MS
  );
  const transport = new StdioClientTransport({
    args: ['run', '--silent', 'claude:channel'],
    command: 'npm',
    cwd: process.cwd(),
    env: {
      ...stringEnvironment(process.env),
      AGENTG_GATEWAY_WS_URL: gatewayWsUrl
    },
    stderr: 'pipe'
  });

  try {
    await mcpClient.connect(transport);
    await beforeWait?.();
    const notification = await channelNotification;
    console.log(
      JSON.stringify({
        event: 'telegram_claude_smoke.reacted',
        notification: notification.method,
        telegramEvent: notification.telegramEvent
      })
    );
  } finally {
    await mcpClient.close();
  }
}

async function waitForGatewayHandle(app: AppRuntime): Promise<void> {
  const startedAt = Date.now();
  while (app.edges.gateway === undefined) {
    if (Date.now() - startedAt > 10_000) {
      throw new Error('Gateway did not start before timeout');
    }
    await delay(20);
  }
}

function waitForClaudeChannelEvent(
  client: Client,
  eventType: string,
  timeoutMs: number
): Promise<{ method: string; telegramEvent: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Claude channel event: ${eventType}`));
    }, timeoutMs);

    client.setNotificationHandler(ClaudeChannelNotificationSchema, (notification) => {
      const payload = readClaudeChannelPayload(notification.params);
      if (payload?.event !== eventType) {
        return;
      }

      clearTimeout(timeout);
      resolve({
        method: notification.method,
        telegramEvent: payload.event
      });
    });
  });
}

function readClaudeChannelPayload(params: unknown): { event: string } | undefined {
  const record = readRecord(params);
  if (typeof record?.content !== 'string') {
    return undefined;
  }

  try {
    const payload = readRecord(JSON.parse(record.content) as unknown);
    return typeof payload?.event === 'string' ? { event: payload.event } : undefined;
  } catch {
    return undefined;
  }
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('TCP server did not expose a port');
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  return address.port;
}

function stringEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telegram_claude_smoke.failed'
    })
  );
  process.exitCode = 1;
});
