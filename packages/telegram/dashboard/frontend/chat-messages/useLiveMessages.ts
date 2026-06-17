import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type ComputedRef
} from 'vue';

import { useDashboardHost, type DashboardHostEvent } from '@agentg/framework/dashboard';

import type { FileRef, Message } from '../../../src/domain/models/message.js';
import { useTelegramDashboardApi } from '../api.js';
import {
  fileOwnerEventKey,
  normalizeFileOwnerChangedEvent,
  type FileOwnerChangedPayload
} from '../fileEvents.js';
import { normalizeFileRef } from '../fileRefs.js';
import { buildLiveItems, type LiveMessageChat } from './liveMessages.js';
import {
  asRecord,
  errorMessage,
  normalizeDecisionReason,
  normalizeMessage,
  normalizeMessageDeletion,
  normalizeMessageUpdate
} from './normalizers.js';
import { sortMessages, upsertMessageFile } from './timeline.js';
import type { MessageScroll } from './useMessageScroll.js';

export function useLiveMessages(options: {
  chatsById: ComputedRef<ReadonlyMap<string, LiveMessageChat>>;
  scroll: MessageScroll;
}) {
  const api = useTelegramDashboardApi();
  const host = useDashboardHost();
  const messages = shallowRef<Message[]>([]);
  const lastError = ref<string | null>(null);
  const fileOwnerVersions = new Map<string, string>();
  let stopEvents: (() => void) | null = null;

  const liveItems = computed(() => buildLiveItems(messages.value, options.chatsById.value));

  onMounted(() => {
    stopEvents = host.subscribeEvents(applyEvent);
  });

  onBeforeUnmount(() => {
    stopEvents?.();
    stopEvents = null;
  });

  async function requestMediaFile(file: FileRef): Promise<void> {
    if (!file.canRequest) {
      return;
    }
    try {
      const result = await api.requestFile({
        owner: file.owner,
        slotKey: file.slotKey
      });
      const requestedFile = normalizeFileRef(asRecord(result.file));
      if (requestedFile !== null) {
        mergeMessageFile(requestedFile);
      }
      const decisionReason = normalizeDecisionReason(result.decision);
      if (decisionReason !== null) {
        lastError.value = decisionReason;
      }
    } catch (error) {
      lastError.value = errorMessage(error);
    }
  }

  function applyEvent(event: DashboardHostEvent): void {
    const fileChange = normalizeFileOwnerChangedEvent(event);
    if (fileChange !== null) {
      applyFileOwnerChange(fileChange);
      return;
    }

    if (event.type === 'telegram.message.created') {
      applyCreatedMessage(event);
      return;
    }
    if (event.type === 'telegram.message.updated') {
      applyUpdatedMessage(event);
      return;
    }
    if (event.type === 'telegram.message.deleted') {
      applyDeletedMessages(event);
    }
  }

  function applyFileOwnerChange(change: FileOwnerChangedPayload): void {
    if (change.owner.ownerModel !== 'telegram.message' || !shouldApplyFileOwnerChange(change)) {
      return;
    }
    messages.value = messages.value.map((message) =>
      message.id === change.owner.ownerId
        ? {
            ...message,
            media: {
              files: change.files
            }
          }
        : message
    );
    void nextTick(() => {
      options.scroll.updateScrollDownVisibility();
    });
  }

  function shouldApplyFileOwnerChange(change: FileOwnerChangedPayload): boolean {
    const key = fileOwnerEventKey(change);
    const previous = fileOwnerVersions.get(key);
    if (previous !== undefined && previous > change.updatedAt) {
      return false;
    }
    fileOwnerVersions.set(key, change.updatedAt);
    return true;
  }

  function applyCreatedMessage(event: DashboardHostEvent): void {
    const message = normalizeMessage(asRecord(asRecord(event.data)?.message));
    if (message === null) {
      return;
    }

    const shouldStayAtBottom = options.scroll.isNearBottom();
    mergeMessages([message]);
    if (shouldStayAtBottom) {
      void nextTick(() => {
        options.scroll.scrollToBottom();
      });
      return;
    }
    void nextTick(() => {
      options.scroll.updateScrollDownVisibility();
    });
  }

  function applyUpdatedMessage(event: DashboardHostEvent): void {
    const update = normalizeMessageUpdate(asRecord(asRecord(event.data)?.message));
    if (update === null) {
      return;
    }
    messages.value = messages.value.map((message) =>
      message.chat.id === update.chatId && message.telegramMessageId === update.messageId
        ? {
            ...message,
            contentType: update.contentType,
            editDate: update.editDate,
            media: update.mediaFiles === null ? message.media : { files: update.mediaFiles },
            reactions: update.reactions,
            serviceAction: update.serviceAction,
            text: update.text,
            textEntities: update.textEntities
          }
        : message
    );
    void nextTick(() => {
      options.scroll.updateScrollDownVisibility();
    });
  }

  function applyDeletedMessages(event: DashboardHostEvent): void {
    const deletion = normalizeMessageDeletion(asRecord(asRecord(event.data)?.delete));
    if (deletion === null) {
      return;
    }
    messages.value = messages.value.map((message) =>
      message.chat.id === deletion.chatId && deletion.messageIds.has(message.id)
        ? {
            ...message,
            deletedAt: deletion.deletedAt ?? message.deletedAt,
            isDeleted: true,
            text: null
          }
        : message
    );
    void nextTick(() => {
      options.scroll.updateScrollDownVisibility();
    });
  }

  function mergeMessages(nextMessages: Message[]): void {
    if (nextMessages.length === 0) {
      return;
    }
    const byId = new Map(messages.value.map((message) => [message.id, message]));
    for (const message of nextMessages) {
      byId.set(message.id, message);
    }
    messages.value = sortMessages([...byId.values()]);
  }

  function mergeMessageFile(file: FileRef): void {
    if (file.owner._model !== 'telegram.message') {
      return;
    }
    messages.value = messages.value.map((message) =>
      message.id === file.owner.id
        ? {
            ...message,
            media: {
              files: upsertMessageFile(message.media.files, file)
            }
          }
        : message
    );
  }

  return {
    lastError,
    liveItems,
    requestMediaFile
  };
}
