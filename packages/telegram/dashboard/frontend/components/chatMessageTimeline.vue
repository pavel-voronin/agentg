<script setup lang="ts">
import type { FileRef } from '../../../src/domain/models/fileRef.js';
import type { MessageTarget, TimelineItem } from '../chat-messages/types.js';
import ChatMessageBubble from './chatMessageBubble.vue';

defineProps<{
  highlightedMessageId: string | null;
  items: TimelineItem[];
}>();

const emit = defineEmits<{
  mediaRequest: [file: FileRef];
  messageElement: [messageId: string, value: unknown];
  replyJump: [target: MessageTarget | null];
}>();
</script>

<template>
  <template v-for="item in items" :key="item.id">
    <div
      v-if="item.kind === 'date'"
      class="chat-message-timeline__date-row"
      :data-date-label="item.label"
    >
      <div class="chat-message-timeline__date-label">
        {{ item.label }}
      </div>
    </div>

    <div
      v-else-if="item.kind === 'service'"
      :ref="(element) => emit('messageElement', item.message.telegramMessageId, element)"
      class="chat-message-timeline__service-row"
      :data-date-label="item.dateLabel"
    >
      <div class="chat-message-timeline__service-pill">
        {{ item.label }}
      </div>
    </div>

    <div
      v-else-if="item.kind === 'message'"
      :ref="(element) => emit('messageElement', item.message.telegramMessageId, element)"
      class="chat-message-timeline__message-row"
      :data-date-label="item.dateLabel"
      :data-outgoing="item.message.isOutgoing ? 'true' : undefined"
      :data-highlighted="
        highlightedMessageId === item.message.telegramMessageId ? 'true' : undefined
      "
    >
      <img
        v-if="!item.message.isOutgoing && item.view.avatarUrl !== null"
        class="chat-message-timeline__avatar-image"
        :src="item.view.avatarUrl"
        alt=""
      />
      <div v-else-if="!item.message.isOutgoing" class="chat-message-timeline__avatar">
        {{ item.view.avatar }}
      </div>

      <ChatMessageBubble
        :message="item.message"
        :view="item.view"
        @media-request="(file) => emit('mediaRequest', file)"
        @reply-jump="(target) => emit('replyJump', target)"
      />
    </div>
  </template>
</template>

<style scoped>
@reference "tailwindcss";
.chat-message-timeline__date-row {
  @apply mb-3 mt-1 flex justify-center;
}

.chat-message-timeline__date-label {
  @apply rounded-full bg-zinc-700/45 px-3 py-1 text-sm font-semibold text-white shadow-sm backdrop-blur;
}

.chat-message-timeline__service-row {
  @apply my-3 flex justify-center;
}

.chat-message-timeline__service-pill {
  @apply rounded-full bg-emerald-900/35 px-4 py-1.5 text-sm font-semibold text-white shadow-sm backdrop-blur;
}

.chat-message-timeline__message-row {
  @apply mb-2 flex items-end gap-2 pr-16 transition-colors;
}

.chat-message-timeline__message-row[data-outgoing='true'] {
  @apply justify-end pl-16 pr-0;
}

.chat-message-timeline__message-row[data-highlighted='true'] {
  @apply rounded-lg bg-yellow-200/40;
}

.chat-message-timeline__avatar {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white shadow-sm;
}

.chat-message-timeline__avatar-image {
  @apply h-9 w-9 shrink-0 rounded-full object-cover shadow-sm;
}
</style>
