import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  ref,
  watch,
  type ComputedRef
} from 'vue';

import { useDashboardHost, type DashboardHostEvent } from '@agentg/framework/dashboard';
import type { FileRef, ReadMessage } from '../../../src/views/schemas.js';
import {
  asRecord,
  errorMessage,
  normalizeDecisionReason,
  normalizeFileRef,
  normalizeMessage,
  normalizeMessageDeletion,
  normalizeMessageUpdate,
  readMessages
} from './normalizers.js';
import {
  buildTimelineItems,
  messageBelongsToChat,
  sortMessages,
  upsertMessageFile
} from './timeline.js';
import type {
  FetchMessagesPageResult,
  GetMessageResult,
  MessageTarget,
  RequestFileResult
} from './types.js';
import type { MessageScroll } from './useMessageScroll.js';

const MESSAGE_PAGE_SIZE = 100;

export function useMessageFeed(options: {
  scroll: MessageScroll;
  selectedChatAvatarUrl: ComputedRef<string | null>;
  selectedChatId: ComputedRef<string | null>;
}) {
  const host = useDashboardHost();
  const messages = shallowRef<ReadMessage[]>([]);
  const loadingInitial = ref(false);
  const loadingOlder = ref(false);
  const reachedStart = ref(false);
  const lastError = ref<string | null>(null);
  const oldestPageMessageId = ref<string | null>(null);

  let loadSequence = 0;
  let stopEvents: (() => void) | null = null;

  const sortedMessages = computed(() => sortMessages(messages.value));
  const messagesByTelegramId = computed(() => {
    const index = new Map<string, ReadMessage>();
    for (const message of sortedMessages.value) {
      index.set(message.telegramMessageId, message);
    }
    return index;
  });
  const timelineItems = computed(() =>
    buildTimelineItems(sortedMessages.value, {
      messagesByTelegramId: messagesByTelegramId.value,
      selectedChatAvatarUrl: options.selectedChatAvatarUrl.value
    })
  );
  const emptyMessage = computed(() =>
    options.selectedChatId.value === null
      ? 'Select a chat to read messages.'
      : 'No local messages yet.'
  );

  watch(
    options.selectedChatId,
    (chatId) => {
      const sequence = ++loadSequence;
      resetMessages();
      if (chatId !== null) {
        void loadInitialMessages(chatId, sequence);
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    stopEvents = host.subscribeEvents(applyEvent);
  });

  onBeforeUnmount(() => {
    stopEvents?.();
    stopEvents = null;
  });

  async function loadInitialMessages(chatId: string, sequence: number): Promise<void> {
    loadingInitial.value = true;
    lastError.value = null;
    try {
      const result = await host.rpc<FetchMessagesPageResult>('telegram.dashboard.messagesPage', {
        chatId,
        limit: MESSAGE_PAGE_SIZE
      });
      if (sequence !== loadSequence) {
        return;
      }
      const nextMessages = readMessages(result.messages).filter((message) =>
        messageBelongsToChat(message, chatId)
      );
      const sortedNextMessages = sortMessages(nextMessages);
      messages.value = sortedNextMessages;
      oldestPageMessageId.value = sortedNextMessages[0]?.telegramMessageId ?? null;
      reachedStart.value = result.reachedStart === true;
      await nextTick();
      options.scroll.scrollToBottom();
    } catch (error) {
      if (sequence === loadSequence) {
        lastError.value = errorMessage(error);
      }
    } finally {
      if (sequence === loadSequence) {
        loadingInitial.value = false;
      }
    }
  }

  async function loadOlderMessages(): Promise<void> {
    const chatId = options.selectedChatId.value;
    const beforeMessageId = oldestPageMessageId.value;
    const root = options.scroll.scrollRoot.value;
    if (
      chatId === null ||
      beforeMessageId === null ||
      loadingInitial.value ||
      loadingOlder.value ||
      reachedStart.value
    ) {
      return;
    }

    const previousScrollHeight = root?.scrollHeight ?? 0;
    const previousScrollTop = root?.scrollTop ?? 0;
    loadingOlder.value = true;
    lastError.value = null;
    try {
      const result = await host.rpc<FetchMessagesPageResult>('telegram.dashboard.messagesPage', {
        beforeMessageId,
        chatId,
        limit: MESSAGE_PAGE_SIZE
      });
      const nextMessages = readMessages(result.messages).filter((message) =>
        messageBelongsToChat(message, chatId)
      );
      const sortedNextMessages = sortMessages(nextMessages);
      mergeMessages(nextMessages);
      oldestPageMessageId.value = sortedNextMessages[0]?.telegramMessageId ?? beforeMessageId;
      reachedStart.value = result.reachedStart === true;
      await nextTick();
      if (root !== null) {
        root.scrollTop = root.scrollHeight - previousScrollHeight + previousScrollTop;
        options.scroll.updateScrollDownVisibility();
      }
    } catch (error) {
      lastError.value = errorMessage(error);
    } finally {
      loadingOlder.value = false;
    }
  }

  async function jumpToReply(target: MessageTarget | null): Promise<void> {
    const chatId = options.selectedChatId.value;
    if (target === null || chatId === null || target.chatId !== chatId) {
      return;
    }
    try {
      if (!messagesByTelegramId.value.has(target.messageId)) {
        await loadSingleLocalMessage(target);
      }
      await nextTick();
      options.scroll.scrollToMessage(target.messageId);
    } catch (error) {
      lastError.value = errorMessage(error);
    }
  }

  async function requestMediaFile(file: FileRef): Promise<void> {
    if (!file.canRequest) {
      return;
    }
    try {
      const result = await host.rpc<RequestFileResult>('telegram.dashboard.requestFile', {
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

  function applyCreatedMessage(event: DashboardHostEvent): void {
    const chatId = options.selectedChatId.value;
    const message = normalizeMessage(asRecord(asRecord(event.data)?.message));
    if (chatId === null || message === null || !messageBelongsToChat(message, chatId)) {
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
    const chatId = options.selectedChatId.value;
    const update = normalizeMessageUpdate(asRecord(asRecord(event.data)?.message));
    if (chatId === null || update?.chatId !== chatId) {
      return;
    }
    messages.value = messages.value.map((message) =>
      message.telegramMessageId === update.messageId
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
    const chatId = options.selectedChatId.value;
    const deletion = normalizeMessageDeletion(asRecord(asRecord(event.data)?.delete));
    if (chatId === null || deletion?.chatId !== chatId) {
      return;
    }
    messages.value = messages.value.map((message) =>
      deletion.messageIds.has(message.id)
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

  async function loadSingleLocalMessage(target: MessageTarget): Promise<void> {
    const result = await host.rpc<GetMessageResult>('telegram.dashboard.message', {
      chatId: target.chatId,
      messageId: target.messageId
    });
    const message = normalizeMessage(asRecord(result.message));
    if (message !== null && messageBelongsToChat(message, target.chatId)) {
      mergeMessages([message]);
    }
  }

  function mergeMessages(nextMessages: ReadMessage[]): void {
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

  function resetMessages(): void {
    messages.value = [];
    loadingInitial.value = false;
    loadingOlder.value = false;
    reachedStart.value = false;
    lastError.value = null;
    oldestPageMessageId.value = null;
    options.scroll.resetScrollState();
  }

  return {
    emptyMessage,
    jumpToReply,
    lastError,
    loadOlderMessages,
    loadingInitial,
    loadingOlder,
    requestMediaFile,
    timelineItems
  };
}
