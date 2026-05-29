import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageLiveLocationViewedUpdate =
  TelegramWireUpdateByType<'updateMessageLiveLocationViewed'>;

export function handleUpdateMessageLiveLocationViewed(
  update: TelegramWireMessageLiveLocationViewedUpdate
): void {
  // The runtime exposes no active-live-location updater effect; this update has no durable payload.
  void update.chat_id;
  void update.message_id;
}
