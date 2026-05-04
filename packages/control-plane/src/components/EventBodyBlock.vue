<script setup lang="ts">
import type { AppEventBodyView } from '../stores/controlPlaneTypes.js';

defineProps<{
  body: AppEventBodyView;
  bordered?: boolean;
  mode: 'raw' | 'yaml';
  muted: boolean;
}>();

function lineStyle(indent: number): Record<string, string> {
  return {
    paddingLeft: `${String(indent)}rem`
  };
}
</script>

<template>
  <pre
    v-if="mode === 'raw'"
    :class="[
      'm-0 whitespace-pre-wrap break-words',
      bordered ? 'border-t px-2 py-1' : '',
      muted ? 'border-zinc-300 text-zinc-500' : 'border-zinc-200 text-zinc-700'
    ]"
    >{{ body.raw }}</pre
  >
  <div
    v-else
    :class="[
      'm-0 whitespace-pre-wrap break-words font-mono',
      bordered ? 'border-t px-2 py-1' : '',
      muted ? 'border-zinc-300 text-zinc-500' : 'border-zinc-200 text-zinc-700'
    ]"
  >
    <div
      v-for="(line, lineIndex) in body.yamlLines"
      :key="lineIndex"
      :style="lineStyle(line.indent)"
    >
      <template v-for="(token, tokenIndex) in line.tokens" :key="tokenIndex">
        <span v-if="token.kind === 'text'">{{ token.text }}</span>
        <span
          v-else
          class="inline-flex max-w-full overflow-hidden rounded border align-baseline leading-tight"
          :style="{ borderColor: token.color }"
        >
          <span
            class="max-w-[9rem] truncate px-1 text-white"
            :style="{ backgroundColor: token.color }"
          >
            {{ token.model }}
          </span>
          <span class="max-w-[12rem] truncate bg-white px-1" :style="{ color: token.color }">
            {{ token.id }}
          </span>
        </span>
      </template>
    </div>
  </div>
</template>
