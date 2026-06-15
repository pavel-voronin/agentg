import type { message as TdlibMessage } from 'tdlib-types';

import type { MessageState } from '../../domain/models/messageState.js';
import { messageStateFromTdlibMessage } from '../../tdlib/messageState.js';

export function messageStatesFromHistoryPage(messages: readonly TdlibMessage[]): MessageState[] {
  return messages.map(messageStateFromTdlibMessage);
}
