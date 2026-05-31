#!/usr/bin/env node
/* global console, process */

import { spawnSync } from 'node:child_process';

const includeTelegram = process.env.COMPOSE_SMOKE_TELEGRAM === '1';
const profiles = ['control-plane'];
if (includeTelegram) {
  profiles.push('container-client');
}

const compose = ['docker', 'compose', ...profiles.flatMap((profile) => ['--profile', profile])];
const services = [
  'postgres',
  'nats',
  'registry',
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
    'control-plane',
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
import { callProcedure } from '@agentg/framework';

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

async function waitForModuleRegistrations(expectedModules, attempts = 20) {
  let snapshot;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    snapshot = await callProcedure('http://registry:8080', 'getSnapshot');
    const activeModules = new Set(snapshot.modules.map((module) => module.module));
    if (expectedModules.every((module) => activeModules.has(module))) {
      return snapshot;
    }
    await sleep(2_000);
  }

  throw new Error('Expected modules are not registered: ' + JSON.stringify({
    expectedModules,
    snapshot
  }));
}

const expectedModules = [
  ...(checkTelegram ? ['telegram'] : [])
];
const registry = await waitForModuleRegistrations(expectedModules);

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
  registry
}, null, 2));
`;
}
