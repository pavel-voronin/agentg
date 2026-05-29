import { storeChatMember } from '../../store/chatMember.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatMemberUpdate = TelegramWireUpdateByType<'updateChatMember'>;

export async function handleUpdateChatMember(update: TelegramWireChatMemberUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeChatMember(database, update);
  events.publishTelegramChatMemberUpdated(update);
}
