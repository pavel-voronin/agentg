<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SolarArchiveDownBold from '~icons/solar/archive-down-bold';
import SolarBookBold from '~icons/solar/book-bold';
import SolarCaseBold from '~icons/solar/case-bold';
import SolarChartBold from '~icons/solar/chart-bold';
import SolarChatDotsBold from '~icons/solar/chat-dots-bold';
import SolarChatSquareCodeBold from '~icons/solar/chat-square-code-bold';
import SolarCheckCircleBold from '~icons/solar/check-circle-bold';
import SolarCheckReadBold from '~icons/solar/check-read-bold';
import SolarCloseCircleBold from '~icons/solar/close-circle-bold';
import SolarCrownBold from '~icons/solar/crown-bold';
import SolarCrownStarBold from '~icons/solar/crown-star-bold';
import SolarFolderBold from '~icons/solar/folder-bold';
import SolarForward2Bold from '~icons/solar/forward-2-bold';
import SolarGamepadBold from '~icons/solar/gamepad-bold';
import SolarHeartBold from '~icons/solar/heart-bold';
import SolarHomeBold from '~icons/solar/home-bold';
import SolarLockKeyholeMinimalisticBold from '~icons/solar/lock-keyhole-minimalistic-bold';
import SolarMapPointSchoolBold from '~icons/solar/map-point-school-bold';
import SolarMedalStarBold from '~icons/solar/medal-star-bold';
import SolarPinBold from '~icons/solar/pin-bold';
import SolarPlainBold from '~icons/solar/plain-bold';
import SolarUnreadBold from '~icons/solar/unread-bold';
import SolarUsersGroupRoundedBold from '~icons/solar/users-group-rounded-bold';
import SolarFootballBold from '~icons/solar/football-bold';

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
          <SolarCloseCircleBold class="chat-sidebar__search-clear-icon" aria-hidden="true" />
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
            <SolarChatDotsBold
              v-if="folder.icon === 'chats'"
              class="chat-sidebar__folder-icon"
              aria-hidden="true"
            />
            <SolarArchiveDownBold
              v-else-if="folder.icon === 'archive'"
              class="chat-sidebar__folder-icon"
              aria-hidden="true"
            />
            <SolarFolderBold v-else class="chat-sidebar__folder-icon" aria-hidden="true" />
            <span
              v-if="folder.badge"
              class="chat-sidebar__folder-badge"
              :data-tone="folder.badgeTone"
            >
              {{ folder.badge }}
            </span>
          </span>
          <span v-if="folder.iconAccent" class="chat-sidebar__folder-accent">
            <SolarBookBold
              v-if="folder.iconAccent === 'book'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarChatSquareCodeBold
              v-else-if="folder.iconAccent === 'bot'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarCrownBold
              v-else-if="folder.iconAccent === 'crown'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarMedalStarBold
              v-else-if="folder.iconAccent === 'favorite'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarGamepadBold
              v-else-if="folder.iconAccent === 'game'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarHomeBold
              v-else-if="folder.iconAccent === 'home'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarHeartBold
              v-else-if="folder.iconAccent === 'love'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarLockKeyholeMinimalisticBold
              v-else-if="folder.iconAccent === 'private'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarMapPointSchoolBold
              v-else-if="folder.iconAccent === 'school'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarFootballBold
              v-else-if="folder.iconAccent === 'sport'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarChartBold
              v-else-if="folder.iconAccent === 'trade'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarPlainBold
              v-else-if="folder.iconAccent === 'travel'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarUnreadBold
              v-else-if="folder.iconAccent === 'unread'"
              class="chat-sidebar__folder-accent-icon"
              aria-hidden="true"
            />
            <SolarCaseBold v-else class="chat-sidebar__folder-accent-icon" aria-hidden="true" />
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
                  <SolarChatSquareCodeBold
                    v-if="chat.icon === 'bot'"
                    class="chat-sidebar__chat-icon"
                    aria-hidden="true"
                  />
                  <SolarPlainBold
                    v-else-if="chat.icon === 'channel'"
                    class="chat-sidebar__chat-icon"
                    aria-hidden="true"
                  />
                  <SolarUsersGroupRoundedBold
                    v-else-if="chat.icon === 'group'"
                    class="chat-sidebar__chat-icon"
                    aria-hidden="true"
                  />
                  <SolarLockKeyholeMinimalisticBold
                    v-else-if="chat.icon === 'secret'"
                    class="chat-sidebar__chat-icon"
                    aria-hidden="true"
                  />
                  <div class="chat-sidebar__chat-title">{{ chat.title }}</div>
                  <SolarCrownStarBold
                    v-if="chat.isPremium"
                    class="chat-sidebar__chat-premium"
                    title="Telegram Premium"
                    aria-hidden="true"
                  />
                </div>
                <div class="chat-sidebar__chat-meta">
                  <span
                    v-if="chat.lastMessage.readState"
                    class="chat-sidebar__chat-read-state"
                    :data-state="chat.lastMessage.readState"
                  >
                    <SolarCheckReadBold
                      v-if="chat.lastMessage.readState === 'read'"
                      class="chat-sidebar__chat-read-icon"
                      aria-hidden="true"
                    />
                    <SolarCheckCircleBold
                      v-else-if="chat.lastMessage.readState === 'sent'"
                      class="chat-sidebar__chat-read-icon"
                      aria-hidden="true"
                    />
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
                  <SolarForward2Bold
                    v-if="chat.lastMessage.isForwarded"
                    class="chat-sidebar__chat-forward"
                    aria-hidden="true"
                  />
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
                  <SolarPinBold
                    v-else-if="chat.isPinned"
                    class="chat-sidebar__chat-pin"
                    aria-hidden="true"
                  />
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
  @apply h-3.5 w-3.5;
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
  @apply h-4 w-4;
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
  @apply h-3.5 w-3.5 shrink-0 text-sky-500;
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
  @apply h-3.5 w-3.5;
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
