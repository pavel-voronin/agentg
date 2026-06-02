<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import SolarAltArrowDownBold from '~icons/solar/alt-arrow-down-bold';

import type { SlotContext } from '@agentg/framework/cp';
import { useMessageFeed } from './chat-messages/useMessageFeed.js';
import { useMessageScroll } from './chat-messages/useMessageScroll.js';
import ChatMessageTimeline from './components/chatMessageTimeline.vue';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const selectedChatId = computed(() => {
  const value = props.slotContext?.selectedChatId;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
});
const selectedChatAvatarUrl = computed(() => {
  const value = props.slotContext?.selectedChatAvatarUrl;
  return typeof value === 'string' && value.length > 0 ? value : null;
});

let loadOlderMessages = (): void => {};
const scroll = useMessageScroll({
  loadOlder: () => {
    loadOlderMessages();
  }
});
const feed = useMessageFeed({
  scroll,
  selectedChatAvatarUrl,
  selectedChatId
});

loadOlderMessages = () => {
  void feed.loadOlderMessages();
};

onBeforeUnmount(scroll.stop);
</script>

<template>
  <section class="chat-messages-content" aria-label="Messages">
    <div
      :ref="scroll.setScrollRoot"
      class="chat-messages-content__scrollport"
      :data-empty="feed.timelineItems.value.length === 0 ? 'true' : undefined"
      @scroll="scroll.onScroll"
    >
      <div v-if="feed.loadingOlder.value" class="chat-messages-content__load-state">
        Loading older messages
      </div>

      <div v-if="feed.lastError.value" class="chat-messages-content__error">
        {{ feed.lastError.value }}
      </div>

      <div v-if="feed.timelineItems.value.length === 0" class="chat-messages-content__empty">
        {{ feed.loadingInitial.value ? 'Loading messages' : feed.emptyMessage.value }}
      </div>

      <ChatMessageTimeline
        :highlighted-message-id="scroll.highlightedMessageId.value"
        :items="feed.timelineItems.value"
        @media-request="(file) => void feed.requestMediaFile(file)"
        @message-element="scroll.setMessageElement"
        @reply-jump="(target) => void feed.jumpToReply(target)"
      />
    </div>

    <div
      v-if="scroll.floatingDateLabel.value !== null"
      class="chat-messages-content__floating-date"
      :data-visible="scroll.floatingDateVisible.value ? 'true' : undefined"
    >
      {{ scroll.floatingDateLabel.value }}
    </div>

    <button
      type="button"
      class="chat-messages-content__scroll-down"
      :data-visible="scroll.showScrollDown.value ? 'true' : undefined"
      aria-label="Scroll to newest messages"
      title="Scroll to newest messages"
      @click="scroll.scrollToBottom"
    >
      <SolarAltArrowDownBold class="chat-messages-content__scroll-down-icon" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
@reference "tailwindcss";
.chat-messages-content {
  @apply relative h-full min-h-0 overflow-hidden bg-gradient-to-br from-emerald-50 via-lime-50 to-sky-50;
}

.chat-messages-content__scrollport {
  @apply h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-4;
}

.chat-messages-content__scrollport[data-empty='true'] {
  @apply flex items-center justify-center;
}

.chat-messages-content__load-state {
  @apply mx-auto mb-3 w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-zinc-500 shadow-sm ring-1 ring-black/5;
}

.chat-messages-content__error {
  @apply mx-auto mb-3 max-w-xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.chat-messages-content__empty {
  @apply rounded-lg bg-white/80 px-4 py-3 text-sm text-zinc-500 shadow-sm ring-1 ring-black/5;
}

.chat-messages-content__floating-date {
  @apply pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-zinc-700/45 px-3 py-1 text-sm font-semibold text-white opacity-0 shadow-sm backdrop-blur transition-opacity duration-200;
}

.chat-messages-content__floating-date[data-visible='true'] {
  @apply opacity-100;
}

.chat-messages-content__scroll-down {
  @apply pointer-events-none absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-500 opacity-0 shadow-lg ring-1 ring-black/10 transition hover:text-zinc-800;
}

.chat-messages-content__scroll-down[data-visible='true'] {
  @apply pointer-events-auto flex opacity-100;
}

.chat-messages-content__scroll-down-icon {
  @apply h-7 w-7;
}
</style>
