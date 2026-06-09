import type {
  DashboardHost,
  DashboardHostEvent,
  ModelRefSelection
} from '@agentg/framework/dashboard';
import { onBeforeUnmount, onMounted } from 'vue';

import { createDashboardClient } from '../dashboard/dashboardClient.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useEventsStore } from '../stores/events.js';

type StatusBadgeKind = 'bad' | 'ok' | 'warn';

export function useDashboardRuntime(): DashboardHost {
  const appShellStore = useAppShellStore();
  const eventsStore = useEventsStore();
  const eventListeners = new Set<(event: DashboardHostEvent) => void>();
  const modelRefListeners = new Set<(selection: ModelRefSelection) => void>();
  let runtimeStarted = false;

  const dashboard = createDashboardClient({
    onClose() {
      if (runtimeStarted) {
        setDashboardStatus('bad');
      }
    },
    onEvent(event) {
      if (runtimeStarted) {
        receiveEvent(event);
      }
    },
    onOpen() {
      if (runtimeStarted) {
        setDashboardStatus('ok');
      }
    }
  });

  const host: DashboardHost = {
    rpc(method, params) {
      return dashboard.rpc(method, params);
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

  function receiveEvent(event: DashboardHostEvent): void {
    if (event.type) {
      eventsStore.pushEvent(event);
    }
    for (const listener of eventListeners) {
      listener(event);
    }
  }

  function setDashboardStatus(kind: StatusBadgeKind): void {
    appShellStore.setDashboardStatus(kind);
  }

  function startRuntime(): void {
    if (runtimeStarted) {
      return;
    }
    runtimeStarted = true;
    dashboard.connect();
  }

  function stopRuntime(): void {
    if (!runtimeStarted) {
      return;
    }
    runtimeStarted = false;
    eventListeners.clear();
    modelRefListeners.clear();
    dashboard.disconnect();
  }

  onMounted(startRuntime);
  onBeforeUnmount(stopRuntime);

  return host;
}
