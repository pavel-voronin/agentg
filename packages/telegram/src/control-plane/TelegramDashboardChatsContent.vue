<script setup lang="ts">
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

import { useTelegramDirectoryProjection } from './telegramDirectoryProjection.js';

const { chatCount } = useTelegramDirectoryProjection();

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}
</script>

<template>
  <UiMetricTile label="Chats" :value="formatInteger(chatCount)" />
</template>
