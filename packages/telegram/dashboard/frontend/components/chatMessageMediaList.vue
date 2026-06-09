<script setup lang="ts">
import type { FileRef } from '../../../src/views/schemas.js';
import type { MediaFileView } from '../chat-messages/types.js';

defineProps<{
  mediaFiles: MediaFileView[];
}>();

const emit = defineEmits<{
  mediaRequest: [file: FileRef];
}>();
</script>

<template>
  <div class="chat-message-media-list">
    <template v-for="media in mediaFiles" :key="media.id">
      <img
        v-if="media.url !== null && media.file.renderKind === 'image'"
        class="chat-message-media-list__image"
        :src="media.url"
        :alt="media.label"
      />
      <video
        v-else-if="media.url !== null && media.file.renderKind === 'video'"
        class="chat-message-media-list__video"
        :src="media.url"
        controls
        playsinline
      />
      <div
        v-else-if="media.url !== null && media.file.renderKind === 'audio'"
        class="chat-message-media-list__voice"
      >
        <span class="chat-message-media-list__voice-title">{{ media.label }}</span>
        <audio
          class="chat-message-media-list__voice-player"
          :src="media.url"
          controls
          preload="metadata"
        />
        <span v-if="media.duration !== null" class="chat-message-media-list__voice-duration">
          {{ media.duration }}
        </span>
      </div>
      <a
        v-else-if="media.url !== null"
        class="chat-message-media-list__download"
        :href="media.url"
        :download="media.label"
      >
        <span class="chat-message-media-list__title">{{ media.label }}</span>
        <span class="chat-message-media-list__status">{{ media.status }}</span>
      </a>
      <button
        v-else
        type="button"
        class="chat-message-media-list__request"
        :disabled="!media.isInteractive"
        @click="emit('mediaRequest', media.file)"
      >
        <img
          v-if="media.thumbnailUrl !== null"
          class="chat-message-media-list__thumbnail"
          :src="media.thumbnailUrl"
          :alt="media.label"
        />
        <span class="chat-message-media-list__title">{{ media.label }}</span>
        <span class="chat-message-media-list__status">{{ media.status }}</span>
        <span v-if="media.progress !== null" class="chat-message-media-list__progress">
          {{ media.progress }}
        </span>
      </button>
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.chat-message-media-list {
  @apply mb-1 grid max-w-full gap-2;
}

.chat-message-media-list__image {
  @apply max-h-[420px] max-w-full rounded-lg object-contain;
}

.chat-message-media-list__video {
  @apply max-h-[420px] max-w-full rounded-lg bg-black;
}

.chat-message-media-list__voice {
  @apply grid min-w-0 max-w-full gap-1 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5;
}

.chat-message-media-list__voice-title {
  @apply text-sm font-semibold text-teal-800;
}

.chat-message-media-list__voice-player {
  @apply h-9 w-56 max-w-full sm:w-64;
}

.chat-message-media-list__voice-duration {
  @apply text-xs font-medium text-zinc-500;
}

.chat-message-media-list__download {
  @apply grid min-w-52 gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left hover:bg-zinc-100;
}

.chat-message-media-list__request {
  @apply grid min-w-52 gap-1 overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-left hover:bg-zinc-100 disabled:cursor-default disabled:opacity-70 disabled:hover:bg-zinc-50;
}

.chat-message-media-list__thumbnail {
  @apply -mx-3 -mt-2 mb-1 max-h-64 w-[calc(100%+1.5rem)] object-cover;
}

.chat-message-media-list__title {
  @apply min-w-0 truncate text-sm font-semibold text-zinc-800;
}

.chat-message-media-list__status {
  @apply text-xs text-zinc-500;
}

.chat-message-media-list__progress {
  @apply h-5 w-fit rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white;
}
</style>
