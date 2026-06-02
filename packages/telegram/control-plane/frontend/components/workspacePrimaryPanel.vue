<script setup lang="ts">
import SolarCloseCircleBold from '~icons/solar/close-circle-bold';

import { SlotOutletItem, type SlotContext, type SlotItemRenderState } from '@agentg/framework/cp';
import { UiButton } from '@agentg/framework/cp';

import type { ChatHeaderView } from '../workspaceChat.js';
import type { WorkspaceTab } from '../workspaceSlots.js';

const props = defineProps<{
  activeTab: WorkspaceTab | null;
  activeTabId: string;
  chatHeader: ChatHeaderView | null;
  contentAttrs: Record<string, unknown>;
  selectedChatId: string | null;
  slotContext: SlotContext;
  tabs: WorkspaceTab[];
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
  <div class="workspace-primary-panel">
    <div v-if="props.selectedChatId === null" class="workspace-primary-panel__empty-state">
      <div class="workspace-primary-panel__empty-content">
        <div class="workspace-primary-panel__empty-title">No chat selected</div>
        <div class="workspace-primary-panel__empty-copy">Select a chat from the list.</div>
      </div>
    </div>

    <div v-else class="workspace-primary-panel__tab-layout">
      <div v-if="props.chatHeader" class="workspace-primary-panel__chat-header">
        <img
          v-if="props.chatHeader.avatarUrl"
          class="workspace-primary-panel__chat-avatar"
          :src="props.chatHeader.avatarUrl"
          alt=""
        />
        <div v-else class="workspace-primary-panel__chat-initials">
          {{ props.chatHeader.initials }}
        </div>
        <div class="workspace-primary-panel__chat-main">
          <div class="workspace-primary-panel__chat-title">
            {{ props.chatHeader.title }}
          </div>
          <div class="workspace-primary-panel__chat-subtitle">
            {{ props.chatHeader.subtitle }}
          </div>
        </div>
        <UiButton
          class="workspace-primary-panel__chat-close"
          aria-label="Close chat"
          size="icon-md"
          title="Close chat"
          @click="closeChat"
        >
          <SolarCloseCircleBold
            class="workspace-primary-panel__chat-close-icon"
            aria-hidden="true"
          />
        </UiButton>
      </div>
      <div class="workspace-primary-panel__tab-list" role="tablist" aria-label="Chat workspace">
        <button
          v-for="tab in props.tabs"
          :key="tab.item.contentId"
          type="button"
          role="tab"
          class="workspace-primary-panel__tab-button"
          :aria-selected="tab.item.contentId === props.activeTabId"
          :data-active="tab.item.contentId === props.activeTabId ? 'true' : undefined"
          @click="selectTab(tab.item.contentId)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="workspace-primary-panel__tab-body">
        <SlotOutletItem
          v-if="props.activeTab"
          :content-attrs="props.contentAttrs"
          :context="props.slotContext"
          :item="props.activeTab.item"
          @state-change="setItemState"
        />
        <div v-else class="workspace-primary-panel__tab-empty">No workspace tabs available.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.workspace-primary-panel {
  @apply min-h-0 min-w-0 overflow-hidden bg-white;
}

.workspace-primary-panel__empty-state {
  @apply flex h-full min-h-0 items-center justify-center p-8 text-center;
}

.workspace-primary-panel__empty-content {
  @apply max-w-sm;
}

.workspace-primary-panel__empty-title {
  @apply text-base font-semibold text-zinc-900;
}

.workspace-primary-panel__empty-copy {
  @apply mt-2 text-sm text-zinc-500;
}

.workspace-primary-panel__tab-layout {
  @apply flex h-full min-h-0 flex-col bg-white;
}

.workspace-primary-panel__chat-header {
  @apply flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3;
}

.workspace-primary-panel__chat-avatar {
  @apply h-10 w-10 shrink-0 rounded-full object-cover;
}

.workspace-primary-panel__chat-initials {
  @apply flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white;
}

.workspace-primary-panel__chat-main {
  @apply min-w-0 flex-1;
}

.workspace-primary-panel__chat-title {
  @apply truncate text-base font-semibold text-zinc-900;
}

.workspace-primary-panel__chat-subtitle {
  @apply mt-0.5 truncate text-xs text-zinc-500;
}

.workspace-primary-panel__chat-close {
  @apply shrink-0 text-zinc-600;
}

.workspace-primary-panel__chat-close-icon {
  @apply h-4 w-4;
}

.workspace-primary-panel__tab-list {
  @apply flex shrink-0 gap-1 border-b border-zinc-200 px-4 pt-2;
}

.workspace-primary-panel__tab-button {
  @apply border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900;
}

.workspace-primary-panel__tab-button[data-active='true'] {
  @apply border-teal-600 text-teal-700;
}

.workspace-primary-panel__tab-body {
  @apply min-h-0 flex-1 overflow-hidden;
}

.workspace-primary-panel__tab-empty {
  @apply p-8 text-center text-sm text-zinc-500;
}
</style>
