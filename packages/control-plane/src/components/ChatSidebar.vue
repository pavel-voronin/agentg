<script setup lang="ts">
import { nextTick, ref } from 'vue';

import type {
  ChatFolderNavItem,
  ChatListItemView,
  ChatSidebarView
} from '../stores/controlPlaneTypes.js';
import UiButton from '../ui/UiButton.vue';

defineProps<{
  view: ChatSidebarView;
}>();

const emit = defineEmits<{
  archiveOpen: [];
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

const baseChatButtonClass =
  'block w-full border-b border-zinc-100 px-3 py-3 text-left hover:bg-zinc-50';

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

function openFolder(item: ChatFolderNavItem): void {
  if (item.type === 'main') {
    emit('mainOpen');
    return;
  }
  if (item.folderId !== undefined) {
    emit('folderOpen', item.folderId);
  }
}

function chatButtonClass(chat: ChatListItemView): string {
  return chat.active
    ? `${baseChatButtonClass} bg-teal-50 ring-1 ring-inset ring-teal-200`
    : `${baseChatButtonClass} bg-white`;
}

function folderButtonClass(active: boolean): string {
  return active ? 'bg-sky-500/20 text-sky-200' : 'text-slate-300 hover:bg-slate-700/70';
}

function inputTarget(event: Event): InputEventTarget | null {
  return event.target === null ? null : (event.target as unknown as InputEventTarget);
}
</script>

<template>
  <aside class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
    <div class="grid shrink-0 gap-1.5 border-b border-zinc-200 px-2.5 py-2">
      <div class="relative">
        <input
          ref="searchInput"
          :value="view.search"
          class="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-2.5 pr-8 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="Search title or id"
          @input="onSearchInput"
        />
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          :class="[
            'absolute right-1.5 top-1/2 h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-base leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
            view.hasSearch ? 'inline-flex' : 'hidden'
          ]"
          @click="clearSearch"
        >
          ×
        </button>
      </div>
    </div>
    <div class="grid min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)] overflow-hidden">
      <nav class="min-h-0 overflow-auto bg-slate-800">
        <button
          v-for="folder in view.folders"
          :key="folder.id"
          type="button"
          :title="folder.title"
          :class="[
            'relative flex min-h-16 w-full flex-col items-center justify-center px-1 py-2 text-center text-[11px] font-medium',
            folderButtonClass(folder.active)
          ]"
          @click="openFolder(folder)"
        >
          <span class="truncate">{{ folder.label }}</span>
          <span
            v-if="folder.badge"
            class="mt-1 rounded-full bg-slate-500 px-1.5 py-0.5 text-[10px] leading-none text-white"
          >
            {{ folder.badge }}
          </span>
        </button>
      </nav>

      <div class="min-h-0 overflow-auto">
        <div
          v-if="view.header?.kind === 'search'"
          class="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500"
        >
          {{ view.header.title }}
        </div>

        <div v-else-if="view.header?.kind === 'archive'" class="border-b border-zinc-100 p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">{{ view.header.title }}</div>
              <div class="text-xs text-zinc-500">{{ view.header.subtitle }}</div>
            </div>
            <UiButton class="shrink-0 px-2.5 text-xs" @click="emit('mainOpen')"> Main </UiButton>
          </div>
        </div>

        <button
          v-if="view.archiveShortcut"
          type="button"
          class="block w-full border-b border-zinc-100 bg-zinc-50 px-3 py-3 text-left hover:bg-zinc-100"
          @click="emit('archiveOpen')"
        >
          <div class="flex min-w-0 items-center justify-between gap-2">
            <div class="min-w-0 truncate font-semibold">Archived chats</div>
            <span
              class="shrink-0 rounded-full bg-zinc-300 px-2 py-0.5 text-xs font-semibold text-white"
            >
              {{ view.archiveShortcut.count }}
            </span>
          </div>
          <div class="mt-1 text-xs text-zinc-500">Open archive</div>
        </button>

        <button
          v-for="chat in view.chats"
          :key="chat.id"
          type="button"
          :class="chatButtonClass(chat)"
          @click="emit('chatToggle', chat.id)"
        >
          <div class="flex min-w-0 items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-1.5">
              <svg
                v-if="chat.icon === 'bot'"
                class="h-3.5 w-3.5 shrink-0 text-zinc-700"
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
                class="h-3.5 w-3.5 shrink-0 text-zinc-700"
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
                class="h-3.5 w-3.5 shrink-0 text-zinc-700"
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
                class="h-3.5 w-3.5 shrink-0 text-zinc-700"
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
              <div class="min-w-0 truncate font-semibold">{{ chat.title }}</div>
            </div>
          </div>
          <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>targets {{ chat.targets }}</span>
            <span>coverage {{ chat.coverageIntervals }}</span>
            <span>jobs {{ chat.pendingJobs }}/{{ chat.runningJobs }}</span>
          </div>
        </button>

        <div v-if="view.emptyMessage" class="p-6 text-center text-sm text-zinc-500">
          {{ view.emptyMessage }}
        </div>
      </div>
    </div>
  </aside>
</template>
