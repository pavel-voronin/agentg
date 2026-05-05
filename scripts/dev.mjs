#!/usr/bin/env node
/* global console, process */

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const setupCommands = [
  ['docker', ['compose', 'up', '-d', 'postgres', 'nats', '--quiet-pull']],
  ['npm', ['run', 'db:migrate']]
];

const children = new Set();
let shuttingDown = false;

try {
  for (const [command, args] of setupCommands) {
    await runChecked(command, args);
  }

  startDevProcess('service-directory', 'npm', ['run', 'dev:service-directory']);
  await waitForTcp('service-directory RPC', '127.0.0.1', 18084);

  startDevProcess('telegram', 'npm', ['run', 'dev:telegram']);
  await waitForTcp('telegram RPC', '127.0.0.1', 18081);

  startDevProcess('history-sync', 'npm', ['run', 'dev:history-sync']);
  await waitForTcp('history-sync RPC', '127.0.0.1', 18082);

  startDevProcess('summaries', 'npm', ['run', 'dev:summaries']);
  await waitForTcp('summaries RPC', '127.0.0.1', 18083);

  startDevProcess('gateway', 'npm', ['run', 'dev:gateway']);
  await waitForTcp('gateway', '127.0.0.1', 8787);

  startDevProcess('control-plane-server', 'npm', ['run', 'dev:control-plane-server']);
  await waitForTcp('control-plane server', '127.0.0.1', 8789);

  startDevProcess('control-plane', 'npm', ['run', 'dev:control-plane']);
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
  const child = spawn(command, args, {
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
  stopChildren(signal);
}

function stopChildren(signal) {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}
