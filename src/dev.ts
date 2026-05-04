import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { loadAppConfig, type AppConfig } from './app/config.js';
import { hasTelegramCredentials } from './telegram/tdlibClient.js';

type DevChildProcess = ChildProcessByStdio<null, Readable, Readable>;

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

async function main(): Promise<void> {
  loadAppConfig();
  const env = createDevEnvironment(process.env);
  const config = loadAppConfig({ env });
  const uiUrl = httpUrl(
    requiredEnv(env, 'CONTROL_PLANE_UI_HOST'),
    readPort(requiredEnv(env, 'CONTROL_PLANE_UI_PORT'))
  );

  logDevStart(config, uiUrl);

  const ui = spawnNodeScript(
    'ui',
    'node_modules/vite/bin/vite.js',
    ['--config', 'vite.control-plane.config.ts'],
    env
  );
  const app = spawnNodeScript(
    'app',
    'node_modules/tsx/dist/cli.mjs',
    [
      'watch',
      '--clear-screen=false',
      '--include',
      'src/**/*.ts',
      '--include',
      '.env',
      '--exclude',
      'src/edges/control-plane/client/**',
      'src/main.ts'
    ],
    env
  );

  await waitForExit([ui, app]);
}

function createDevEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  loadAppConfig();
  const config = loadAppConfig({ env });

  return stringEnvironment({
    ...env,
    CONTROL_PLANE_ENABLED: defaultString(env.CONTROL_PLANE_ENABLED, 'true'),
    CONTROL_PLANE_HOST: defaultString(env.CONTROL_PLANE_HOST, config.controlPlane.host),
    CONTROL_PLANE_PORT: defaultString(env.CONTROL_PLANE_PORT, String(config.controlPlane.port)),
    CONTROL_PLANE_UI_HOST: defaultString(env.CONTROL_PLANE_UI_HOST, '127.0.0.1'),
    CONTROL_PLANE_UI_PORT: defaultString(env.CONTROL_PLANE_UI_PORT, '8790'),
    GATEWAY_ENABLED: defaultString(env.GATEWAY_ENABLED, 'true'),
    GATEWAY_HOST: defaultString(env.GATEWAY_HOST, config.gateway.host),
    GATEWAY_PORT: defaultString(env.GATEWAY_PORT, String(config.gateway.port))
  });
}

function defaultString(value: string | undefined, defaultValue: string): string {
  return value === undefined || value.length === 0 ? defaultValue : value;
}

function spawnNodeScript(
  name: string,
  script: string,
  args: string[],
  env: Record<string, string>
): DevChildProcess {
  const child = spawn(process.execPath, [resolve(projectRoot, script), ...args], {
    cwd: projectRoot,
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(prefixOutput(name, outputChunkToString(chunk)));
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(prefixOutput(name, outputChunkToString(chunk)));
  });

  return child;
}

function waitForExit(children: DevChildProcess[]): Promise<void> {
  return new Promise((resolvePromise) => {
    let shuttingDown = false;

    const shutdown = (exitCode: number): void => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM');
        }
      }

      process.exitCode = exitCode;
      resolvePromise();
    };

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        shutdown(0);
      });
    }

    for (const child of children) {
      child.once('exit', (code, signal) => {
        if (shuttingDown) {
          return;
        }
        shutdown(code ?? (signal === null ? 1 : 0));
      });
    }
  });
}

function logDevStart(config: AppConfig, uiUrl: string): void {
  console.log(
    JSON.stringify({
      controlPlaneUiUrl: uiUrl,
      controlPlaneWsUrl: config.controlPlane.enabled
        ? controlPlaneWsUrl(config.controlPlane.host, config.controlPlane.port)
        : null,
      event: 'agentg.dev.starting',
      gatewayUrl: config.gateway.enabled ? wsUrl(config.gateway.host, config.gateway.port) : null,
      telegramConfigured: hasTelegramCredentials(config.tdlib)
    })
  );
}

function prefixOutput(name: string, text: string): string {
  return text
    .split(/(\r?\n)/)
    .map((part) => {
      if (part === '\n' || part === '\r\n' || part.length === 0) {
        return part;
      }
      return `[${name}] ${part}`;
    })
    .join('');
}

function controlPlaneWsUrl(host: string, port: number): string {
  return `${wsUrl(host, port)}ws`;
}

function httpUrl(host: string, port: number): string {
  return `http://${displayHost(host)}:${String(port)}/`;
}

function wsUrl(host: string, port: number): string {
  return `ws://${displayHost(host)}:${String(port)}/`;
}

function displayHost(host: string): string {
  return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}

function outputChunkToString(chunk: unknown): string {
  return Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
}

function readPort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Port must be a positive integer: ${value}`);
  }
  return parsed;
}

function requiredEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment value: ${key}`);
  }
  return value;
}

function stringEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'agentg.dev.failed'
    })
  );
  process.exitCode = 1;
});
