<script setup lang="ts">
import { computed } from 'vue';
import type { FileRef, ReadMessage } from '../../../src/views/schemas.js';
import type { MessageTarget, MessageView } from '../chat-messages/types.js';
import ChatMessageMediaList from './chatMessageMediaList.vue';

type ReactionBadge = {
  id: string;
  isChosen: boolean;
  label: string;
  totalCount: number;
};

const props = defineProps<{
  message: ReadMessage;
  view: MessageView;
}>();

const emit = defineEmits<{
  mediaRequest: [file: FileRef];
  replyJump: [target: MessageTarget | null];
}>();

const reactionBadges = computed<ReactionBadge[]>(() =>
  props.message.reactions
    .filter((reaction) => reaction.totalCount > 0)
    .map((reaction) => ({
      id: reaction.reactionType,
      isChosen: reaction.isChosen,
      label: reactionLabel(reaction.reactionType),
      totalCount: reaction.totalCount
    }))
);

function reactionLabel(reactionType: string): string {
  if (reactionType.startsWith('emoji:')) {
    return reactionType.slice('emoji:'.length);
  }
  if (reactionType.startsWith('custom_emoji:')) {
    return 'Custom';
  }
  return reactionType === 'paid' ? '$' : reactionType;
}
</script>

<template>
  <article class="chat-message-bubble" :data-outgoing="message.isOutgoing ? 'true' : undefined">
    <div v-if="view.sender" class="chat-message-bubble__sender">
      {{ view.sender }}
    </div>

    <button
      v-if="view.replyTarget"
      type="button"
      class="chat-message-bubble__reply"
      :data-loaded="view.isReplyLoaded ? 'true' : undefined"
      @click="emit('replyJump', view.replyTarget)"
    >
      <span class="chat-message-bubble__reply-label">Reply</span>
      <span class="chat-message-bubble__reply-text">
        {{ view.replyText }}
      </span>
    </button>

    <div v-if="view.contentLabel" class="chat-message-bubble__content-label">
      {{ view.contentLabel }}
    </div>

    <ChatMessageMediaList
      v-if="view.mediaFiles.length > 0"
      :media-files="view.mediaFiles"
      @media-request="(file) => emit('mediaRequest', file)"
    />

    <div v-if="view.bodySegments.length > 0" class="chat-message-bubble__body">
      <template v-for="segment in view.bodySegments" :key="segment.id">
        <a
          v-if="segment.kind === 'link'"
          class="chat-message-bubble__link"
          :href="segment.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ segment.text }}
        </a>
        <span v-else class="chat-message-bubble__text">
          {{ segment.text }}
        </span>
      </template>
    </div>

    <div v-if="reactionBadges.length > 0" class="chat-message-bubble__reactions">
      <span
        v-for="reaction in reactionBadges"
        :key="reaction.id"
        class="chat-message-bubble__reaction"
        :data-chosen="reaction.isChosen ? 'true' : undefined"
      >
        <span class="chat-message-bubble__reaction-label">{{ reaction.label }}</span>
        <span class="chat-message-bubble__reaction-count">{{ reaction.totalCount }}</span>
      </span>
    </div>

    <div class="chat-message-bubble__meta">
      {{ view.time }}
    </div>
  </article>
</template>

<style scoped>
@reference "tailwindcss";
.chat-message-bubble {
  @apply max-w-[78%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 shadow-sm ring-1 ring-black/5 lg:max-w-[680px];
}

.chat-message-bubble[data-outgoing='true'] {
  @apply rounded-bl-2xl rounded-br-md bg-emerald-100;
}

.chat-message-bubble__sender {
  @apply mb-0.5 truncate text-sm font-semibold text-orange-700;
}

.chat-message-bubble__reply {
  @apply mb-1 grid w-full gap-0.5 rounded-md border-l-4 border-violet-500 bg-violet-50 px-2.5 py-1 text-left hover:bg-violet-100;
}

.chat-message-bubble__reply[data-loaded='true'] {
  @apply border-teal-500 bg-teal-50 hover:bg-teal-100;
}

.chat-message-bubble__reply-label {
  @apply text-xs font-semibold text-violet-700;
}

.chat-message-bubble__reply-text {
  @apply truncate text-sm text-zinc-700;
}

.chat-message-bubble__content-label {
  @apply mb-1 w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500;
}

.chat-message-bubble__body {
  @apply whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-950;
}

.chat-message-bubble__link {
  @apply text-sky-700 underline decoration-sky-400 underline-offset-2 hover:text-sky-900;
}

.chat-message-bubble__text {
  @apply whitespace-pre-wrap;
}

.chat-message-bubble__reactions {
  @apply mt-1.5 flex flex-wrap gap-1;
}

.chat-message-bubble__reaction {
  @apply inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-zinc-100 px-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200;
}

.chat-message-bubble__reaction[data-chosen='true'] {
  @apply bg-sky-100 text-sky-800 ring-sky-300;
}

.chat-message-bubble__reaction-label {
  @apply min-w-0 truncate;
}

.chat-message-bubble__reaction-count {
  @apply shrink-0 tabular-nums;
}

.chat-message-bubble__meta {
  @apply mt-0.5 text-right text-xs font-medium text-zinc-400;
}
</style>
