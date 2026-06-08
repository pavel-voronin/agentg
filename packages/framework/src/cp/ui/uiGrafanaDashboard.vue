<script setup lang="ts">
import { computed } from 'vue';

import {
  grafanaDashboardSource,
  type GrafanaDashboardVariables
} from './grafanaDashboardSource.js';

const props = withDefaults(
  defineProps<{
    baseUrl?: string | undefined;
    dashboardSlug?: string | undefined;
    dashboardUid?: string | undefined;
    from?: string | undefined;
    kiosk?: boolean | 'tv' | undefined;
    orgId?: number | string | undefined;
    refresh?: string | undefined;
    theme?: 'dark' | 'light' | undefined;
    title?: string | undefined;
    to?: string | undefined;
    url?: string | undefined;
    variables?: GrafanaDashboardVariables | undefined;
  }>(),
  {
    from: 'now-15m',
    kiosk: false,
    orgId: '1',
    refresh: '5s',
    theme: 'light',
    title: 'Grafana dashboard',
    to: 'now'
  }
);

const source = computed(() =>
  grafanaDashboardSource({
    baseUrl: props.baseUrl,
    dashboardSlug: props.dashboardSlug,
    dashboardUid: props.dashboardUid,
    from: props.from,
    kiosk: props.kiosk,
    orgId: props.orgId,
    refresh: props.refresh,
    theme: props.theme,
    to: props.to,
    url: props.url,
    variables: props.variables
  })
);
</script>

<template>
  <section class="ui-grafana-dashboard">
    <iframe
      v-if="source"
      class="ui-grafana-dashboard__frame"
      :src="source"
      :title="title"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
    />
    <div v-else class="ui-grafana-dashboard__empty">Grafana dashboard is not configured</div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.ui-grafana-dashboard {
  @apply min-h-[520px] w-full overflow-hidden rounded border border-zinc-200 bg-white;
}

.ui-grafana-dashboard__frame {
  @apply h-[min(78vh,900px)] min-h-[520px] w-full border-0;
}

.ui-grafana-dashboard__empty {
  @apply flex min-h-[520px] items-center justify-center p-4 text-sm text-zinc-500;
}
</style>
