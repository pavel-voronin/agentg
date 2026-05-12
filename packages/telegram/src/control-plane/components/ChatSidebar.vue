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

function folderAccentGlyph(accent: ChatFolderNavItem['iconAccent']): string {
  if (accent === null) {
    return '';
  }
  const glyphs: Record<NonNullable<ChatFolderNavItem['iconAccent']>, string> = {
    book: 'B',
    bot: 'BOT',
    crown: 'C',
    favorite: '*',
    game: 'G',
    home: 'H',
    love: '<3',
    private: 'L',
    school: 'S',
    sport: 'SP',
    trade: 'T',
    travel: 'A',
    unread: '!',
    work: 'W'
  };
  return glyphs[accent];
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
          <span class="chat-sidebar__search-clear-icon" aria-hidden="true">x</span>
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
          <span class="chat-sidebar__folder-icon-wrap">
            <svg
              v-if="folder.icon === 'chats'"
              class="chat-sidebar__folder-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M9 4.5h4.7a6.2 6.2 0 0 1 0 12.4h-.5l-2.9 2.2a.9.9 0 0 1-1.4-.7v-1.5H9A6.2 6.2 0 0 1 9 4.5Z"
              />
              <path
                d="M16.1 8.3a5.3 5.3 0 0 1 .7 8.5l1.9 1.4a.9.9 0 0 0 1.4-.7v-1.3a4.8 4.8 0 0 0-4-7.9Z"
              />
            </svg>
            <svg
              v-else-if="folder.icon === 'archive'"
              class="chat-sidebar__folder-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M5 4h14a2 2 0 0 1 2 2v2H3V6a2 2 0 0 1 2-2Zm-1 6h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7Zm7-2h2V6h-2v2Zm-2.4 6.1 2.7 2.7a1 1 0 0 0 1.4 0l2.7-2.7a1 1 0 0 0-1.4-1.4l-1 1V11a1 1 0 1 0-2 0v2.7l-1-1a1 1 0 0 0-1.4 1.4Z"
              />
            </svg>
            <svg
              v-else
              class="chat-sidebar__folder-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M3 7.8A2.8 2.8 0 0 1 5.8 5h4.1c.8 0 1.5.3 2 .9l.8.8c.3.3.7.4 1.1.4h4.4A2.8 2.8 0 0 1 21 9.9v6.3a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 16.2V7.8Z"
              />
            </svg>
            <span
              v-if="folder.badge"
              class="chat-sidebar__folder-badge"
              :data-tone="folder.badgeTone"
            >
              {{ folder.badge }}
            </span>
          </span>
          <span v-if="folder.iconAccent" class="chat-sidebar__folder-accent">
            <span class="chat-sidebar__folder-accent-icon" aria-hidden="true">
              {{ folderAccentGlyph(folder.iconAccent) }}
            </span>
          </span>
          <span class="chat-sidebar__folder-label">{{ folder.label }}</span>
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
          <div class="chat-sidebar__chat-row">
            <img
              v-if="chat.avatarUrl"
              class="chat-sidebar__chat-avatar"
              :src="chat.avatarUrl"
              alt=""
            />
            <div v-else class="chat-sidebar__chat-initials">
              {{ chat.initials }}
            </div>
            <div class="chat-sidebar__chat-content">
              <div class="chat-sidebar__chat-top">
                <div class="chat-sidebar__chat-title-row">
                  <svg
                    v-if="chat.icon === 'bot'"
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
                  <div class="chat-sidebar__chat-title">{{ chat.title }}</div>
                  <span
                    v-if="chat.isPremium"
                    class="chat-sidebar__chat-premium"
                    title="Telegram Premium"
                    aria-hidden="true"
                  >
                    P
                  </span>
                </div>
                <div class="chat-sidebar__chat-meta">
                  <span
                    v-if="chat.lastMessage.readState"
                    class="chat-sidebar__chat-read-state"
                    :data-state="chat.lastMessage.readState"
                  >
                    <span
                      v-if="chat.lastMessage.readState === 'read'"
                      class="chat-sidebar__chat-read-icon"
                      aria-hidden="true"
                    >
                      vv
                    </span>
                    <span
                      v-else-if="chat.lastMessage.readState === 'sent'"
                      class="chat-sidebar__chat-read-icon"
                      aria-hidden="true"
                    >
                      v
                    </span>
                    <span v-else class="chat-sidebar__chat-read-placeholder">?</span>
                  </span>
                  <span
                    class="chat-sidebar__chat-date"
                    :data-placeholder="chat.lastMessage.datePlaceholder ? 'true' : undefined"
                  >
                    {{ chat.lastMessage.dateLabel }}
                  </span>
                </div>
              </div>
              <div class="chat-sidebar__chat-bottom">
                <div
                  class="chat-sidebar__chat-preview"
                  :data-placeholder="chat.lastMessage.textPlaceholder ? 'true' : undefined"
                >
                  <span
                    v-if="chat.lastMessage.showAuthor"
                    class="chat-sidebar__chat-author"
                    :data-placeholder="chat.lastMessage.authorPlaceholder ? 'true' : undefined"
                  >
                    {{ chat.lastMessage.author }}:
                  </span>
                  <svg
                    v-if="chat.lastMessage.isForwarded"
                    class="chat-sidebar__chat-forward"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5 17 10l-5 5" />
                    <path d="M3 15v-2a3 3 0 0 1 3-3h10" />
                  </svg>
                  <span class="chat-sidebar__chat-preview-text">
                    {{ chat.lastMessage.text }}
                  </span>
                </div>
                <div class="chat-sidebar__chat-state-slot">
                  <span
                    v-if="chat.unreadBadge"
                    class="chat-sidebar__chat-unread"
                    :data-muted="chat.notificationsEnabled === false ? 'true' : undefined"
                    :data-placeholder="chat.notificationsPlaceholder ? 'true' : undefined"
                  >
                    {{ chat.unreadBadge }}
                  </span>
                  <svg
                    v-else-if="chat.isPinned"
                    class="chat-sidebar__chat-pin"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M12.4 2.3a1 1 0 0 1 1.4 0l3.9 3.9a1 1 0 0 1 0 1.4l-1.3 1.3 1.1 1.1a1 1 0 0 1-1.4 1.4l-2.3-2.3-3 3 .5 3.7a1 1 0 0 1-1.7.8l-2.7-2.7-3.2 3.2a1 1 0 0 1-1.4-1.4l3.2-3.2-2.7-2.7a1 1 0 0 1 .8-1.7l3.7.5 3-3-2.3-2.3a1 1 0 0 1 1.4-1.4l1.1 1.1 1.3-1.3Z"
                    />
                  </svg>
                </div>
              </div>
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

.chat-sidebar__search-clear-icon {
  @apply flex h-3.5 w-3.5 items-center justify-center;
}

.chat-sidebar__body {
  @apply grid min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)] overflow-hidden;
}

.chat-sidebar__folder-nav {
  @apply min-h-0 overflow-auto overscroll-none bg-[#233447] [-ms-overflow-style:none] [scrollbar-width:none];
}

.chat-sidebar__folder-nav::-webkit-scrollbar {
  @apply hidden;
}

.chat-sidebar__folder-button {
  @apply relative flex min-h-[74px] w-full flex-col items-center justify-center px-1.5 py-2 text-center text-[12px] font-semibold leading-tight text-slate-400 hover:bg-[#1b2b3c];
}

.chat-sidebar__folder-button[data-active='true'] {
  @apply bg-[#111d29] text-sky-300;
}

.chat-sidebar__folder-icon-wrap {
  @apply relative flex h-9 w-11 items-center justify-center;
}

.chat-sidebar__folder-icon {
  @apply h-8 w-8 shrink-0 text-slate-400;
}

.chat-sidebar__folder-button[data-active='true'] .chat-sidebar__folder-icon {
  @apply text-sky-400;
}

.chat-sidebar__folder-accent {
  @apply flex max-w-full items-center justify-center text-slate-400;
}

.chat-sidebar__folder-button[data-active='true'] .chat-sidebar__folder-accent {
  @apply text-sky-300;
}

.chat-sidebar__folder-accent-icon {
  @apply flex h-4 w-4 items-center justify-center text-[10px] font-bold leading-none;
}

.chat-sidebar__folder-label {
  @apply max-w-full whitespace-normal break-words leading-tight;
}

.chat-sidebar__folder-badge {
  @apply absolute right-0 top-0 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white;
}

.chat-sidebar__folder-badge[data-tone='notify'] {
  @apply bg-sky-400;
}

.chat-sidebar__folder-badge[data-tone='muted'] {
  @apply bg-slate-500;
}

.chat-sidebar__list {
  @apply min-h-0 overflow-auto overscroll-none [scrollbar-color:var(--color-zinc-300)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin];
}

.chat-sidebar__list::-webkit-scrollbar {
  @apply h-1.5 w-1.5;
}

.chat-sidebar__list::-webkit-scrollbar-track {
  @apply bg-transparent;
}

.chat-sidebar__list::-webkit-scrollbar-thumb {
  @apply rounded-full bg-zinc-300;
}

.chat-sidebar__list::-webkit-scrollbar-thumb:hover {
  @apply bg-zinc-400;
}

.chat-sidebar__search-header {
  @apply border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500;
}

.chat-sidebar__chat-button {
  @apply block w-full border-b border-zinc-100 bg-white py-2 pl-2.5 pr-4 text-left hover:bg-zinc-50;
}

.chat-sidebar__chat-button[data-active='true'] {
  @apply bg-sky-500 text-white;
}

.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-icon,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-title,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-premium,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-read-state,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-date,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-preview,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-author,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-forward,
.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-pin {
  @apply text-white;
}

.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-preview {
  @apply text-white/90;
}

.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-date {
  @apply text-white/90;
}

.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-unread {
  @apply bg-white text-sky-600;
}

.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-unread[data-muted='true'] {
  @apply bg-white/35 text-white;
}

.chat-sidebar__chat-button[data-active='true'] .chat-sidebar__chat-read-state[data-state='sent'] {
  @apply text-white/80;
}

.chat-sidebar__chat-row {
  @apply flex min-w-0 items-center gap-3;
}

.chat-sidebar__chat-content {
  @apply flex min-w-0 flex-1 flex-col gap-1;
}

.chat-sidebar__chat-top {
  @apply flex min-w-0 items-center justify-between gap-2;
}

.chat-sidebar__chat-title-row {
  @apply flex min-w-0 flex-1 items-center gap-1.5;
}

.chat-sidebar__chat-icon {
  @apply h-3.5 w-3.5 shrink-0 text-zinc-700;
}

.chat-sidebar__chat-avatar {
  @apply h-11 w-11 shrink-0 rounded-full object-cover;
}

.chat-sidebar__chat-initials {
  @apply flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white;
}

.chat-sidebar__chat-title {
  @apply min-w-0 truncate text-sm font-semibold text-zinc-900;
}

.chat-sidebar__chat-premium {
  @apply flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold leading-none text-white;
}

.chat-sidebar__chat-meta {
  @apply flex shrink-0 items-center gap-1 text-xs;
}

.chat-sidebar__chat-read-state {
  @apply inline-flex items-center text-sky-500;
}

.chat-sidebar__chat-read-state[data-state='sent'] {
  @apply text-zinc-400;
}

.chat-sidebar__chat-read-state[data-state='placeholder'] {
  @apply rounded bg-amber-100 px-1 text-amber-700;
}

.chat-sidebar__chat-read-icon {
  @apply flex h-3.5 w-3.5 items-center justify-center text-[10px] font-bold leading-none;
}

.chat-sidebar__chat-read-placeholder {
  @apply text-[11px] leading-none;
}

.chat-sidebar__chat-date {
  @apply text-zinc-500;
}

.chat-sidebar__chat-date[data-placeholder='true'] {
  @apply rounded bg-amber-100 px-1 text-amber-700;
}

.chat-sidebar__chat-bottom {
  @apply flex min-w-0 items-center justify-between gap-2;
}

.chat-sidebar__chat-preview {
  @apply flex min-w-0 flex-1 items-center gap-1 text-sm text-zinc-500;
}

.chat-sidebar__chat-preview[data-placeholder='true'] {
  @apply text-amber-700;
}

.chat-sidebar__chat-author {
  @apply shrink-0 text-sky-600;
}

.chat-sidebar__chat-author[data-placeholder='true'] {
  @apply rounded bg-amber-100 px-1 text-amber-700;
}

.chat-sidebar__chat-forward {
  @apply h-3.5 w-3.5 shrink-0 text-zinc-400;
}

.chat-sidebar__chat-preview-text {
  @apply min-w-0 truncate;
}

.chat-sidebar__chat-state-slot {
  @apply flex h-5 min-w-5 shrink-0 items-center justify-center;
}

.chat-sidebar__chat-unread {
  @apply min-w-5 rounded-full bg-sky-500 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white;
}

.chat-sidebar__chat-unread[data-muted='true'] {
  @apply bg-zinc-300 text-zinc-700;
}

.chat-sidebar__chat-unread[data-placeholder='true'] {
  @apply bg-amber-200 text-amber-900 ring-1 ring-amber-400;
}

.chat-sidebar__chat-pin {
  @apply h-4 w-4 text-zinc-400;
}

.chat-sidebar__empty-message {
  @apply p-6 text-center text-sm text-zinc-500;
}
</style>
