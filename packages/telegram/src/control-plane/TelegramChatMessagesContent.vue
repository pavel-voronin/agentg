<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type ComponentPublicInstance
} from 'vue';

import { useControlPlaneHost, type ControlPlaneHostEvent } from '@agentg/control-plane-sdk/host';
import type { SlotContext } from '@agentg/control-plane-sdk/slots';
import type {
  TelegramMessageServiceAction,
  TelegramMessageTextEntity,
  TelegramReadMessage
} from '../rpc/contracts.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

type FetchMessagesPageResult = {
  messages?: unknown;
  reachedStart?: unknown;
};

type GetMessageResult = {
  message?: unknown;
};

type TimelineDateItem = {
  dateKey: string;
  id: string;
  kind: 'date';
  label: string;
};

type TimelineMessageItem = {
  dateLabel: string;
  id: string;
  kind: 'message';
  message: TelegramReadMessage;
  view: MessageView;
};

type TimelineServiceItem = {
  dateLabel: string;
  id: string;
  kind: 'service';
  label: string;
  message: TelegramReadMessage;
};

type TimelineItem = TimelineDateItem | TimelineMessageItem | TimelineServiceItem;

type MessageView = {
  avatar: string;
  body: string;
  bodySegments: MessageTextSegment[];
  contentLabel: string | null;
  dateKey: string;
  isReplyLoaded: boolean;
  sender: string | null;
  time: string;
  replyTarget: MessageTarget | null;
  replyText: string | null;
};

type MessageTarget = {
  chatId: string;
  messageId: string;
};

type MessageTextSegment =
  | {
      id: string;
      kind: 'link';
      text: string;
      url: string;
    }
  | {
      id: string;
      kind: 'text';
      text: string;
    };

type TemplateRef = ComponentPublicInstance | Element | null;

const MESSAGE_PAGE_SIZE = 100;
const LOAD_OLDER_EDGE_PX = 160;
const AUTO_SCROLL_BOTTOM_PX = 180;
const SCROLL_BOTTOM_EPSILON_PX = 2;
const DATE_ISLAND_HIDE_DELAY_MS = 1000;
const DATE_ISLAND_SAMPLE_OFFSETS = [12, 40, 80] as const;
const highlightDurationMs = 1600;

const host = useControlPlaneHost();
const scrollRoot = ref<HTMLElement | null>(null);
const messages = shallowRef<TelegramReadMessage[]>([]);
const loadingInitial = ref(false);
const loadingOlder = ref(false);
const reachedStart = ref(false);
const lastError = ref<string | null>(null);
const showScrollDown = ref(false);
const floatingDateLabel = ref<string | null>(null);
const floatingDateVisible = ref(false);
const oldestPageMessageId = ref<string | null>(null);
const highlightedMessageId = ref<string | null>(null);
const messageElements = new Map<string, HTMLElement>();

let loadSequence = 0;
let stopEvents: (() => void) | null = null;
let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
let dateIslandHideTimeout: ReturnType<typeof setTimeout> | null = null;
let dateIslandFrame: number | null = null;

const selectedChatId = computed(() => {
  const value = props.slotContext?.selectedChatId;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
});
const sortedMessages = computed(() => sortMessages(messages.value));
const messagesByTelegramId = computed(() => {
  const index = new Map<string, TelegramReadMessage>();
  for (const message of sortedMessages.value) {
    index.set(message.telegramMessageId, message);
  }
  return index;
});
const timelineItems = computed<TimelineItem[]>(() => buildTimelineItems(sortedMessages.value));
const emptyMessage = computed(() =>
  selectedChatId.value === null ? 'Select a chat to read messages.' : 'No local messages yet.'
);

watch(
  selectedChatId,
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
  stopEvents = host.subscribeEvents(applyTelegramEvent);
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
  clearHighlightTimeout();
  clearDateIslandTimeout();
  cancelDateIslandFrame();
});

async function loadInitialMessages(chatId: string, sequence: number): Promise<void> {
  loadingInitial.value = true;
  lastError.value = null;
  try {
    const result = await host.rpc<FetchMessagesPageResult>('telegram.fetchMessagesPage', {
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
    scrollToBottom();
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
  const chatId = selectedChatId.value;
  const beforeMessageId = oldestPageMessageId.value;
  const root = scrollRoot.value;
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
    const result = await host.rpc<FetchMessagesPageResult>('telegram.fetchMessagesPage', {
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
      updateScrollDownVisibility();
    }
  } catch (error) {
    lastError.value = errorMessage(error);
  } finally {
    loadingOlder.value = false;
  }
}

function applyTelegramEvent(event: ControlPlaneHostEvent): void {
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

function applyCreatedMessage(event: ControlPlaneHostEvent): void {
  const chatId = selectedChatId.value;
  const message = normalizeMessage(asRecord(asRecord(event.data)?.message));
  if (chatId === null || message === null || !messageBelongsToChat(message, chatId)) {
    return;
  }
  const shouldStayAtBottom = isNearBottom();
  mergeMessages([message]);
  if (shouldStayAtBottom) {
    void nextTick(scrollToBottom);
    return;
  }
  void nextTick(updateScrollDownVisibility);
}

function applyUpdatedMessage(event: ControlPlaneHostEvent): void {
  const chatId = selectedChatId.value;
  const update = normalizeMessageUpdate(asRecord(asRecord(event.data)?.message));
  if (chatId === null || update === null || update.chatId !== chatId) {
    return;
  }
  messages.value = messages.value.map((message) =>
    message.telegramMessageId === update.messageId
      ? {
          ...message,
          contentType: update.contentType,
          editDate: update.editDate,
          serviceAction: update.serviceAction,
          text: update.text,
          textEntities: update.textEntities
        }
      : message
  );
  void nextTick(updateScrollDownVisibility);
}

function applyDeletedMessages(event: ControlPlaneHostEvent): void {
  const chatId = selectedChatId.value;
  const deletion = asRecord(asRecord(event.data)?.delete);
  const deletedChatId = asString(asRecord(deletion?.chat)?.id);
  if (chatId === null || deletedChatId !== chatId) {
    return;
  }
  const deletedAt = asString(deletion?.deletedAt);
  const deletedIds = new Set(
    asArray(deletion?.messages)
      .map((message) => asString(message.id))
      .filter(isDefined)
  );
  if (deletedIds.size === 0) {
    return;
  }
  messages.value = messages.value.map((message) =>
    deletedIds.has(message.id)
      ? {
          ...message,
          deletedAt: deletedAt ?? message.deletedAt,
          isDeleted: true,
          text: null
        }
      : message
  );
  void nextTick(updateScrollDownVisibility);
}

function onScroll(): void {
  updateScrollDownVisibility();
  showFloatingDateIsland();
  const root = scrollRoot.value;
  if (root !== null && root.scrollTop <= LOAD_OLDER_EDGE_PX) {
    void loadOlderMessages();
  }
}

function scrollToBottom(): void {
  const root = scrollRoot.value;
  if (root === null) {
    return;
  }
  root.scrollTop = root.scrollHeight;
  updateScrollDownVisibility();
}

async function jumpToReply(target: MessageTarget | null): Promise<void> {
  const chatId = selectedChatId.value;
  if (target === null || chatId === null || target.chatId !== chatId) {
    return;
  }
  try {
    if (!messagesByTelegramId.value.has(target.messageId)) {
      await loadSingleLocalMessage(target);
    }
    await nextTick();
    scrollToMessage(target.messageId);
  } catch (error) {
    lastError.value = errorMessage(error);
  }
}

async function loadSingleLocalMessage(target: MessageTarget): Promise<void> {
  const result = await host.rpc<GetMessageResult>('telegram.getMessage', {
    chatId: target.chatId,
    messageId: target.messageId
  });
  const message = normalizeMessage(asRecord(result.message));
  if (message !== null && messageBelongsToChat(message, target.chatId)) {
    mergeMessages([message]);
  }
}

function scrollToMessage(messageId: string): void {
  const element = messageElements.get(messageId);
  if (element === undefined) {
    return;
  }
  element.scrollIntoView({ block: 'center' });
  highlightedMessageId.value = messageId;
  clearHighlightTimeout();
  highlightTimeout = setTimeout(() => {
    highlightedMessageId.value = null;
    highlightTimeout = null;
  }, highlightDurationMs);
}

function setMessageElement(messageId: string, value: TemplateRef): void {
  const element = htmlElementFromRef(value);
  if (element === null) {
    messageElements.delete(messageId);
    return;
  }
  messageElements.set(messageId, element);
}

function buildTimelineItems(input: TelegramReadMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let currentDateKey = '';
  for (const message of input) {
    const messageDateKey = dateKey(message.messageDate);
    const messageDateLabel = formatDateLabel(message.messageDate);
    if (messageDateKey !== currentDateKey) {
      currentDateKey = messageDateKey;
      items.push({
        dateKey: currentDateKey,
        id: `date:${currentDateKey}`,
        kind: 'date',
        label: messageDateLabel
      });
    }
    const serviceLabel = messageServiceLabel(message);
    if (serviceLabel !== null) {
      items.push({
        dateLabel: messageDateLabel,
        id: `service:${message.id}`,
        kind: 'service',
        label: serviceLabel,
        message
      });
      continue;
    }
    items.push({
      dateLabel: messageDateLabel,
      id: message.id,
      kind: 'message',
      message,
      view: messageView(message)
    });
  }
  return items;
}

function messageView(message: TelegramReadMessage): MessageView {
  const replyTarget = message.replyTo === null ? null : replyTargetFromMessage(message);
  const replyMessage =
    replyTarget === null ? null : (messagesByTelegramId.value.get(replyTarget.messageId) ?? null);
  const sender = senderLabel(message);

  return {
    avatar: avatarLabel(sender ?? message.sender?.id ?? message.chat.id),
    body: messageBody(message),
    bodySegments: messageTextSegments(message),
    contentLabel: message.text === null ? contentLabel(message.contentType) : null,
    dateKey: dateKey(message.messageDate),
    isReplyLoaded: replyMessage !== null,
    replyTarget,
    replyText:
      replyTarget === null
        ? null
        : replyMessage === null
          ? `Message ${replyTarget.messageId}`
          : messageBody(replyMessage),
    sender,
    time: formatTimeLabel(message.messageDate)
  };
}

function mergeMessages(nextMessages: TelegramReadMessage[]): void {
  if (nextMessages.length === 0) {
    return;
  }
  const byId = new Map(messages.value.map((message) => [message.id, message]));
  for (const message of nextMessages) {
    byId.set(message.id, message);
  }
  messages.value = sortMessages([...byId.values()]);
}

function resetMessages(): void {
  messages.value = [];
  messageElements.clear();
  loadingInitial.value = false;
  loadingOlder.value = false;
  reachedStart.value = false;
  lastError.value = null;
  showScrollDown.value = false;
  floatingDateLabel.value = null;
  floatingDateVisible.value = false;
  oldestPageMessageId.value = null;
  highlightedMessageId.value = null;
  clearHighlightTimeout();
  clearDateIslandTimeout();
  cancelDateIslandFrame();
}

function readMessages(value: unknown): TelegramReadMessage[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeMessage(asRecord(item))).filter(isDefined)
    : [];
}

function normalizeMessage(value: Record<string, unknown> | undefined): TelegramReadMessage | null {
  const id = asString(value?.id);
  const chat = asRecord(value?.chat);
  const chatId = asString(chat?.id);
  const contentType = asString(value?.contentType);
  const telegramMessageId = asString(value?.telegramMessageId);
  const updatedAt = asString(value?.updatedAt);
  if (
    id === undefined ||
    chatId === undefined ||
    contentType === undefined ||
    telegramMessageId === undefined ||
    updatedAt === undefined
  ) {
    return null;
  }

  return {
    _model: 'telegram.message',
    chat: {
      _model: 'telegram.chat',
      id: chatId
    },
    contentType,
    deletedAt: asNullableString(value?.deletedAt),
    editDate: asNullableString(value?.editDate),
    id,
    isDeleted: value?.isDeleted === true,
    isOutgoing: value?.isOutgoing === true,
    messageDate: asNullableString(value?.messageDate),
    replyTo: normalizeReply(value?.replyTo),
    sender: normalizeSender(value?.sender),
    senderDisplayName: asNullableString(value?.senderDisplayName),
    senderType: asNullableString(value?.senderType),
    serviceAction: normalizeServiceAction(value?.serviceAction),
    telegramMessageId,
    text: asNullableString(value?.text),
    textEntities: normalizeTextEntities(value?.textEntities),
    updatedAt
  };
}

function normalizeMessageUpdate(value: Record<string, unknown> | undefined): {
  chatId: string;
  contentType: string;
  editDate: string | null;
  messageId: string;
  serviceAction: TelegramMessageServiceAction | null;
  text: string | null;
  textEntities: TelegramMessageTextEntity[];
} | null {
  const chatId = asString(asRecord(value?.chat)?.id);
  const contentType = asString(value?.contentType);
  const messageId = asString(value?.telegramMessageId);
  if (chatId === undefined || contentType === undefined || messageId === undefined) {
    return null;
  }
  return {
    chatId,
    contentType,
    editDate: asNullableString(value?.editDate),
    messageId,
    serviceAction: normalizeServiceAction(value?.serviceAction),
    text: asNullableString(value?.text),
    textEntities: normalizeTextEntities(value?.textEntities)
  };
}

function normalizeTextEntities(value: unknown): TelegramMessageTextEntity[] {
  return asArray(value).map(normalizeTextEntity).filter(isDefined);
}

function normalizeTextEntity(
  value: Record<string, unknown>
): TelegramMessageTextEntity | undefined {
  const kind = value.kind;
  const offset = value.offset;
  const length = value.length;
  const url = asString(value.url);
  if (
    (kind !== 'url' && kind !== 'textUrl') ||
    typeof offset !== 'number' ||
    typeof length !== 'number' ||
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length <= 0 ||
    url === undefined ||
    !isSafeLinkUrl(url)
  ) {
    return undefined;
  }
  return {
    kind,
    length,
    offset,
    url
  };
}

function normalizeReply(value: unknown): TelegramReadMessage['replyTo'] {
  const reply = asRecord(value);
  const chatId = asString(asRecord(reply?.chat)?.id);
  const messageId = asString(reply?.telegramMessageId);
  const modelId = asString(asRecord(reply?.message)?.id);
  if (chatId === undefined || messageId === undefined || modelId === undefined) {
    return null;
  }
  return {
    chat: {
      _model: 'telegram.chat',
      id: chatId
    },
    message: {
      _model: 'telegram.message',
      id: modelId
    },
    telegramMessageId: messageId
  };
}

function normalizeServiceAction(value: unknown): TelegramMessageServiceAction | null {
  const action = asRecord(value);
  if (action?.kind !== 'chatMemberLeft') {
    return null;
  }

  const userId = asString(asRecord(action.user)?.id);
  if (userId === undefined) {
    return null;
  }

  return {
    kind: 'chatMemberLeft',
    user: {
      _model: 'telegram.user',
      id: userId
    },
    userDisplayName: asNullableString(action.userDisplayName) ?? userId
  };
}

function normalizeSender(value: unknown): TelegramReadMessage['sender'] {
  const sender = asRecord(value);
  const model = asString(sender?._model);
  const id = asString(sender?.id);
  if (id === undefined) {
    return null;
  }
  if (model === 'telegram.chat') {
    return {
      _model: 'telegram.chat',
      id
    };
  }
  if (model === 'telegram.user') {
    return {
      _model: 'telegram.user',
      id
    };
  }
  return null;
}

function messageBelongsToChat(message: TelegramReadMessage, chatId: string): boolean {
  return message.chat.id === chatId;
}

function replyTargetFromMessage(message: TelegramReadMessage): MessageTarget | null {
  if (message.replyTo === null) {
    return null;
  }
  return {
    chatId: message.replyTo.chat.id,
    messageId: message.replyTo.telegramMessageId
  };
}

function messageBody(message: TelegramReadMessage): string {
  if (message.isDeleted) {
    return 'Deleted message';
  }
  const text = message.text?.trim();
  if (text !== undefined && text.length > 0) {
    return text;
  }
  return contentLabel(message.contentType) ?? 'Unsupported message';
}

function messageServiceLabel(message: TelegramReadMessage): string | null {
  const action = message.serviceAction;
  if (action?.kind !== 'chatMemberLeft') {
    return null;
  }
  return `${action.userDisplayName} left the group`;
}

function messageTextSegments(message: TelegramReadMessage): MessageTextSegment[] {
  const text = message.text;
  if (message.isDeleted || text === null || text.length === 0) {
    return [{ id: 'text:0', kind: 'text', text: messageBody(message) }];
  }

  const entities = message.textEntities
    .map((entity) => normalizeRenderableTextEntity(entity, text))
    .filter(isDefined)
    .sort(compareTextEntities);
  if (entities.length === 0) {
    return [{ id: 'text:0', kind: 'text', text }];
  }

  const segments: MessageTextSegment[] = [];
  let cursor = 0;
  for (const entity of entities) {
    if (entity.offset < cursor) {
      continue;
    }
    if (entity.offset > cursor) {
      segments.push({
        id: `text:${String(cursor)}`,
        kind: 'text',
        text: text.slice(cursor, entity.offset)
      });
    }
    segments.push({
      id: `link:${String(entity.offset)}`,
      kind: 'link',
      text: text.slice(entity.offset, entity.offset + entity.length),
      url: entity.url
    });
    cursor = entity.offset + entity.length;
  }

  if (cursor < text.length) {
    segments.push({
      id: `text:${String(cursor)}`,
      kind: 'text',
      text: text.slice(cursor)
    });
  }

  return segments.length === 0 ? [{ id: 'text:0', kind: 'text', text }] : segments;
}

function normalizeRenderableTextEntity(
  entity: TelegramMessageTextEntity,
  text: string
): TelegramMessageTextEntity | undefined {
  if (
    entity.offset < 0 ||
    entity.length <= 0 ||
    entity.offset + entity.length > text.length ||
    !isSafeLinkUrl(entity.url)
  ) {
    return undefined;
  }
  return entity;
}

function compareTextEntities(
  left: TelegramMessageTextEntity,
  right: TelegramMessageTextEntity
): number {
  if (left.offset !== right.offset) {
    return left.offset - right.offset;
  }
  return right.length - left.length;
}

function isSafeLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function contentLabel(contentType: string): string | null {
  if (contentType === 'messageText') {
    return null;
  }
  return contentType.replace(/^message/, '').trim() || contentType;
}

function senderLabel(message: TelegramReadMessage): string | null {
  if (message.isOutgoing) {
    return null;
  }
  if (message.senderDisplayName !== null && message.senderDisplayName.length > 0) {
    return message.senderDisplayName;
  }
  return message.sender?.id ?? null;
}

function avatarLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? '?' : trimmed.slice(0, 1).toLocaleUpperCase();
}

function sortMessages(input: TelegramReadMessage[]): TelegramReadMessage[] {
  return [...input].sort(compareMessages);
}

function compareMessages(left: TelegramReadMessage, right: TelegramReadMessage): number {
  const dateComparison = messageTimestamp(left) - messageTimestamp(right);
  if (dateComparison !== 0) {
    return dateComparison;
  }
  return compareTelegramMessageIds(left.telegramMessageId, right.telegramMessageId);
}

function messageTimestamp(message: TelegramReadMessage): number {
  const parsed = message.messageDate === null ? Number.NaN : Date.parse(message.messageDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareTelegramMessageIds(left: string, right: string): number {
  const leftId = parseTelegramMessageId(left);
  const rightId = parseTelegramMessageId(right);
  if (leftId !== null && rightId !== null && leftId !== rightId) {
    return leftId < rightId ? -1 : 1;
  }
  return left.localeCompare(right);
}

function parseTelegramMessageId(value: string): bigint | null {
  return /^[0-9]+$/.test(value) ? BigInt(value) : null;
}

function dateKey(value: string | null): string {
  const date = dateFromIso(value);
  if (date === null) {
    return 'unknown';
  }
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function formatDateLabel(value: string | null): string {
  const date = dateFromIso(value);
  if (date === null) {
    return 'Unknown date';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function formatTimeLabel(value: string | null): string {
  const date = dateFromIso(value);
  if (date === null) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function dateFromIso(value: string | null): Date | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function updateScrollDownVisibility(): void {
  showScrollDown.value = !isAtBottom();
}

function isNearBottom(): boolean {
  const root = scrollRoot.value;
  if (root === null) {
    return true;
  }
  return root.scrollHeight - root.scrollTop - root.clientHeight <= AUTO_SCROLL_BOTTOM_PX;
}

function isAtBottom(): boolean {
  const root = scrollRoot.value;
  if (root === null) {
    return true;
  }
  return root.scrollHeight - root.scrollTop - root.clientHeight <= SCROLL_BOTTOM_EPSILON_PX;
}

function showFloatingDateIsland(): void {
  scheduleFloatingDateLabelUpdate();
  floatingDateVisible.value = true;
  clearDateIslandTimeout();
  dateIslandHideTimeout = setTimeout(() => {
    floatingDateVisible.value = false;
    dateIslandHideTimeout = null;
  }, DATE_ISLAND_HIDE_DELAY_MS);
}

function scheduleFloatingDateLabelUpdate(): void {
  if (dateIslandFrame !== null) {
    return;
  }
  dateIslandFrame = requestAnimationFrame(() => {
    dateIslandFrame = null;
    floatingDateLabel.value = visibleDateLabel();
  });
}

function visibleDateLabel(): string | null {
  const root = scrollRoot.value;
  if (root === null) {
    return null;
  }

  const rootRect = root.getBoundingClientRect();
  const sampleX = rootRect.left + rootRect.width / 2;
  for (const offset of DATE_ISLAND_SAMPLE_OFFSETS) {
    const sampleY = Math.min(rootRect.bottom - 1, rootRect.top + offset);
    const element = document.elementFromPoint(sampleX, sampleY);
    const datedElement = element?.closest<HTMLElement>('[data-date-label]');
    if (datedElement === undefined || datedElement === null || !root.contains(datedElement)) {
      continue;
    }
    const label = datedElement.dataset.dateLabel;
    if (label !== undefined && label.length > 0) {
      return label;
    }
  }

  return floatingDateLabel.value;
}

function clearHighlightTimeout(): void {
  if (highlightTimeout === null) {
    return;
  }
  clearTimeout(highlightTimeout);
  highlightTimeout = null;
}

function clearDateIslandTimeout(): void {
  if (dateIslandHideTimeout === null) {
    return;
  }
  clearTimeout(dateIslandHideTimeout);
  dateIslandHideTimeout = null;
}

function cancelDateIslandFrame(): void {
  if (dateIslandFrame === null) {
    return;
  }
  cancelAnimationFrame(dateIslandFrame);
  dateIslandFrame = null;
}

function htmlElementFromRef(value: TemplateRef): HTMLElement | null {
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return value;
  }
  const element = value?.$el;
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement ? element : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== undefined)
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>

<template>
  <section class="telegram-chat-messages" aria-label="Messages">
    <div
      ref="scrollRoot"
      class="telegram-chat-messages__scrollport"
      :data-empty="timelineItems.length === 0 ? 'true' : undefined"
      @scroll="onScroll"
    >
      <div v-if="loadingOlder" class="telegram-chat-messages__load-state">
        Loading older messages
      </div>

      <div v-if="lastError" class="telegram-chat-messages__error">
        {{ lastError }}
      </div>

      <div v-if="timelineItems.length === 0" class="telegram-chat-messages__empty">
        {{ loadingInitial ? 'Loading messages' : emptyMessage }}
      </div>

      <template v-for="item in timelineItems" :key="item.id">
        <div
          v-if="item.kind === 'date'"
          class="telegram-chat-messages__date-row"
          :data-date-label="item.label"
        >
          <div class="telegram-chat-messages__date-label">
            {{ item.label }}
          </div>
        </div>

        <div
          v-else-if="item.kind === 'service'"
          :ref="(element) => setMessageElement(item.message.telegramMessageId, element)"
          class="telegram-chat-messages__service-row"
          :data-date-label="item.dateLabel"
        >
          <div class="telegram-chat-messages__service-pill">
            {{ item.label }}
          </div>
        </div>

        <div
          v-else-if="item.kind === 'message'"
          :ref="(element) => setMessageElement(item.message.telegramMessageId, element)"
          class="telegram-chat-messages__message-row"
          :data-date-label="item.dateLabel"
          :data-outgoing="item.message.isOutgoing ? 'true' : undefined"
          :data-highlighted="
            highlightedMessageId === item.message.telegramMessageId ? 'true' : undefined
          "
        >
          <div v-if="!item.message.isOutgoing" class="telegram-chat-messages__avatar">
            {{ item.view.avatar }}
          </div>

          <article
            class="telegram-chat-messages__bubble"
            :data-outgoing="item.message.isOutgoing ? 'true' : undefined"
          >
            <div v-if="item.view.sender" class="telegram-chat-messages__sender">
              {{ item.view.sender }}
            </div>

            <button
              v-if="item.view.replyTarget"
              type="button"
              class="telegram-chat-messages__reply"
              :data-loaded="item.view.isReplyLoaded ? 'true' : undefined"
              @click="() => void jumpToReply(item.view.replyTarget)"
            >
              <span class="telegram-chat-messages__reply-label">Reply</span>
              <span class="telegram-chat-messages__reply-text">
                {{ item.view.replyText }}
              </span>
            </button>

            <div v-if="item.view.contentLabel" class="telegram-chat-messages__content-label">
              {{ item.view.contentLabel }}
            </div>

            <div class="telegram-chat-messages__message-body">
              <template v-for="segment in item.view.bodySegments" :key="segment.id">
                <a
                  v-if="segment.kind === 'link'"
                  class="telegram-chat-messages__message-link"
                  :href="segment.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ segment.text }}
                </a>
                <span v-else class="telegram-chat-messages__message-text">
                  {{ segment.text }}
                </span>
              </template>
            </div>

            <div class="telegram-chat-messages__message-meta">
              {{ item.view.time }}
            </div>
          </article>
        </div>
      </template>
    </div>

    <div
      v-if="floatingDateLabel !== null"
      class="telegram-chat-messages__floating-date"
      :data-visible="floatingDateVisible ? 'true' : undefined"
    >
      {{ floatingDateLabel }}
    </div>

    <button
      type="button"
      class="telegram-chat-messages__scroll-down"
      :data-visible="showScrollDown ? 'true' : undefined"
      aria-label="Scroll to newest messages"
      title="Scroll to newest messages"
      @click="scrollToBottom"
    >
      <svg
        class="telegram-chat-messages__scroll-down-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  </section>
</template>

<style scoped>
@reference "tailwindcss";
.telegram-chat-messages {
  @apply relative h-full min-h-0 overflow-hidden bg-gradient-to-br from-emerald-50 via-lime-50 to-sky-50;
}

.telegram-chat-messages__scrollport {
  @apply h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-4;
}

.telegram-chat-messages__scrollport[data-empty='true'] {
  @apply flex items-center justify-center;
}

.telegram-chat-messages__load-state {
  @apply mx-auto mb-3 w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-zinc-500 shadow-sm ring-1 ring-black/5;
}

.telegram-chat-messages__error {
  @apply mx-auto mb-3 max-w-xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.telegram-chat-messages__empty {
  @apply rounded-lg bg-white/80 px-4 py-3 text-sm text-zinc-500 shadow-sm ring-1 ring-black/5;
}

.telegram-chat-messages__date-row {
  @apply mb-3 mt-1 flex justify-center;
}

.telegram-chat-messages__date-label {
  @apply rounded-full bg-zinc-700/45 px-3 py-1 text-sm font-semibold text-white shadow-sm backdrop-blur;
}

.telegram-chat-messages__floating-date {
  @apply pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-zinc-700/45 px-3 py-1 text-sm font-semibold text-white opacity-0 shadow-sm backdrop-blur transition-opacity duration-200;
}

.telegram-chat-messages__floating-date[data-visible='true'] {
  @apply opacity-100;
}

.telegram-chat-messages__service-row {
  @apply my-3 flex justify-center;
}

.telegram-chat-messages__service-pill {
  @apply rounded-full bg-emerald-900/35 px-4 py-1.5 text-sm font-semibold text-white shadow-sm backdrop-blur;
}

.telegram-chat-messages__message-row {
  @apply mb-2 flex items-end gap-2 pr-16 transition-colors;
}

.telegram-chat-messages__message-row[data-outgoing='true'] {
  @apply justify-end pl-16 pr-0;
}

.telegram-chat-messages__message-row[data-highlighted='true'] {
  @apply rounded-lg bg-yellow-200/40;
}

.telegram-chat-messages__avatar {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white shadow-sm;
}

.telegram-chat-messages__bubble {
  @apply max-w-[78%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 shadow-sm ring-1 ring-black/5 lg:max-w-[680px];
}

.telegram-chat-messages__bubble[data-outgoing='true'] {
  @apply rounded-bl-2xl rounded-br-md bg-emerald-100;
}

.telegram-chat-messages__sender {
  @apply mb-0.5 truncate text-sm font-semibold text-orange-700;
}

.telegram-chat-messages__reply {
  @apply mb-1 grid w-full gap-0.5 rounded-md border-l-4 border-violet-500 bg-violet-50 px-2.5 py-1 text-left hover:bg-violet-100;
}

.telegram-chat-messages__reply[data-loaded='true'] {
  @apply border-teal-500 bg-teal-50 hover:bg-teal-100;
}

.telegram-chat-messages__reply-label {
  @apply text-xs font-semibold text-violet-700;
}

.telegram-chat-messages__reply-text {
  @apply truncate text-sm text-zinc-700;
}

.telegram-chat-messages__content-label {
  @apply mb-1 w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500;
}

.telegram-chat-messages__message-body {
  @apply whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-950;
}

.telegram-chat-messages__message-link {
  @apply text-sky-700 underline decoration-sky-400 underline-offset-2 hover:text-sky-900;
}

.telegram-chat-messages__message-text {
  @apply whitespace-pre-wrap;
}

.telegram-chat-messages__message-meta {
  @apply mt-0.5 text-right text-xs font-medium text-zinc-400;
}

.telegram-chat-messages__scroll-down {
  @apply pointer-events-none absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-500 opacity-0 shadow-lg ring-1 ring-black/10 transition hover:text-zinc-800;
}

.telegram-chat-messages__scroll-down[data-visible='true'] {
  @apply pointer-events-auto flex opacity-100;
}

.telegram-chat-messages__scroll-down-icon {
  @apply h-7 w-7;
}
</style>
