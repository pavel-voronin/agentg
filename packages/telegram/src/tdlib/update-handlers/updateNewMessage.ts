import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { TelegramWireNewMessageUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useFiles } from '../../files/subsystem.js';
import { useLiveCoverage } from '../../history/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateNewMessage({
  message
}: TelegramWireNewMessageUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const { recordLiveMessage } = useLiveCoverage();
  if (!(await storeMessage(database, message, 'ignore'))) {
    return;
  }

  await recordMessageFiles(files, message, 'live_update');

  if (message.date > 0) {
    void recordLiveMessage(String(message.chat_id), new Date(message.date * 1000));
  }

  events.publishTelegramMessageCreated(message);
}
