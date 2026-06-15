import type { UpdateByType } from '../../tdlib/shape.js';

type MessageLiveLocationViewedUpdate = UpdateByType<'updateMessageLiveLocationViewed'>;

export function handleUpdateMessageLiveLocationViewed(
  update: MessageLiveLocationViewedUpdate
): void {
  // The runtime exposes no active-live-location updater effect; this update has no durable payload.
  void update.chat_id;
  void update.message_id;
}
