import { defineSubsystem } from '@agentg/framework';

import type { TelegramLiveCoverageObserver } from './liveCoverage.js';

type LiveCoverageSubsystem = TelegramLiveCoverageObserver & {
  configure(observer: TelegramLiveCoverageObserver): void;
  start(): Promise<void>;
};

export const useLiveCoverage = defineSubsystem('live-coverage', (): LiveCoverageSubsystem => {
  let observer: TelegramLiveCoverageObserver | undefined;

  function readyObserver(): TelegramLiveCoverageObserver {
    if (observer === undefined) {
      throw new Error('Subsystem live-coverage resource is not ready');
    }
    return observer;
  }

  const lifecycle = {
    configure(nextObserver: TelegramLiveCoverageObserver): void {
      observer = nextObserver;
    },
    init(): void {
      return;
    },
    start(): Promise<void> {
      return Promise.resolve();
    }
  };

  return new Proxy(lifecycle, {
    get(target, property) {
      if (property in target) {
        return (target as Record<PropertyKey, unknown>)[property];
      }
      if (typeof property === 'symbol') {
        return undefined;
      }

      const value = (readyObserver() as Record<PropertyKey, unknown>)[property];
      if (typeof value !== 'function') {
        return value;
      }

      return value.bind(readyObserver()) as (...args: unknown[]) => unknown;
    }
  }) as unknown as LiveCoverageSubsystem;
});
