import type { FileRef, MessageTextEntity, ReadMessage } from '../../../src/views/schemas.js';
import type {
  MediaFileView,
  MessageTarget,
  MessageTextSegment,
  MessageView,
  TimelineItem
} from './types.js';
import { providerFileUrl } from '../mediaUrl.js';

type TimelineOptions = {
  messagesByTelegramId: ReadonlyMap<string, ReadMessage>;
  selectedChatAvatarUrl: string | null;
};

export function buildTimelineItems(input: ReadMessage[], options: TimelineOptions): TimelineItem[] {
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
      view: messageView(message, options)
    });
  }
  return items;
}

export function sortMessages(input: ReadMessage[]): ReadMessage[] {
  return [...input].sort(compareMessages);
}

export function messageBelongsToChat(message: ReadMessage, chatId: string): boolean {
  return message.chat.id === chatId;
}

export function upsertMessageFile(files: FileRef[], file: FileRef): FileRef[] {
  return [...files.filter((item) => item.slotKey !== file.slotKey), file].sort(compareFileRefs);
}

function messageView(message: ReadMessage, options: TimelineOptions): MessageView {
  const replyTarget = message.replyTo === null ? null : replyTargetFromMessage(message);
  const replyMessage =
    replyTarget === null ? null : (options.messagesByTelegramId.get(replyTarget.messageId) ?? null);
  const sender = senderLabel(message);

  return {
    avatar: avatarLabel(sender ?? message.sender?.id ?? message.chat.id),
    avatarUrl: options.selectedChatAvatarUrl,
    body: messageBody(message),
    bodySegments: messageTextSegments(message),
    contentLabel:
      message.text === null && message.media.files.length === 0
        ? contentLabel(message.contentType)
        : null,
    dateKey: dateKey(message.messageDate),
    isReplyLoaded: replyMessage !== null,
    mediaFiles: mediaFileViews(message),
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

function mediaFileViews(message: ReadMessage): MediaFileView[] {
  const thumbnailUrl = providerFileUrl(
    message.media.files.find((file) => file.mediaKind === 'thumbnail' && file.url !== null)?.url ??
      null
  );
  const primaryFiles = message.media.files.filter((file) => file.mediaKind !== 'thumbnail');
  const files = primaryFiles.length === 0 ? message.media.files : primaryFiles;
  return files.map((file) => ({
    duration: formatDurationLabel(file.durationSeconds),
    file,
    id: file.id,
    isInteractive: file.canRequest,
    label: fileLabel(file),
    progress: fileProgress(file),
    status: fileStatusLabel(file),
    thumbnailUrl,
    url: providerFileUrl(file.url)
  }));
}

function fileLabel(file: FileRef): string {
  if (file.fileName !== null) {
    return file.fileName;
  }
  if (file.mediaKind === 'photo') {
    return 'Photo';
  }
  if (file.mediaKind === 'video') {
    return 'Video';
  }
  if (file.mediaKind === 'voice') {
    return 'Voice message';
  }
  if (file.mediaKind === 'thumbnail') {
    return 'Preview';
  }
  return 'File';
}

function fileStatusLabel(file: FileRef): string {
  if (file.status === 'ready') {
    return formatFileSize(file.byteSize);
  }
  if (file.status === 'queued') {
    return 'Queued';
  }
  if (file.status === 'downloading') {
    return 'Downloading';
  }
  if (file.status === 'failed') {
    return file.downloadError ?? 'Download failed';
  }
  return file.canRequest ? 'Click to download' : 'Not downloaded';
}

function fileProgress(file: FileRef): string | null {
  if (
    file.status !== 'downloading' ||
    file.byteSize === null ||
    file.downloadedByteSize === null ||
    file.byteSize <= 0
  ) {
    return null;
  }
  return `${String(Math.min(100, Math.floor((file.downloadedByteSize / file.byteSize) * 100)))}%`;
}

function formatFileSize(value: number | null): string {
  if (value === null) {
    return 'Ready';
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${Math.ceil(value / 1024).toString()} KB`;
  }
  return `${value.toString()} B`;
}

function formatDurationLabel(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes.toString()}:${seconds.toString().padStart(2, '0')}`;
}

function compareFileRefs(left: FileRef, right: FileRef): number {
  return left.slotKey.localeCompare(right.slotKey);
}

function replyTargetFromMessage(message: ReadMessage): MessageTarget | null {
  if (message.replyTo === null) {
    return null;
  }
  return {
    chatId: message.replyTo.chat.id,
    messageId: message.replyTo.telegramMessageId
  };
}

function messageBody(message: ReadMessage): string {
  if (message.isDeleted) {
    return 'Deleted message';
  }
  const text = message.text?.trim();
  if (text !== undefined && text.length > 0) {
    return text;
  }
  if (message.media.files.length > 0) {
    return '';
  }
  return contentLabel(message.contentType) ?? 'Unsupported message';
}

function messageServiceLabel(message: ReadMessage): string | null {
  const action = message.serviceAction;
  if (action?.kind !== 'chatMemberLeft') {
    return null;
  }
  return `${action.userDisplayName} left the group`;
}

function messageTextSegments(message: ReadMessage): MessageTextSegment[] {
  const text = message.text;
  if (
    !message.isDeleted &&
    (text === null || text.length === 0) &&
    message.media.files.length > 0
  ) {
    return [];
  }
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
  entity: MessageTextEntity,
  text: string
): MessageTextEntity | undefined {
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

function compareTextEntities(left: MessageTextEntity, right: MessageTextEntity): number {
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

function senderLabel(message: ReadMessage): string | null {
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

function compareMessages(left: ReadMessage, right: ReadMessage): number {
  const dateComparison = messageTimestamp(left) - messageTimestamp(right);
  if (dateComparison !== 0) {
    return dateComparison;
  }
  return compareMessageIds(left.telegramMessageId, right.telegramMessageId);
}

function messageTimestamp(message: ReadMessage): number {
  const parsed = message.messageDate === null ? Number.NaN : Date.parse(message.messageDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareMessageIds(left: string, right: string): number {
  const leftId = parseMessageId(left);
  const rightId = parseMessageId(right);
  if (leftId !== null && rightId !== null && leftId !== rightId) {
    return leftId < rightId ? -1 : 1;
  }
  return left.localeCompare(right);
}

function parseMessageId(value: string): bigint | null {
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

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
