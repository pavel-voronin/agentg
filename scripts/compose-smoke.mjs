#!/usr/bin/env node
/* global console, process */

import { spawnSync } from 'node:child_process';

const includeTelegram = process.env.COMPOSE_SMOKE_TELEGRAM === '1';
const profiles = ['history-sync', 'gateway', 'summaries', 'control-plane'];
if (includeTelegram) {
  profiles.push('container-client');
}

const compose = ['docker', 'compose', ...profiles.flatMap((profile) => ['--profile', profile])];
const services = [
  'postgres',
  'nats',
  'history-sync',
  'gateway',
  'summaries',
  'control-plane',
  ...(includeTelegram ? ['telegram'] : [])
];

try {
  run(['up', '-d', 'postgres', 'nats', '--quiet-pull']);
  runNpm(['run', 'db:migrate']);
  run([
    'rm',
    '--stop',
    '--force',
    ...services.filter((service) => service !== 'postgres' && service !== 'nats')
  ]);
  run(['up', '--build', '-d', ...services]);
  run([
    'run',
    '--rm',
    '--no-deps',
    'summaries',
    'node',
    '--input-type=module',
    '--eval',
    smokeDriver(includeTelegram)
  ]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  run(
    [
      'logs',
      '--tail=160',
      ...services.filter((service) => service !== 'postgres' && service !== 'nats')
    ],
    {
      check: false
    }
  );
  process.exit(1);
}

function run(args, options = {}) {
  const result = spawnSync(compose[0], [...compose.slice(1), ...args], {
    encoding: 'utf8',
    stdio: 'inherit'
  });

  if (options.check === false || result.status === 0) {
    return;
  }

  throw new Error(`Command failed: ${[compose[0], ...compose.slice(1), ...args].join(' ')}`);
}

function runNpm(args) {
  const result = spawnSync('npm', args, {
    encoding: 'utf8',
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: npm ${args.join(' ')}`);
  }
}

function smokeDriver(checkTelegram) {
  return `
import { randomUUID } from 'node:crypto';
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
import { WebSocket } from 'ws';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUntilReady(url, service, acceptedStatuses, attempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (acceptedStatuses.includes(response.status)) {
        return response;
      }
      lastError = new Error(service + ' returned HTTP ' + String(response.status));
    } catch (error) {
      lastError = error;
    }
    await sleep(2_000);
  }

  throw new Error(service + ' did not become ready: ' + (lastError instanceof Error ? lastError.message : String(lastError)));
}

async function withGateway(fn) {
  const socket = new WebSocket('ws://gateway:8787');
  const pending = new Map();
  const timeout = setTimeout(() => {
    socket.terminate();
    for (const entry of pending.values()) {
      entry.reject(new Error('gateway request timed out'));
    }
  }, 60_000);

  socket.on('message', (payload) => {
    const response = JSON.parse(payload.toString());
    const entry = pending.get(response.id);
    if (entry === undefined) {
      return;
    }
    pending.delete(response.id);
    if (response.error !== undefined) {
      entry.reject(new Error(response.error.message));
      return;
    }
    entry.resolve(response.result);
  });

  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  async function request(method, params) {
    const id = 'compose_smoke_' + randomUUID();
    const promise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  try {
    return await fn(request);
  } finally {
    clearTimeout(timeout);
    socket.close();
  }
}

const gatewayResult = await withGateway(async (request) => {
  let capabilities;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    capabilities = await request('capabilities.list');
    if (capabilities.capabilities?.some((item) => item.name === 'summaries.requestChatSummary')) {
      break;
    }
    await sleep(2_000);
  }

  if (!capabilities.capabilities?.some((item) => item.name === 'summaries.requestChatSummary')) {
    throw new Error('summaries.requestChatSummary is not registered: ' + JSON.stringify(capabilities));
  }

  const now = new Date().toISOString();
  const capabilityCall = await request('capabilities.call', {
    name: 'summaries.requestChatSummary',
    input: {
      chatId: 'compose-smoke-chat',
      reason: 'compose-smoke',
      sourceMessages: [
        { messageId: 'compose-smoke-1', messageDate: now, text: 'First message for compose smoke' },
        { messageId: 'compose-smoke-2', messageDate: now, text: 'Second message for compose smoke' }
      ]
    }
  });

  return { capabilities, capabilityCall };
});

const historyClient = createTRPCUntypedClient({
  links: [httpBatchLink({ url: 'http://history-sync:8080' })]
});
const extensionsEnvelope = await historyClient.query('listExtensions');
const extensions = extensionsEnvelope?.result ?? extensionsEnvelope;
if (!extensions.extensions?.some((item) => item.target === 'history.getChatHistoryState' && item.extension === 'summaries.chatSummary')) {
  throw new Error('summaries.chatSummary extension is not registered: ' + JSON.stringify(extensionsEnvelope));
}

const controlPlaneResponse = await fetchUntilReady('http://control-plane:8788/', 'control-plane', [200]);

if (${JSON.stringify(checkTelegram)}) {
  await fetchUntilReady('http://telegram:8080/', 'telegram RPC', [404], 30);
}

console.log(JSON.stringify({
  event: 'compose.smoke.ok',
  capability: gatewayResult.capabilityCall,
  controlPlane: {
    contentType: controlPlaneResponse.headers.get('content-type'),
    status: controlPlaneResponse.status
  },
  extensions
}, null, 2));
`;
}
