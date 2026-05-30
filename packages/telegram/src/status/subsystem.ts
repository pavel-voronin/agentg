import { defineSubsystem } from '@agentg/framework';

export type TelegramStatusTracker = {
  markAuthenticated(authenticated: boolean): void;
  markConnectionState(connectionState: string): boolean;
  markDisconnected(): void;
  publish(): void;
};

type TelegramStatusSubsystem = TelegramStatusTracker & {
  configure(tracker: TelegramStatusTracker): void;
  start(): Promise<void>;
};

export const useTelegramStatus = defineSubsystem('status', (): TelegramStatusSubsystem => {
  let tracker: TelegramStatusTracker | undefined;

  function readyTracker(): TelegramStatusTracker {
    if (tracker === undefined) {
      throw new Error('Subsystem status resource is not ready');
    }
    return tracker;
  }

  return {
    configure(nextTracker: TelegramStatusTracker): void {
      tracker = nextTracker;
    },
    markAuthenticated(authenticated: boolean): void {
      readyTracker().markAuthenticated(authenticated);
    },
    markConnectionState(connectionState: string): boolean {
      return readyTracker().markConnectionState(connectionState);
    },
    markDisconnected(): void {
      readyTracker().markDisconnected();
    },
    publish(): void {
      readyTracker().publish();
    },
    start(): Promise<void> {
      return Promise.resolve();
    }
  };
});
