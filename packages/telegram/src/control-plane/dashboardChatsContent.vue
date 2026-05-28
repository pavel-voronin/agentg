<script setup lang="ts">
import UiMetricTile from '@agentg/control-plane-sdk/ui/metric-tile';

import { useTelegramDirectoryState } from './directoryState.js';

const { chatCount } = useTelegramDirectoryState();

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}
</script>

<template>
  <UiMetricTile label="Chats" :value="formatInteger(chatCount)" />
</template>
