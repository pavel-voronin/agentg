<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { onModelRefSelected } from '@agentg/control-plane-sdk/model-ref-events';
import type { ChatFolderNavItem, ChatSidebarView } from '../views.js';

const props = defineProps<{
  view: ChatSidebarView;
}>();

const emit = defineEmits<{
  archiveOpen: [];
  chatOpen: [chatId: string];
  chatToggle: [chatId: string];
  folderOpen: [folderId: number];
  mainOpen: [];
  searchClear: [];
  searchInput: [value: string];
}>();

type InputEventTarget = {
  value: string;
};

type SearchInputRef = {
  focus: () => void;
};

const searchInput = ref<SearchInputRef | null>(null);
const folderNav = ref<HTMLElement | null>(null);
let stopModelRefListener: (() => void) | null = null;

function onSearchInput(event: Event): void {
  const input = inputTarget(event);
  if (input !== null) {
    emit('searchInput', input.value);
  }
}

function clearSearch(): void {
  emit('searchClear');
  void nextTick(() => searchInput.value?.focus());
}

function handleModelRefSelected(selection: { id: string; model: string }): void {
  if (selection.model === 'telegram.chat') {
    emit('chatOpen', selection.id);
  }
}

function openFolder(item: ChatFolderNavItem): void {
  if (item.type === 'archive') {
    emit('archiveOpen');
    return;
  }
  if (item.type === 'main') {
    emit('mainOpen');
    return;
  }
  emit('folderOpen', item.folderId);
}

function inputTarget(event: Event): InputEventTarget | null {
  return event.target === null ? null : (event.target as unknown as InputEventTarget);
}

function folderScrollKey(folders: ChatFolderNavItem[]): string {
  const activeFolder = folders.find((folder) => folder.active);
  return `${activeFolder?.id ?? ''}:${folders.map((folder) => folder.id).join(',')}`;
}

function scrollActiveFolderIntoView(): void {
  const root = folderNav.value;
  const activeFolder = root?.querySelector<HTMLElement>(
    ".chat-sidebar__folder-button[data-active='true']"
  );
  if (root === null || activeFolder === undefined || activeFolder === null) {
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const activeRect = activeFolder.getBoundingClientRect();
  if (activeRect.top < rootRect.top) {
    root.scrollTop -= rootRect.top - activeRect.top;
    return;
  }
  if (activeRect.bottom > rootRect.bottom) {
    root.scrollTop += activeRect.bottom - rootRect.bottom;
  }
}

watch(
  () => folderScrollKey(props.view.folders),
  () => {
    void nextTick(scrollActiveFolderIntoView);
  },
  { flush: 'post', immediate: true }
);

onMounted(() => {
  stopModelRefListener = onModelRefSelected(handleModelRefSelected);
  void nextTick(scrollActiveFolderIntoView);
});

onBeforeUnmount(() => {
  stopModelRefListener?.();
  stopModelRefListener = null;
});
</script>

<template>
  <aside class="chat-sidebar">
    <div class="chat-sidebar__search-bar">
      <div class="chat-sidebar__search-frame">
        <input
          ref="searchInput"
          :value="view.search"
          class="chat-sidebar__search-input"
          placeholder="Search title or id"
          @input="onSearchInput"
        />
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          class="chat-sidebar__search-clear"
          :data-visible="view.hasSearch ? 'true' : undefined"
          @click="clearSearch"
        >
          ×
        </button>
      </div>
    </div>
    <div class="chat-sidebar__body">
      <nav ref="folderNav" class="chat-sidebar__folder-nav">
        <button
          v-for="folder in view.folders"
          :key="folder.id"
          type="button"
          :title="folder.title"
          class="chat-sidebar__folder-button"
          :data-active="folder.active ? 'true' : undefined"
          :data-folder-id="folder.id"
          @click="openFolder(folder)"
        >
          <span class="chat-sidebar__folder-label">{{ folder.label }}</span>
          <span v-if="folder.badge" class="chat-sidebar__folder-badge">
            {{ folder.badge }}
          </span>
        </button>
      </nav>

      <div class="chat-sidebar__list">
        <div v-if="view.header?.kind === 'search'" class="chat-sidebar__search-header">
          {{ view.header.title }}
        </div>

        <button
          v-for="chat in view.chats"
          :key="chat.id"
          type="button"
          class="chat-sidebar__chat-button"
          :data-active="chat.active ? 'true' : undefined"
          @click="emit('chatToggle', chat.id)"
        >
          <div class="chat-sidebar__chat-main-row">
            <div class="chat-sidebar__chat-title-row">
              <img
                v-if="chat.avatarUrl"
                class="chat-sidebar__chat-avatar"
                :src="chat.avatarUrl"
                alt=""
              />
              <svg
                v-else-if="chat.icon === 'bot'"
                class="chat-sidebar__chat-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-label="Bot"
              >
                <path
                  d="M5.5 7.5h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3Z"
                />
                <path d="M9 7.5V4.75" />
                <path d="M6.5 11.25h.01" />
                <path d="M11.5 11.25h.01" />
              </svg>
              <svg
                v-else-if="chat.icon === 'channel'"
                class="chat-sidebar__chat-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-label="Channel"
              >
                <path d="M3 10.5 15.5 5v14L3 13.5v-3Z" />
                <path d="M6.5 14.75 8 19" />
              </svg>
              <svg
                v-else-if="chat.icon === 'group'"
                class="chat-sidebar__chat-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-label="Group"
              >
                <path d="M8 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M14.5 10.5a2.5 2.5 0 1 0 0-5" />
                <path d="M2.5 18a5.5 5.5 0 0 1 11 0" />
                <path d="M13.5 13.5A4.5 4.5 0 0 1 18 18" />
              </svg>
              <svg
                v-else-if="chat.icon === 'secret'"
                class="chat-sidebar__chat-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-label="Secret chat"
              >
                <path d="M5.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5" />
                <path d="M4.5 9.5h9v7h-9v-7Z" />
              </svg>
              <div v-else class="chat-sidebar__chat-initials">
                {{ chat.initials }}
              </div>
              <div class="chat-sidebar__chat-title">{{ chat.title }}</div>
            </div>
          </div>
        </button>

        <div v-if="view.emptyMessage" class="chat-sidebar__empty-message">
          {{ view.emptyMessage }}
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
@reference "tailwindcss";
.chat-sidebar {
  @apply flex min-h-0 flex-col overflow-hidden bg-white;
}

.chat-sidebar__search-bar {
  @apply grid shrink-0 gap-1.5 border-b border-zinc-200 px-2.5 py-2;
}

.chat-sidebar__search-frame {
  @apply relative;
}

.chat-sidebar__search-input {
  @apply w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-2.5 pr-8 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100;
}

.chat-sidebar__search-clear {
  @apply absolute right-1.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-base leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700;
}

.chat-sidebar__search-clear[data-visible='true'] {
  @apply inline-flex;
}

.chat-sidebar__body {
  @apply grid min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)] overflow-hidden;
}

.chat-sidebar__folder-nav {
  @apply min-h-0 overflow-auto overscroll-none bg-slate-800 [-ms-overflow-style:none] [scrollbar-width:none];
}

.chat-sidebar__folder-nav::-webkit-scrollbar {
  @apply hidden;
}

.chat-sidebar__folder-button {
  @apply relative flex min-h-16 w-full flex-col items-center justify-center px-1 py-2 text-center text-[11px] font-medium text-slate-300 hover:bg-slate-700/70;
}

.chat-sidebar__folder-button[data-active='true'] {
  @apply bg-sky-500/20 text-sky-200;
}

.chat-sidebar__folder-label {
  @apply truncate;
}

.chat-sidebar__folder-badge {
  @apply mt-1 rounded-full bg-slate-500 px-1.5 py-0.5 text-[10px] leading-none text-white;
}

.chat-sidebar__list {
  @apply min-h-0 overflow-auto overscroll-none;
}

.chat-sidebar__search-header {
  @apply border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500;
}

.chat-sidebar__chat-button {
  @apply block w-full border-b border-zinc-100 bg-white px-3 py-3 text-left hover:bg-zinc-50;
}

.chat-sidebar__chat-button[data-active='true'] {
  @apply bg-teal-50 ring-1 ring-inset ring-teal-200;
}

.chat-sidebar__chat-main-row {
  @apply flex min-w-0 items-center justify-between gap-2;
}

.chat-sidebar__chat-title-row {
  @apply flex min-w-0 items-center gap-1.5;
}

.chat-sidebar__chat-icon {
  @apply h-3.5 w-3.5 shrink-0 text-zinc-700;
}

.chat-sidebar__chat-avatar {
  @apply h-8 w-8 shrink-0 rounded-full object-cover;
}

.chat-sidebar__chat-initials {
  @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white;
}

.chat-sidebar__chat-title {
  @apply min-w-0 truncate font-semibold;
}

.chat-sidebar__empty-message {
  @apply p-6 text-center text-sm text-zinc-500;
}
</style>
