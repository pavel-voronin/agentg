import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireSpeechRecognitionTrialUpdate =
  TelegramWireUpdateByType<'updateSpeechRecognitionTrial'>;

export function handleUpdateSpeechRecognitionTrial(
  update: TelegramWireSpeechRecognitionTrialUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'speech_recognition_trial', {
    max_media_duration: update.max_media_duration,
    weekly_count: update.weekly_count,
    left_count: update.left_count,
    next_reset_date: update.next_reset_date
  });
}
