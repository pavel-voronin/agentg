<script setup lang="ts">
import { computed } from 'vue';
import SolarInfoCircleBold from '~icons/solar/info-circle-bold';

import { natsPageView, type NatsReport } from './natsView.js';

const props = defineProps<{
  error: string | null;
  loading: boolean;
  report: NatsReport | null;
}>();

const view = computed(() => natsPageView(props.report));
</script>

<template>
  <section class="nats-telemetry-page">
    <div v-if="props.loading" class="nats-telemetry-page__empty">Loading NATS telemetry</div>
    <div v-if="props.error" class="nats-telemetry-page__error">{{ props.error }}</div>
    <div v-if="view.error" class="nats-telemetry-page__error">{{ view.error }}</div>

    <div class="nats-telemetry-page__summary-grid">
      <div
        v-for="card in view.summaryCards"
        :key="card.label"
        class="nats-telemetry-page__summary"
        :data-tone="card.tone"
      >
        <div class="nats-telemetry-page__summary-label-frame">
          <div class="nats-telemetry-page__summary-label">{{ card.label }}</div>
          <span
            v-if="card.tooltip"
            class="nats-telemetry-page__hint"
            tabindex="0"
            :aria-label="card.tooltip"
          >
            <SolarInfoCircleBold class="nats-telemetry-page__hint-icon" aria-hidden="true" />
            <span class="nats-telemetry-page__hint-popover">{{ card.tooltip }}</span>
          </span>
        </div>
        <div class="nats-telemetry-page__summary-value" :data-tone="card.tone">
          {{ card.value }}
        </div>
        <div class="nats-telemetry-page__summary-detail">{{ card.detail }}</div>
      </div>
    </div>

    <section class="nats-telemetry-page__section">
      <div class="nats-telemetry-page__section-header">
        <h3 class="nats-telemetry-page__section-title">Traffic</h3>
        <div class="nats-telemetry-page__section-meta">rates from consecutive samples</div>
      </div>
      <div class="nats-telemetry-page__row-grid">
        <div
          v-for="row in view.trafficRows"
          :key="row.key"
          class="nats-telemetry-page__row-card"
          :data-tone="row.tone"
        >
          <div class="nats-telemetry-page__summary-label-frame">
            <div class="nats-telemetry-page__summary-label">{{ row.label }}</div>
            <span
              v-if="row.tooltip"
              class="nats-telemetry-page__hint"
              tabindex="0"
              :aria-label="row.tooltip"
            >
              <SolarInfoCircleBold class="nats-telemetry-page__hint-icon" aria-hidden="true" />
              <span class="nats-telemetry-page__hint-popover">{{ row.tooltip }}</span>
            </span>
          </div>
          <div class="nats-telemetry-page__summary-value" :data-tone="row.tone">
            {{ row.value }}
          </div>
          <div class="nats-telemetry-page__summary-detail">{{ row.detail }}</div>
        </div>
      </div>
    </section>

    <section class="nats-telemetry-page__section">
      <div class="nats-telemetry-page__section-header">
        <h3 class="nats-telemetry-page__section-title">Pending Connections</h3>
        <div class="nats-telemetry-page__section-meta">top connections by pending bytes</div>
      </div>
      <div class="nats-telemetry-page__table-frame">
        <table v-if="view.pendingRows.length > 0" class="nats-telemetry-page__table">
          <thead class="nats-telemetry-page__table-head">
            <tr class="nats-telemetry-page__table-row">
              <th class="nats-telemetry-page__name-cell">Connection</th>
              <th class="nats-telemetry-page__number-cell">Pending</th>
              <th class="nats-telemetry-page__number-cell">Subs</th>
              <th class="nats-telemetry-page__number-cell">Address</th>
            </tr>
          </thead>
          <tbody class="nats-telemetry-page__table-body">
            <tr
              v-for="row in view.pendingRows"
              :key="row.key"
              class="nats-telemetry-page__table-row"
            >
              <td class="nats-telemetry-page__name-cell">{{ row.name }}</td>
              <td
                class="nats-telemetry-page__number-cell"
                :data-tone="row.pendingTone"
                :title="row.pendingTooltip ?? undefined"
              >
                {{ row.pending }}
              </td>
              <td class="nats-telemetry-page__number-cell">{{ row.subscriptions }}</td>
              <td class="nats-telemetry-page__number-cell">{{ row.address }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="nats-telemetry-page__empty">No pending connection bytes</div>
      </div>
    </section>

    <section class="nats-telemetry-page__section">
      <div class="nats-telemetry-page__section-header">
        <h3 class="nats-telemetry-page__section-title">Monitoring Endpoints</h3>
        <div class="nats-telemetry-page__section-meta">HTTP read time</div>
      </div>
      <div class="nats-telemetry-page__row-grid">
        <div
          v-for="row in view.endpointRows"
          :key="row.key"
          class="nats-telemetry-page__row-card"
          :data-tone="row.tone"
        >
          <div class="nats-telemetry-page__summary-label-frame">
            <div class="nats-telemetry-page__summary-label">{{ row.label }}</div>
            <span
              v-if="row.tooltip"
              class="nats-telemetry-page__hint"
              tabindex="0"
              :aria-label="row.tooltip"
            >
              <SolarInfoCircleBold class="nats-telemetry-page__hint-icon" aria-hidden="true" />
              <span class="nats-telemetry-page__hint-popover">{{ row.tooltip }}</span>
            </span>
          </div>
          <div class="nats-telemetry-page__summary-value" :data-tone="row.tone">
            {{ row.value }}
          </div>
          <div class="nats-telemetry-page__summary-detail">{{ row.detail }}</div>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.nats-telemetry-page {
  @apply min-w-0;
}

.nats-telemetry-page__error {
  @apply mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700;
}

.nats-telemetry-page__summary-grid,
.nats-telemetry-page__row-grid {
  @apply mt-4 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3;
}

.nats-telemetry-page__summary,
.nats-telemetry-page__row-card {
  @apply min-w-0 rounded border border-zinc-200 bg-white p-3;
}

.nats-telemetry-page__summary[data-tone='ok'],
.nats-telemetry-page__row-card[data-tone='ok'] {
  @apply border-emerald-200 bg-emerald-50/40;
}

.nats-telemetry-page__summary[data-tone='warn'],
.nats-telemetry-page__row-card[data-tone='warn'] {
  @apply border-amber-200 bg-amber-50/60;
}

.nats-telemetry-page__summary[data-tone='bad'],
.nats-telemetry-page__row-card[data-tone='bad'] {
  @apply border-red-200 bg-red-50/60;
}

.nats-telemetry-page__summary-label-frame {
  @apply flex items-center gap-1;
}

.nats-telemetry-page__summary-label {
  @apply text-xs font-medium text-zinc-500;
}

.nats-telemetry-page__summary-value {
  @apply mt-1 truncate text-lg font-semibold text-zinc-950;
}

.nats-telemetry-page__summary-value[data-tone='ok'],
.nats-telemetry-page__number-cell[data-tone='ok'] {
  @apply text-emerald-700;
}

.nats-telemetry-page__summary-value[data-tone='warn'],
.nats-telemetry-page__number-cell[data-tone='warn'] {
  @apply text-amber-700;
}

.nats-telemetry-page__summary-value[data-tone='bad'],
.nats-telemetry-page__number-cell[data-tone='bad'] {
  @apply text-red-700;
}

.nats-telemetry-page__summary-detail {
  @apply mt-1 truncate text-xs text-zinc-500;
}

.nats-telemetry-page__hint {
  @apply relative inline-flex size-4 shrink-0 items-center justify-center rounded text-zinc-400 outline-none transition-colors hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-300;
}

.nats-telemetry-page__hint-icon {
  @apply size-3.5;
}

.nats-telemetry-page__hint-popover {
  @apply pointer-events-none invisible absolute right-0 top-5 z-20 w-64 rounded border border-zinc-200 bg-white p-2 text-left text-xs font-normal leading-5 text-zinc-700 opacity-0 shadow-lg transition-opacity;
}

.nats-telemetry-page__hint:hover .nats-telemetry-page__hint-popover,
.nats-telemetry-page__hint:focus .nats-telemetry-page__hint-popover,
.nats-telemetry-page__hint:focus-visible .nats-telemetry-page__hint-popover {
  @apply visible opacity-100;
}

.nats-telemetry-page__section {
  @apply mt-6 border-t border-zinc-200 pt-4;
}

.nats-telemetry-page__section-header {
  @apply mb-3 flex items-baseline justify-between gap-3;
}

.nats-telemetry-page__section-title {
  @apply text-base font-semibold tracking-normal;
}

.nats-telemetry-page__section-meta {
  @apply shrink-0 text-xs text-zinc-500;
}

.nats-telemetry-page__table-frame {
  @apply overflow-auto;
}

.nats-telemetry-page__table {
  @apply w-full min-w-[760px] border-collapse text-sm;
}

.nats-telemetry-page__table-head {
  @apply border-b border-zinc-200 text-xs text-zinc-500;
}

.nats-telemetry-page__table-body {
  @apply divide-y divide-zinc-100;
}

.nats-telemetry-page__table-row {
  @apply align-top;
}

.nats-telemetry-page__name-cell {
  @apply max-w-[360px] py-2 pr-4 text-left;
}

.nats-telemetry-page__number-cell {
  @apply whitespace-nowrap py-2 pl-3 text-right tabular-nums;
}

.nats-telemetry-page__empty {
  @apply py-6 text-sm text-zinc-500;
}
</style>
