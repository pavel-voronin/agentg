import { readonly, shallowRef, type DeepReadonly, type Ref } from 'vue';

import { useTelemetryDashboardApi } from './api.js';
import type { LinkSet } from './contracts.js';

const links = shallowRef<LinkSet | null>(null);
const error = shallowRef<string | null>(null);
let pendingLoad: Promise<void> | null = null;

export function useLinks(): {
  error: DeepReadonly<Ref<string | null>>;
  links: DeepReadonly<Ref<LinkSet | null>>;
  loadLinks: () => Promise<void>;
} {
  const api = useTelemetryDashboardApi();

  async function loadLinks(): Promise<void> {
    if (links.value !== null) {
      error.value = null;
      return;
    }
    if (pendingLoad !== null) {
      return pendingLoad;
    }

    error.value = null;
    pendingLoad = api
      .links()
      .then((result) => {
        links.value = result;
      })
      .catch((loadError: unknown) => {
        error.value = errorMessage(loadError);
      })
      .finally(() => {
        pendingLoad = null;
      });

    return pendingLoad;
  }

  return {
    error: readonly(error),
    links: readonly(links),
    loadLinks
  };
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
