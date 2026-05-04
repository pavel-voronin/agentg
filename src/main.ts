import { createApp } from './app/createApp.js';
import { hasTelegramCredentials } from './telegram/tdlibClient.js';

async function main(): Promise<void> {
  const app = createApp();
  const runtimeLogSubscription = app.eventBus.subscribeAll((event) => {
    if (event.type === 'telegram.tdlib.status' || event.type === 'telegram.tdlib.error') {
      logInfo(event.type, event.data);
    }
  });

  try {
    logInfo('agentg.starting', {
      controlPlaneUrl: app.config.controlPlane.enabled
        ? httpUrl(app.config.controlPlane.host, app.config.controlPlane.port)
        : null,
      databasePath: app.storage.sqlite.path,
      gatewayUrl: app.config.gateway.enabled
        ? wsUrl(app.config.gateway.host, app.config.gateway.port)
        : null,
      telegramConfigured: hasTelegramCredentials(app.config.tdlib)
    });

    await app.start();
    logInfo('agentg.started', {
      controlPlaneUrl: app.edges.controlPlane
        ? httpUrl(app.edges.controlPlane.host, app.edges.controlPlane.port)
        : null,
      databasePath: app.storage.sqlite.path,
      gatewayUrl: app.edges.gateway ? wsUrl(app.edges.gateway.host, app.edges.gateway.port) : null,
      plugins: app.plugins.registry.list().map((plugin) => plugin.name)
    });

    const signal = await waitForShutdownSignal();
    logInfo('agentg.stopping', { signal });
  } catch (error) {
    logError('agentg.failed', error);
    process.exitCode = 1;
  } finally {
    await app.stop();
    runtimeLogSubscription.unsubscribe();
  }
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

function logInfo(event: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      ...data,
      event
    })
  );
}

function logError(event: string, error: unknown): void {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event
    })
  );
}

async function waitForShutdownSignal(): Promise<NodeJS.Signals> {
  return await new Promise((resolve) => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    const cleanup = (): void => {
      for (const signal of signals) {
        process.off(signal, handleSignal);
      }
    };

    const handleSignal = (signal: NodeJS.Signals): void => {
      cleanup();
      resolve(signal);
    };

    for (const signal of signals) {
      process.once(signal, handleSignal);
    }
  });
}

void main();
