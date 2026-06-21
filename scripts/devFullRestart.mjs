#!/usr/bin/env node
/* global console, process, setTimeout */

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';

const processComposeArgs = ['-U', '-u', '.tmp/process-compose.sock'];
const composeProfiles = ['telemetry', 'container-client', 'dashboard'];
const localEnv = readLocalEnv();
const localHost = '127.0.0.1';
const appProcesses = [
  'policies',
  'telegram',
  'llm-runner',
  'data',
  'pipelines',
  'triggers',
  'gateway',
  'dashboard-server',
  'dashboard'
];
const setupProcesses = ['infra-up', 'db-migrate', 'telegram-files-ready'];
const telemetryEnabled = enabled(configValue('AGENTG_TELEMETRY', '1'));
const expectedInfraServices = [
  'postgres',
  'nats',
  'telegram-files',
  ...(telemetryEnabled
    ? [
        'nats-exporter',
        'postgres-extensions',
        'postgres-exporter',
        'otel-collector',
        'victoria-metrics',
        'jaeger',
        'loki',
        'grafana'
      ]
    : [])
];
const productEndpoints = [
  endpoint('policies', 'http', 8705),
  endpoint('telegram', 'http', 8702),
  endpoint('llm-runner', 'http', 8707),
  endpoint('data', 'http', 8708),
  endpoint('pipelines', 'http', 8709),
  endpoint('triggers', 'http', 8706),
  endpoint('gateway', 'http', 8787),
  endpoint('dashboard-server', 'http', 8789),
  endpoint('dashboard', 'http', 8788)
];
const infraEndpoints = [
  endpoint('postgres', 'postgres', 5432),
  endpoint('nats', 'nats', 4222),
  endpoint('nats-monitor', 'http', 8222),
  endpoint('telegram-files', 'http', portFromConfig('TELEGRAM_FILES_PORT', 8790)),
  ...(telemetryEnabled
    ? [
        endpoint('otel-collector-grpc', 'grpc', 4317),
        endpoint('otel-collector-http', 'http', 4318),
        endpoint('victoria-metrics', 'http', 8428),
        endpoint('jaeger', 'http', 16686),
        endpoint('loki', 'http', 3100),
        endpoint('grafana', 'http', 3000)
      ]
    : [])
];
const serviceEndpoints = [...productEndpoints, ...infraEndpoints];

try {
  console.log('dev:full-restart: stopping');
  await stopProcessCompose();
  await run('docker', [
    'compose',
    ...composeProfiles.flatMap((profile) => ['--profile', profile]),
    'down'
  ]);

  console.log('dev:full-restart: starting');
  await run('npm', ['run', 'dev']);

  await waitUntil('process-compose services', checkProcessCompose, 420_000);
  await waitUntil('Docker infrastructure', checkDockerInfrastructure, 180_000);
  await waitUntil('TCP ports', checkPorts, 60_000);

  console.log(
    `dev:full-restart: ok (services ${appProcesses.length}/${appProcesses.length}, infra ${expectedInfraServices.length}/${expectedInfraServices.length}, ports ${serviceEndpoints.length}/${serviceEndpoints.length})`
  );
  printServiceEndpoints();
} catch (error) {
  console.error('dev:full-restart: failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function checkProcessCompose() {
  let processes;
  try {
    processes = await listProcessCompose();
  } catch (error) {
    return {
      ready: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  const byName = new Map(processes.map((entry) => [entry.name, entry]));
  const missing = [...setupProcesses, ...appProcesses].filter((name) => !byName.has(name));
  if (missing.length > 0) {
    return { ready: false, message: `missing processes: ${missing.join(', ')}` };
  }

  const failedSetup = setupProcesses
    .map((name) => byName.get(name))
    .filter((entry) => entry.status === 'Completed' && entry.exit_code !== 0);
  if (failedSetup.length > 0) {
    throw new Error(`setup processes failed: ${failedSetup.map(describeProcess).join('; ')}`);
  }

  const stoppedApps = appProcesses
    .map((name) => byName.get(name))
    .filter((entry) => !['Pending', 'Running'].includes(entry.status));
  if (stoppedApps.length > 0) {
    throw new Error(`app processes stopped: ${stoppedApps.map(describeProcess).join('; ')}`);
  }

  const restartedApps = appProcesses
    .map((name) => byName.get(name))
    .filter((entry) => entry.restarts > 0);
  if (restartedApps.length > 0) {
    throw new Error(
      `app processes restarted during startup: ${restartedApps.map(describeProcess).join('; ')}`
    );
  }

  const pendingSetup = setupProcesses
    .map((name) => byName.get(name))
    .filter((entry) => entry.status !== 'Completed' || entry.exit_code !== 0);
  const pendingApps = appProcesses
    .map((name) => byName.get(name))
    .filter((entry) => entry.status !== 'Running' || entry.is_ready !== 'Ready');

  if (pendingSetup.length === 0 && pendingApps.length === 0) {
    return { ready: true };
  }

  return {
    ready: false,
    message: [...pendingSetup, ...pendingApps].map(describeProcess).join('; ')
  };
}

async function checkDockerInfrastructure() {
  const containers = await listComposeContainers();
  const byService = new Map(containers.map((entry) => [entry.Service, entry]));
  const missing = expectedInfraServices.filter((service) => !byService.has(service));
  if (missing.length > 0) {
    return { ready: false, message: `missing containers: ${missing.join(', ')}` };
  }

  const notReady = [];
  for (const service of expectedInfraServices) {
    const container = byService.get(service);
    if (service === 'postgres-extensions') {
      if (container.State !== 'exited' || Number(container.ExitCode) !== 0) {
        notReady.push(describeContainer(container));
      }
      continue;
    }

    if (container.State !== 'running') {
      notReady.push(describeContainer(container));
      continue;
    }

    if (service === 'postgres' && container.Health !== 'healthy') {
      notReady.push(describeContainer(container));
    }
  }

  if (notReady.length === 0) {
    return { ready: true };
  }

  return { ready: false, message: notReady.join('; ') };
}

async function checkPorts() {
  const checks = await Promise.all(
    serviceEndpoints.map(async (entry) => ({
      ...entry,
      open: await canConnect(entry.port)
    }))
  );
  const closed = checks.filter((entry) => !entry.open);

  if (closed.length === 0) {
    return { ready: true };
  }

  return {
    ready: false,
    message: `closed ports: ${closed.map((entry) => `${entry.name}:${entry.port}`).join(', ')}`
  };
}

async function waitUntil(label, check, timeoutMs) {
  const startedAt = Date.now();
  let lastMessage;

  for (;;) {
    const result = await check();
    if (result.ready) {
      return;
    }

    lastMessage = result.message;
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `${label} did not become ready after ${Math.round(timeoutMs / 1000)}s: ${lastMessage}`
      );
    }

    await sleep(1_000);
  }
}

async function listProcessCompose() {
  const stdout = await runCapture('process-compose', [...processComposeArgs, 'list', '-o', 'json']);
  return JSON.parse(stdout);
}

async function listComposeContainers() {
  const stdout = await runCapture('docker', [
    'compose',
    ...composeProfiles.flatMap((profile) => ['--profile', profile]),
    'ps',
    '--all',
    '--format',
    'json'
  ]);

  return parseJsonRows(stdout);
}

async function stopProcessCompose() {
  const result = await runProcess('process-compose', [...processComposeArgs, 'down']);
  if (result.code === 0) {
    return;
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes('no such file or directory') || output.includes('connection refused')) {
    return;
  }

  throw new Error(commandFailure('process-compose', [...processComposeArgs, 'down'], result));
}

async function run(command, args) {
  const result = await runProcess(command, args);
  if (result.code !== 0) {
    throw new Error(commandFailure(command, args, result));
  }
}

async function runCapture(command, args) {
  const result = await runProcess(command, args);
  if (result.code !== 0) {
    throw new Error(commandFailure(command, args, result));
  }

  return result.stdout;
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8').trim(),
        stderr: Buffer.concat(stderr).toString('utf8').trim()
      });
    });
  });
}

function commandFailure(command, args, result) {
  return [
    `command failed: ${[command, ...args].join(' ')}`,
    result.stdout === '' ? undefined : `stdout:\n${result.stdout}`,
    result.stderr === '' ? undefined : `stderr:\n${result.stderr}`
  ]
    .filter(Boolean)
    .join('\n');
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;

    const finish = (open) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(1_000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function parseJsonRows(stdout) {
  if (stdout.trim() === '') {
    return [];
  }

  if (stdout.trim().startsWith('[')) {
    return JSON.parse(stdout);
  }

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function describeProcess(entry) {
  return `${entry.name} status=${entry.status} ready=${entry.is_ready} exit=${entry.exit_code} restarts=${entry.restarts}`;
}

function describeContainer(entry) {
  return `${entry.Service} state=${entry.State} health=${entry.Health || '-'} exit=${entry.ExitCode}`;
}

function printServiceEndpoints() {
  console.log('dev:full-restart: endpoints');
  for (const entry of serviceEndpoints) {
    console.log(`  ${entry.name} ${formatEndpoint(entry)}`);
  }
}

function endpoint(name, protocol, port) {
  return {
    name,
    protocol,
    host: localHost,
    port
  };
}

function formatEndpoint(entry) {
  return `${entry.protocol}://${entry.host}:${entry.port}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enabled(value) {
  return !['', '0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function configValue(name, fallback) {
  return process.env[name] ?? localEnv.get(name) ?? fallback;
}

function portFromConfig(name, fallback) {
  const value = Number(configValue(name, String(fallback)));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readLocalEnv() {
  if (!existsSync('.env')) {
    return new Map();
  }

  const entries = new Map();
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    entries.set(key, value);
  }

  return entries;
}
