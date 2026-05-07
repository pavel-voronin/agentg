<script setup lang="ts">
import { computed } from 'vue';

import { SlotOutlet, type SlotContext } from '@agentg/control-plane-extension/slots';
import { useControlPlaneActions } from '@agentg/control-plane-extension/actions';
import type { MainWorkspaceContext } from '@agentg/shared/control-plane/views';

import ChatSidebar from './components/ChatSidebar.vue';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const actions = useControlPlaneActions();
const workspaceContext = computed(() => props.slotContext as Partial<MainWorkspaceContext>);
const chatSidebar = computed(() => workspaceContext.value.chatSidebar ?? null);
const eventsPanelCollapsed = computed(() => workspaceContext.value.eventsPanelCollapsed === true);
const nestedSlotContext = computed(() => props.slotContext ?? {});

const primarySlot = {
  slotId: 'telegram.workspace.primary',
  tags: ['telegram.workspace.content']
};

const sidecarSlot = {
  slotId: 'telegram.workspace.sidecar',
  tags: ['telegram.workspace.content']
};

const workspaceClass = computed(() =>
  eventsPanelCollapsed.value
    ? 'grid h-full min-h-0 grid-cols-[380px_minmax(0,1fr)] gap-4 overflow-hidden'
    : 'grid h-full min-h-0 grid-cols-[380px_minmax(0,1fr)_420px] gap-4 overflow-hidden'
);
</script>

<template>
  <div :class="workspaceClass">
    <ChatSidebar
      v-if="chatSidebar"
      :view="chatSidebar"
      @archive-open="actions.openArchiveChats"
      @chat-open="actions.openChat"
      @chat-toggle="actions.toggleChat"
      @folder-open="actions.openFolderChats"
      @main-open="actions.openMainChats"
      @search-clear="actions.clearChatSearch"
      @search-input="actions.searchChats"
    />

    <SlotOutlet
      :context="nestedSlotContext"
      :slot-id="primarySlot.slotId"
      :tags="primarySlot.tags"
    />

    <SlotOutlet
      v-if="!eventsPanelCollapsed"
      :context="{ ...nestedSlotContext, idPrefix: 'events' }"
      :slot-id="sidecarSlot.slotId"
      :tags="sidecarSlot.tags"
    />
  </div>
</template>
