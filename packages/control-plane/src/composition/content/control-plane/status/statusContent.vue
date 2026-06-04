<script setup lang="ts">
import { computed } from 'vue';

import { UiStatusBadge } from '@agentg/framework/cp';

import { useAppShellStore } from '../../../../stores/appShell.js';

const store = useAppShellStore();
const kind = computed(() => store.controlPlaneStatus);
</script>

<template>
  <UiStatusBadge label="CONTROL" :kind="kind" />
</template>
