import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireMessageLiveLocationViewedUpdate =
  TelegramWireUpdateByType<'updateMessageLiveLocationViewed'>;

export function handleUpdateMessageLiveLocationViewed(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireMessageLiveLocationViewedUpdate
): void {
  // The runtime exposes no active-live-location updater effect; this update has no durable payload.
  void context;
  void update.chat_id;
  void update.message_id;
}
