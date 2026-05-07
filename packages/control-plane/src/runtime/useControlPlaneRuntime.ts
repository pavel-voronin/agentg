import type { ControlPlaneHost, ControlPlaneHostEvent } from '@agentg/control-plane-sdk/host';
import { onBeforeUnmount, onMounted } from 'vue';

import { createControlPlaneClient } from '../control-plane/controlPlaneClient.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useEventsStore } from '../stores/events.js';

type StatusBadgeKind = 'bad' | 'ok' | 'warn';

export function useControlPlaneRuntime(): ControlPlaneHost {
  const appShellStore = useAppShellStore();
  const eventsStore = useEventsStore();
  const eventListeners = new Set<(event: ControlPlaneHostEvent) => void>();
  let runtimeStarted = false;

  const controlPlane = createControlPlaneClient({
    onClose() {
      if (runtimeStarted) {
        setControlPlaneStatus('bad');
      }
    },
    onEvent(event) {
      if (runtimeStarted) {
        receiveEvent(event);
      }
    },
    onOpen() {
      if (runtimeStarted) {
        setControlPlaneStatus('ok');
      }
    }
  });

  const host: ControlPlaneHost = {
    rpc(method, params) {
      return controlPlane.rpc(method, params);
    },
    subscribeEvents(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    }
  };

  function receiveEvent(event: ControlPlaneHostEvent): void {
    if (event.type) {
      eventsStore.pushEvent(event);
    }
    for (const listener of eventListeners) {
      listener(event);
    }
  }

  function setControlPlaneStatus(kind: StatusBadgeKind): void {
    appShellStore.setControlPlaneStatus(kind);
  }

  function startRuntime(): void {
    if (runtimeStarted) {
      return;
    }
    runtimeStarted = true;
    controlPlane.connect();
  }

  function stopRuntime(): void {
    if (!runtimeStarted) {
      return;
    }
    runtimeStarted = false;
    eventListeners.clear();
    controlPlane.disconnect();
  }

  onMounted(startRuntime);
  onBeforeUnmount(stopRuntime);

  return host;
}
