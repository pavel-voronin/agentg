import type {
  FileRef,
  MessageServiceAction,
  MessageTextEntity,
  ReadMessage
} from '../../../src/views/schemas.js';

export type GetMessagesResult = {
  messages?: unknown;
  reachedStart?: unknown;
  requestId?: unknown;
  status?: unknown;
};

export type GetMessageResult = {
  message?: unknown;
};

export type RequestFileResult = {
  decision?: unknown;
  file?: unknown;
};

export type TimelineDateItem = {
  dateKey: string;
  id: string;
  kind: 'date';
  label: string;
};

export type TimelineMessageItem = {
  dateLabel: string;
  id: string;
  kind: 'message';
  message: ReadMessage;
  view: MessageView;
};

export type TimelineServiceItem = {
  dateLabel: string;
  id: string;
  kind: 'service';
  label: string;
  message: ReadMessage;
};

export type TimelineItem = TimelineDateItem | TimelineMessageItem | TimelineServiceItem;

export type MessageView = {
  avatar: string;
  avatarUrl: string | null;
  body: string;
  bodySegments: MessageTextSegment[];
  contentLabel: string | null;
  dateKey: string;
  isReplyLoaded: boolean;
  mediaFiles: MediaFileView[];
  sender: string | null;
  time: string;
  replyTarget: MessageTarget | null;
  replyText: string | null;
};

export type MediaFileView = {
  duration: string | null;
  file: FileRef;
  id: string;
  isInteractive: boolean;
  label: string;
  progress: string | null;
  status: string;
  thumbnailUrl: string | null;
  url: string | null;
};

export type MessageTarget = {
  chatId: string;
  messageId: string;
};

export type MessageTextSegment =
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

export type MessageUpdate = {
  chatId: string;
  contentType: string;
  editDate: string | null;
  mediaFiles: FileRef[] | null;
  messageId: string;
  reactions: ReadMessage['reactions'];
  serviceAction: MessageServiceAction | null;
  text: string | null;
  textEntities: MessageTextEntity[];
};

export type MessageDeletion = {
  chatId: string;
  deletedAt: string | null;
  messageIds: Set<string>;
};
