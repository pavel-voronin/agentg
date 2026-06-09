<script setup lang="ts">
import { computed } from 'vue';

import { UiStatusBadge } from '@agentg/framework/dashboard';

import { useAppShellStore } from '../../../../stores/appShell.js';

const store = useAppShellStore();
const kind = computed(() => store.dashboardStatus);
</script>

<template>
  <UiStatusBadge label="CONTROL" :kind="kind" />
</template>
