<script setup lang="ts">
import type { AppEventBodyView } from '../stores/controlPlaneTypes.js';
import { dispatchModelRefSelected } from '@agentg/control-plane-extension/model-ref-events';

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

function selectModelRef(model: string, id: string): void {
  dispatchModelRefSelected({ id, model });
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
        <button
          v-else
          type="button"
          class="inline-flex max-w-full overflow-hidden rounded border bg-transparent p-0 align-baseline font-mono leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          :style="{ borderColor: token.color }"
          :title="`${token.model} ${token.id}`"
          @click="selectModelRef(token.model, token.id)"
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
        </button>
      </template>
    </div>
  </div>
</template>
