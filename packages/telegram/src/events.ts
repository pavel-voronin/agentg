import type { EventBus } from '@agentg/framework';

import type { FileOwnerChangedEvent } from './files/types.js';
import type { readFileQueueStats } from './files/read.js';
import type { ChatModelRef, MessageModelRef } from './model/refs.js';
import type { GetMessagesInput } from './procedures/get-messages/contract.js';
import type { StatusTracker } from './status/tracker.js';
import type { ReadMessage } from './views/schemas.js';

export const HISTORY_QUEUE_CHANGED_EVENT = 'telegram.history.reconciler.queueChanged';

type LoginFailedEvent = {
  error: string;
};

type StatusEvent = ReturnType<StatusTracker['snapshot']>;

type MessagesReadyEvent = GetMessagesInput & {
  requestId: string;
};

type MessagesFailedEvent = MessagesReadyEvent & {
  reason: string;
};

type MessageCreatedEvent = {
  message: ReadMessage;
};

type MessageUpdatedEvent = {
  message: Pick<
    ReadMessage,
    | 'chat'
    | 'contentType'
    | 'editDate'
    | 'media'
    | 'reactions'
    | 'serviceAction'
    | 'telegramMessageId'
    | 'text'
    | 'textEntities'
  >;
};

type MessageDeletedEvent = {
  delete: {
    chat: ChatModelRef;
    deletedAt: string;
    messages: MessageModelRef[];
  };
};

type FileQueueChangedEvent = Awaited<ReturnType<typeof readFileQueueStats>>;

export function publishLoginStarted(events: EventBus): void {
  events.publish('telegram.login.started');
}

export function publishLoginCompleted(events: EventBus): void {
  events.publish('telegram.login.completed');
}

export function publishLoginFailed(events: EventBus, event: LoginFailedEvent): void {
  events.publish('telegram.login.failed', event);
}

export function publishStatus(events: EventBus, event: StatusEvent): void {
  events.publish('telegram.status', event);
}

export function publishMessagesReady(events: EventBus, event: MessagesReadyEvent): void {
  events.publish('telegram.messages.ready', event);
}

export function publishMessagesFailed(events: EventBus, event: MessagesFailedEvent): void {
  events.publish('telegram.messages.failed', event);
}

export function publishHistoryQueueChanged(events: EventBus): void {
  events.publish(HISTORY_QUEUE_CHANGED_EVENT);
}

export function publishMessageCreated(events: EventBus, event: MessageCreatedEvent): void {
  events.publish('telegram.message.created', event);
}

export function publishMessageUpdated(events: EventBus, event: MessageUpdatedEvent): void {
  events.publish('telegram.message.updated', event);
}

export function publishMessageDeleted(events: EventBus, event: MessageDeletedEvent): void {
  events.publish('telegram.message.deleted', event);
}

export function publishFileOwnerChanged(events: EventBus, event: FileOwnerChangedEvent): void {
  events.publish('telegram.files.ownerChanged', event);
}

export function publishFileQueueChanged(events: EventBus, event: FileQueueChangedEvent): void {
  events.publish('telegram.files.queueChanged', event);
}
