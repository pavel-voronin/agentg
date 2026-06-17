<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import SolarAltArrowDownBold from '~icons/solar/alt-arrow-down-bold';

import { slotRoute, type SlotContext } from '@agentg/framework/dashboard';

import { useLiveMessages } from './chat-messages/useLiveMessages.js';
import { useMessageScroll } from './chat-messages/useMessageScroll.js';
import ChatMessageBubble from './components/chatMessageBubble.vue';
import { useTelegramDirectoryState } from './directoryState.js';
import { providerFileUrl } from './mediaUrl.js';
import { clientPathForChat, clientRouteSegmentsForChat } from './clientRoute.js';
import type { LiveMessageChat } from './chat-messages/liveMessages.js';
import type { MessageTarget } from './chat-messages/types.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const directoryState = useTelegramDirectoryState();
const route = computed(() => slotRoute(props.slotContext));
const chatsById = computed<ReadonlyMap<string, LiveMessageChat>>(
  () =>
    new Map(
      directoryState.chats.value.map((chat) => [
        chat.id,
        {
          avatarUrl: providerFileUrl(chat.avatar.small?.url ?? chat.avatar.big?.url ?? null),
          title: chat.title
        }
      ])
    )
);

const scroll = useMessageScroll({
  loadOlder: () => {}
});
const feed = useLiveMessages({
  chatsById,
  scroll
});

onBeforeUnmount(scroll.stop);

function openClientChat(chatId: string): void {
  route.value.replace(clientRouteSegmentsForChat(chatId));
}

function openReplyTarget(target: MessageTarget | null): void {
  if (target !== null) {
    openClientChat(target.chatId);
  }
}

function chatHref(chatId: string): string {
  return clientPathForChat(chatId);
}
</script>

<template>
  <section class="client-live-content" aria-label="Live">
    <div
      :ref="scroll.setScrollRoot"
      class="client-live-content__scrollport"
      :data-empty="feed.liveItems.value.length === 0 ? 'true' : undefined"
      @scroll="scroll.onScroll"
    >
      <div v-if="feed.lastError.value" class="client-live-content__error">
        {{ feed.lastError.value }}
      </div>

      <div v-if="feed.liveItems.value.length === 0" class="client-live-content__empty">
        Waiting for new messages.
      </div>

      <template v-for="item in feed.liveItems.value" :key="item.id">
        <div
          v-if="item.kind === 'date'"
          class="client-live-content__date-row"
          :data-date-label="item.label"
        >
          <div class="client-live-content__date-label">
            {{ item.label }}
          </div>
        </div>

        <div
          v-else
          :ref="(element) => scroll.setMessageElement(item.message.id, element)"
          class="client-live-content__event-row"
          :data-date-label="item.dateLabel"
        >
          <a
            class="client-live-content__chat-link"
            :href="chatHref(item.chatId)"
            @click.prevent="openClientChat(item.chatId)"
          >
            <img
              v-if="item.chatAvatarUrl !== null"
              class="client-live-content__chat-avatar"
              :src="item.chatAvatarUrl"
              alt=""
            />
            <span class="client-live-content__chat-title">
              {{ item.chatTitle }}
            </span>
          </a>

          <button
            v-if="item.kind === 'service'"
            type="button"
            class="client-live-content__service"
            @click="openClientChat(item.chatId)"
          >
            {{ item.label }}
          </button>

          <div
            v-else
            class="client-live-content__message"
            :data-outgoing="item.message.isOutgoing ? 'true' : undefined"
          >
            <ChatMessageBubble
              clickable
              :message="item.message"
              :view="item.view"
              @media-request="(file) => void feed.requestMediaFile(file)"
              @open="openClientChat(item.chatId)"
              @reply-jump="openReplyTarget"
            />
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="scroll.floatingDateLabel.value !== null"
      class="client-live-content__floating-date"
      :data-visible="scroll.floatingDateVisible.value ? 'true' : undefined"
    >
      {{ scroll.floatingDateLabel.value }}
    </div>

    <button
      type="button"
      class="client-live-content__scroll-down"
      :data-visible="scroll.showScrollDown.value ? 'true' : undefined"
      aria-label="Scroll to newest messages"
      title="Scroll to newest messages"
      @click="scroll.scrollToBottom"
    >
      <SolarAltArrowDownBold class="client-live-content__scroll-down-icon" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.client-live-content {
  @apply relative h-full min-h-0 overflow-hidden bg-gradient-to-br from-emerald-50 via-lime-50 to-sky-50;
}

.client-live-content__scrollport {
  @apply h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-4;
}

.client-live-content__scrollport[data-empty='true'] {
  @apply flex items-center justify-center;
}

.client-live-content__error {
  @apply mx-auto mb-3 max-w-xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.client-live-content__empty {
  @apply rounded-lg bg-white/80 px-4 py-3 text-sm text-zinc-500 shadow-sm ring-1 ring-black/5;
}

.client-live-content__date-row {
  @apply mb-3 mt-1 flex justify-center;
}

.client-live-content__date-label {
  @apply rounded-full bg-zinc-700/45 px-3 py-1 text-sm font-semibold text-white shadow-sm backdrop-blur;
}

.client-live-content__event-row {
  @apply mb-3 grid grid-cols-[minmax(8rem,15rem)_minmax(0,1fr)] items-start gap-3;
}

.client-live-content__chat-link {
  @apply flex min-w-0 items-start gap-2 rounded-md px-2 py-1 text-sm font-semibold leading-snug text-zinc-700 hover:bg-white/70 hover:text-teal-800;
}

.client-live-content__chat-avatar {
  @apply mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover shadow-sm;
}

.client-live-content__chat-title {
  @apply min-w-0 break-words;
}

.client-live-content__service {
  @apply w-fit rounded-full bg-emerald-900/35 px-4 py-1.5 text-sm font-semibold text-white shadow-sm backdrop-blur hover:bg-emerald-900/50;
}

.client-live-content__message {
  @apply flex min-w-0 justify-start;
}

.client-live-content__message[data-outgoing='true'] {
  @apply justify-end;
}

.client-live-content__floating-date {
  @apply pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-zinc-700/45 px-3 py-1 text-sm font-semibold text-white opacity-0 shadow-sm backdrop-blur transition-opacity duration-200;
}

.client-live-content__floating-date[data-visible='true'] {
  @apply opacity-100;
}

.client-live-content__scroll-down {
  @apply pointer-events-none absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-500 opacity-0 shadow-lg ring-1 ring-black/10 transition hover:text-zinc-800;
}

.client-live-content__scroll-down[data-visible='true'] {
  @apply pointer-events-auto flex opacity-100;
}

.client-live-content__scroll-down-icon {
  @apply h-7 w-7;
}
</style>
