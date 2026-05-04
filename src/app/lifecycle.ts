export type LifecycleResource = {
  name: string;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
};

export type LifecycleState = 'new' | 'started' | 'stopped';

export type AppLifecycle = {
  getState(): LifecycleState;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function createLifecycle(resources: LifecycleResource[]): AppLifecycle {
  const startedResources: LifecycleResource[] = [];
  let state: LifecycleState = 'new';

  return {
    getState(): LifecycleState {
      return state;
    },
    async start(): Promise<void> {
      if (state === 'started') {
        return;
      }
      if (state === 'stopped') {
        throw new Error('Lifecycle cannot be restarted after stop');
      }

      try {
        for (const resource of resources) {
          await resource.start?.();
          startedResources.push(resource);
        }
        state = 'started';
      } catch (error) {
        await stopStartedResources(startedResources);
        state = 'stopped';
        throw error;
      }
    },
    async stop(): Promise<void> {
      if (state === 'stopped') {
        return;
      }

      await stopStartedResources(startedResources);
      state = 'stopped';
    }
  };
}

async function stopStartedResources(resources: LifecycleResource[]): Promise<void> {
  const errors: unknown[] = [];

  for (const resource of resources.splice(0).reverse()) {
    try {
      await resource.stop?.();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, 'Lifecycle resources failed to stop');
  }
}
