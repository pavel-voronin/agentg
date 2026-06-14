#!/usr/bin/env node
/* global console, process */

import { spawnSync } from 'node:child_process';

const includeTelegram = process.env.COMPOSE_SMOKE_TELEGRAM === '1';
const profiles = ['dashboard'];
if (includeTelegram) {
  profiles.push('container-client');
}

const compose = ['docker', 'compose', ...profiles.flatMap((profile) => ['--profile', profile])];
const services = ['postgres', 'nats', 'policies', 'telegram', 'gateway', 'dashboard'];

try {
  run(['up', '-d', 'postgres', 'nats', '--quiet-pull']);
  runNpm(['run', 'db:migrate'], {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      NATS_URL: process.env.NATS_URL ?? 'nats://127.0.0.1:4222',
      TELEGRAM_RPC_URL: process.env.TELEGRAM_RPC_URL ?? 'http://127.0.0.1:8702'
    }
  });
  run([
    'rm',
    '--stop',
    '--force',
    ...services.filter((service) => service !== 'postgres' && service !== 'nats')
  ]);
  run(['up', '--build', '-d', ...services]);
  run(['exec', '-T', 'dashboard', 'node', '--input-type=module', '--eval', smokeDriver()]);
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

function runNpm(args, options = {}) {
  const result = spawnSync('npm', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.env ?? {})
    },
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: npm ${args.join(' ')}`);
  }
}

function smokeDriver() {
  return `
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

async function callProcedureUntilReady(url, service, procedure, input, attempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url + '/rpc', {
        body: JSON.stringify({ input, procedure }),
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST'
      });
      const body = await response.json();
      if (response.ok && body?.ok === true && 'result' in body) {
        return body.result;
      }
      lastError = new Error(service + ' returned HTTP ' + String(response.status) + ': ' + JSON.stringify(body));
    } catch (error) {
      lastError = error;
    }
    await sleep(2_000);
  }

  throw new Error(service + ' did not become ready: ' + (lastError instanceof Error ? lastError.message : String(lastError)));
}

const dashboardResponse = await fetchUntilReady('http://127.0.0.1:8080/healthz', 'dashboard', [200]);
const policyKinds = await callProcedureUntilReady(
  'http://policies:8080',
  'policies RPC',
  'listPolicyKinds',
  undefined
);
if (!policyKinds.some((kind) => kind.kind === 'TelegramFileDownloadRule')) {
  throw new Error('policies smoke expected TelegramFileDownloadRule kind');
}

const downloadRules = await callProcedureUntilReady(
  'http://policies:8080',
  'policies RPC',
  'getPolicyValue',
  {
    kind: 'TelegramFileDownloadRule'
  }
);
if (!Array.isArray(downloadRules) || downloadRules.length === 0) {
  throw new Error('policies smoke expected non-empty TelegramFileDownloadRule value');
}

const telegramChat = await callProcedureUntilReady('http://telegram:8080', 'telegram RPC', 'getChat', {
  chatId: '0'
});
if (telegramChat.chat !== null) {
  throw new Error('telegram smoke expected missing chat to return null');
}

console.log(
  JSON.stringify(
    {
      event: 'compose.smoke.ok',
      dashboard: {
        contentType: dashboardResponse.headers.get('content-type'),
        status: dashboardResponse.status
      },
      policies: {
        downloadRules: downloadRules.length,
        kinds: policyKinds.length
      },
      telegram: {
        chat: telegramChat.chat
      }
    },
    null,
    2
  )
);
`;
}
