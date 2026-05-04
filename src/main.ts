import { createApp } from './app/createApp.js';

async function main(): Promise<void> {
  const app = createApp();

  try {
    await app.start();
    logInfo('agentg.started', {
      databasePath: app.storage.sqlite.path,
      plugins: app.config.plugins.enabled
    });

    const signal = await waitForShutdownSignal();
    logInfo('agentg.stopping', { signal });
  } catch (error) {
    logError('agentg.failed', error);
    process.exitCode = 1;
  } finally {
    await app.stop();
  }
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
    const keepAlive = setInterval(Date.now, 60_000);
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    const cleanup = (): void => {
      clearInterval(keepAlive);
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
