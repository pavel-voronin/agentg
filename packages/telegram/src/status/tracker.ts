import type { EventBus } from '@agentg/framework';

export type StatusTracker = {
  markAuthenticated(authenticated: boolean): void;
  markConnectionState(connectionState: string): boolean;
  markDisconnected(): void;
  markReady(ready: boolean): void;
  publish(): void;
  snapshot(): {
    authenticated: boolean;
    connected: boolean;
    ready: boolean;
  };
};

export function createStatusTracker(events: EventBus): StatusTracker {
  const state = {
    authenticated: false,
    connected: false,
    ready: false
  };

  const publish = (): void => {
    events.publish('telegram.status', { ...state });
  };

  return {
    markAuthenticated(authenticated): void {
      state.authenticated = authenticated;
      state.connected = authenticated;
      publish();
    },
    markConnectionState(connectionState): boolean {
      state.connected = state.authenticated;
      publish();
      return connectionState === 'connectionStateReady';
    },
    markDisconnected(): void {
      state.connected = false;
      publish();
    },
    markReady(ready): void {
      state.ready = ready;
      publish();
    },
    publish,
    snapshot() {
      return { ...state };
    }
  };
}
