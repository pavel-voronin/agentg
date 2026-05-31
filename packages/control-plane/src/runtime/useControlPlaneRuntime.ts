import type {
  ControlPlaneHost,
  ControlPlaneHostEvent,
  ModelRefSelection
} from '@agentg/framework/cp';
import { onBeforeUnmount, onMounted } from 'vue';

import { createControlPlaneClient } from '../control-plane/controlPlaneClient.js';
import { loadControlPlaneEventCatalog } from '../control-plane/eventCatalog.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useEventsStore } from '../stores/events.js';

type StatusBadgeKind = 'bad' | 'ok' | 'warn';

export function useControlPlaneRuntime(): ControlPlaneHost {
  const appShellStore = useAppShellStore();
  const eventsStore = useEventsStore();
  const eventListeners = new Set<(event: ControlPlaneHostEvent) => void>();
  const modelRefListeners = new Set<(selection: ModelRefSelection) => void>();
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
        refreshEventCatalog();
      }
    }
  });

  const host: ControlPlaneHost = {
    rpc(method, params) {
      return controlPlane.rpc(method, params);
    },
    selectModelRef(selection) {
      for (const listener of modelRefListeners) {
        listener(selection);
      }
    },
    subscribeEvents(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    subscribeModelRefs(listener) {
      modelRefListeners.add(listener);
      return () => {
        modelRefListeners.delete(listener);
      };
    }
  };

  function receiveEvent(event: ControlPlaneHostEvent): void {
    if (event.type) {
      eventsStore.pushEvent(event);
    }
    if (event.type === 'service_directory.changed') {
      refreshEventCatalog();
    }
    for (const listener of eventListeners) {
      listener(event);
    }
  }

  function refreshEventCatalog(): void {
    void loadControlPlaneEventCatalog()
      .then((catalog) => {
        eventsStore.setEventCatalog(catalog);
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            event: 'control_plane.event_catalog_load_failed'
          })
        );
      });
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
    modelRefListeners.clear();
    controlPlane.disconnect();
  }

  onMounted(startRuntime);
  onBeforeUnmount(stopRuntime);

  return host;
}
