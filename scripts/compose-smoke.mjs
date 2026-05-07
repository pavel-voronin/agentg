#!/usr/bin/env node
/* global console, process */

import { spawnSync } from 'node:child_process';

const includeTelegram = process.env.COMPOSE_SMOKE_TELEGRAM === '1';
const profiles = ['history', 'gateway', 'summaries', 'control-plane'];
if (includeTelegram) {
  profiles.push('container-client');
}

const compose = ['docker', 'compose', ...profiles.flatMap((profile) => ['--profile', profile])];
const services = [
  'postgres',
  'nats',
  'service-directory',
  'history',
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
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';

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

async function waitForExtensionRegistration(client, target, extension, attempts = 20) {
  let snapshot;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    snapshot = await client.refresh();
    if (snapshot.extensions.some((item) => item.target === target && item.extension === extension)) {
      return snapshot;
    }
    await sleep(2_000);
  }

  throw new Error(extension + ' is not registered for ' + target + ': ' + JSON.stringify(snapshot));
}

const extensionTarget = 'telegram.chat';
const extensionMethod = 'summaries.chatSummary';
const base = {
  chat: {
    _model: extensionTarget,
    id: 'compose-smoke-chat',
    title: 'Compose Smoke Chat',
    type: 'private'
  }
};
const serviceDirectoryClient = createServiceDirectoryClient({
  url: 'http://service-directory:8080'
});
const serviceDirectory = await waitForExtensionRegistration(
  serviceDirectoryClient,
  extensionTarget,
  extensionMethod
);
const summariesRpcUrl = serviceDirectoryClient.resolveProcedure('summaries.requestSummary').rpcUrl;

const summariesClient = createTRPCUntypedClient({
  links: [httpBatchLink({ url: summariesRpcUrl })]
});
const now = new Date().toISOString();
const summaryRequest = await summariesClient.mutation('requestSummary', {
  chatId: base.chat.id,
  reason: 'compose-smoke',
  sourceMessages: [
    { messageId: 'compose-smoke-1', messageDate: now, text: 'First message for compose smoke' },
    { messageId: 'compose-smoke-2', messageDate: now, text: 'Second message for compose smoke' }
  ]
});
const summaryExtension = await summariesClient.query('chatSummary', base.chat);
if (summaryExtension.summary?.chatId !== base.chat.id || summaryExtension.stale !== false) {
  throw new Error(extensionMethod + ' did not return a fresh summary: ' + JSON.stringify(summaryExtension));
}
const composed = {
  base,
  extensions: [
    {
      extension: extensionMethod,
      model: {
        _model: base.chat._model,
        id: base.chat.id
      },
      result: summaryExtension
    }
  ]
};

const controlPlaneResponse = await fetchUntilReady('http://control-plane:8788/', 'control-plane', [200]);

if (${JSON.stringify(checkTelegram)}) {
  await fetchUntilReady('http://telegram:8080/', 'telegram RPC', [404], 30);
}

console.log(JSON.stringify({
  event: 'compose.smoke.ok',
  controlPlane: {
    contentType: controlPlaneResponse.headers.get('content-type'),
    status: controlPlaneResponse.status
  },
  composed,
  serviceDirectory,
  summaryRequest
}, null, 2));
serviceDirectoryClient.close();
`;
}
