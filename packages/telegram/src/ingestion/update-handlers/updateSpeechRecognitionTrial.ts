import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type SpeechRecognitionTrialUpdate = UpdateByType<'updateSpeechRecognitionTrial'>;

export function handleUpdateSpeechRecognitionTrial(
  update: SpeechRecognitionTrialUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'speech_recognition_trial', {
    max_media_duration: update.max_media_duration,
    weekly_count: update.weekly_count,
    left_count: update.left_count,
    next_reset_date: update.next_reset_date
  });
}
