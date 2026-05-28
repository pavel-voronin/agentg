import { storeChatMember } from '../../store/chatMember.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatMemberUpdate = TelegramWireUpdateByType<'updateChatMember'>;

export async function handleUpdateChatMember(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatMemberUpdate
): Promise<void> {
  await storeChatMember(database, update);
  events.publishTelegramChatMemberUpdated(update);
}
