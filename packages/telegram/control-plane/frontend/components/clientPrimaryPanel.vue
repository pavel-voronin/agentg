<script setup lang="ts">
import SolarCloseCircleBold from '~icons/solar/close-circle-bold';

import { SlotOutletItem, type SlotContext, type SlotItemRenderState } from '@agentg/framework/cp';
import { UiButton } from '@agentg/framework/cp';

import type { ChatHeaderView } from '../clientChat.js';
import type { ClientTab } from '../clientSlots.js';

const props = defineProps<{
  activeTab: ClientTab | null;
  activeTabId: string;
  chatHeader: ChatHeaderView | null;
  contentAttrs: Record<string, unknown>;
  selectedChatId: string | null;
  slotContext: SlotContext;
  tabs: ClientTab[];
}>();

const emit = defineEmits<{
  closeChat: [];
  selectTab: [contentId: string];
  stateChange: [state: SlotItemRenderState];
}>();

function closeChat(): void {
  emit('closeChat');
}

function selectTab(contentId: string): void {
  emit('selectTab', contentId);
}

function setItemState(state: SlotItemRenderState): void {
  emit('stateChange', state);
}
</script>

<template>
  <div class="client-primary-panel">
    <div v-if="props.selectedChatId === null" class="client-primary-panel__empty-state">
      <div class="client-primary-panel__empty-content">
        <div class="client-primary-panel__empty-title">No chat selected</div>
        <div class="client-primary-panel__empty-copy">Select a chat from the list.</div>
      </div>
    </div>

    <div v-else class="client-primary-panel__tab-layout">
      <div v-if="props.chatHeader" class="client-primary-panel__chat-header">
        <img
          v-if="props.chatHeader.avatarUrl"
          class="client-primary-panel__chat-avatar"
          :src="props.chatHeader.avatarUrl"
          alt=""
        />
        <div v-else class="client-primary-panel__chat-initials">
          {{ props.chatHeader.initials }}
        </div>
        <div class="client-primary-panel__chat-main">
          <div class="client-primary-panel__chat-title">
            {{ props.chatHeader.title }}
          </div>
          <div class="client-primary-panel__chat-subtitle">
            {{ props.chatHeader.subtitle }}
          </div>
        </div>
        <UiButton
          class="client-primary-panel__chat-close"
          aria-label="Close chat"
          size="icon-md"
          title="Close chat"
          @click="closeChat"
        >
          <SolarCloseCircleBold class="client-primary-panel__chat-close-icon" aria-hidden="true" />
        </UiButton>
      </div>
      <div class="client-primary-panel__tab-list" role="tablist" aria-label="Chat client">
        <button
          v-for="tab in props.tabs"
          :key="tab.item.contentId"
          type="button"
          role="tab"
          class="client-primary-panel__tab-button"
          :aria-selected="tab.item.contentId === props.activeTabId"
          :data-active="tab.item.contentId === props.activeTabId ? 'true' : undefined"
          @click="selectTab(tab.item.contentId)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="client-primary-panel__tab-body">
        <SlotOutletItem
          v-if="props.activeTab"
          :content-attrs="props.contentAttrs"
          :context="props.slotContext"
          :item="props.activeTab.item"
          @state-change="setItemState"
        />
        <div v-else class="client-primary-panel__tab-empty">No client tabs available.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.client-primary-panel {
  @apply min-h-0 w-full min-w-0 overflow-hidden bg-white;
}

.client-primary-panel__empty-state {
  @apply flex h-full min-h-0 items-center justify-center p-8 text-center;
}

.client-primary-panel__empty-content {
  @apply max-w-sm;
}

.client-primary-panel__empty-title {
  @apply text-base font-semibold text-zinc-900;
}

.client-primary-panel__empty-copy {
  @apply mt-2 text-sm text-zinc-500;
}

.client-primary-panel__tab-layout {
  @apply flex h-full min-h-0 flex-col bg-white;
}

.client-primary-panel__chat-header {
  @apply flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3;
}

.client-primary-panel__chat-avatar {
  @apply h-10 w-10 shrink-0 rounded-full object-cover;
}

.client-primary-panel__chat-initials {
  @apply flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white;
}

.client-primary-panel__chat-main {
  @apply min-w-0 flex-1;
}

.client-primary-panel__chat-title {
  @apply truncate text-base font-semibold text-zinc-900;
}

.client-primary-panel__chat-subtitle {
  @apply mt-0.5 truncate text-xs text-zinc-500;
}

.client-primary-panel__chat-close {
  @apply shrink-0 text-zinc-600;
}

.client-primary-panel__chat-close-icon {
  @apply h-4 w-4;
}

.client-primary-panel__tab-list {
  @apply flex shrink-0 gap-1 border-b border-zinc-200 px-4 pt-2;
}

.client-primary-panel__tab-button {
  @apply border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900;
}

.client-primary-panel__tab-button[data-active='true'] {
  @apply border-teal-600 text-teal-700;
}

.client-primary-panel__tab-body {
  @apply min-h-0 flex-1 overflow-hidden;
}

.client-primary-panel__tab-empty {
  @apply p-8 text-center text-sm text-zinc-500;
}
</style>
