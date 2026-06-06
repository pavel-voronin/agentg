#!/usr/bin/env node
/* global console, process */

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';

const setupCommands = [['docker', ['compose', 'up', '-d', 'postgres', 'nats', '--quiet-pull']]];
const storagePath = resolve('.tmp', 'telemetry', 'events.sqlite');

const children = new Set();
let shuttingDown = false;
const tcpMonitors = new Map();
const TCP_MONITOR_INTERVAL_MS = 1000;
const TCP_UNAVAILABLE_GRACE_MS = 15000;

try {
  for (const [command, args] of setupCommands) {
    await runChecked(command, args);
  }

  startDevProcess('registry', 'npm', ['run', 'dev:registry']);
  await waitForTcp('registry RPC', '127.0.0.1', 8701);

  startDevProcess('telemetry', 'npm', ['run', 'dev:telemetry']);
  await waitForTcp('telemetry RPC', '127.0.0.1', 8705);

  startDevProcess('telegram', 'npm', ['run', 'dev:telegram']);
  await waitForTcp('telegram RPC', '127.0.0.1', 8702);

  startDevProcess('history-sync', 'npm', ['run', 'dev:history-sync']);
  await waitForTcp('history-sync RPC', '127.0.0.1', 8704);

  startDevProcess('gateway', 'npm', ['run', 'dev:gateway']);
  await waitForTcp('gateway', '127.0.0.1', 8787);

  startTcpDevProcess(
    'control-plane-server',
    'npm',
    ['run', 'dev:control-plane-server'],
    '127.0.0.1',
    8789
  );
  await waitForTcp('control-plane server', '127.0.0.1', 8789);

  startTcpDevProcess('control-plane', 'npm', ['run', 'dev:control-plane'], '127.0.0.1', 8788);
  await waitForTcp('control-plane', '127.0.0.1', 8788);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopChildren('SIGTERM');
  process.exit(1);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

async function runChecked(command, args) {
  const result = await run(command, args);
  if (result.code === 0) {
    return;
  }

  throw new Error(`Command failed: ${[command, ...args].join(' ')}`);
}

function run(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit'
  });

  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

function startDevProcess(name, command, args) {
  const startedAt = Date.now();
  const child = spawn(command, args, {
    env: devProcessEnv(name),
    stdio: 'inherit'
  });
  children.add(child);

  child.once('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown) {
      return;
    }

    const status = signal === null ? `code ${String(code)}` : `signal ${signal}`;
    console.error(`${name} exited with ${status}`);
    stopChildren('SIGTERM');
    process.exit(code ?? 1);
  });
  return {
    child,
    startedAt
  };
}

function devProcessEnv(name) {
  return {
    ...process.env,
    AGENTG_TELEMETRY: process.env.AGENTG_TELEMETRY ?? '1',
    AGENTG_TELEMETRY_SQLITE_PATH: process.env.AGENTG_TELEMETRY_SQLITE_PATH ?? storagePath,
    AGENTG_TELEMETRY_SOURCE: name
  };
}

function startTcpDevProcess(name, command, args, host, port) {
  const started = startDevProcess(name, command, args);
  monitorTcpProcess(name, host, port);
  return started;
}

function monitorTcpProcess(name, host, port) {
  const key = `${host}:${String(port)}`;
  if (tcpMonitors.has(key)) {
    return;
  }

  let missingSince = null;
  const monitor = setInterval(() => {
    void (async () => {
      if (shuttingDown) {
        clearInterval(monitor);
        tcpMonitors.delete(key);
        return;
      }
      const listening = await canConnect(host, port);
      if (listening) {
        missingSince = null;
        return;
      }
      missingSince ??= Date.now();
      if (Date.now() - missingSince < TCP_UNAVAILABLE_GRACE_MS) {
        return;
      }

      console.error(`${name} stopped listening on ${key}`);
      stopChildren('SIGTERM');
      process.exit(1);
    })();
  }, TCP_MONITOR_INTERVAL_MS);

  tcpMonitors.set(key, monitor);
}

async function waitForTcp(name, host, port) {
  console.log(`Waiting for ${name} at ${host}:${String(port)}`);
  while (!shuttingDown) {
    if (await canConnect(host, port)) {
      return;
    }
    await delay(250);
  }
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function shutdown(signal) {
  shuttingDown = true;
  for (const monitor of tcpMonitors.values()) {
    clearInterval(monitor);
  }
  tcpMonitors.clear();
  stopChildren(signal);
}

function stopChildren(signal) {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}
