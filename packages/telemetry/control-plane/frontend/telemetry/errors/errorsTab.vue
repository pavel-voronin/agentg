<script setup lang="ts">
import SamplesList from '../samples/samplesList.vue';
import type { PageView } from '../report/reportView.js';

defineProps<{
  droppedRecords: string;
  ignoredRecords: string;
  rows: PageView['slowestRows'];
  title: string;
}>();
</script>

<template>
  <SamplesList
    :dropped-records="droppedRecords"
    :ignored-records="ignoredRecords"
    :rows="rows"
    :title="title"
  />
</template>
