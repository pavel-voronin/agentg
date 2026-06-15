import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type StoryStealthModeUpdate = UpdateByType<'updateStoryStealthMode'>;

const STORY_STEALTH_MODE_KEY = 'story_stealth_mode';

export async function handleUpdateStoryStealthMode(
  update: StoryStealthModeUpdate,
  resources: IngestionResources
): Promise<void> {
  await saveKvEntry(resources, STORY_STEALTH_MODE_KEY, {
    active_until_date: update.active_until_date,
    cooldown_until_date: update.cooldown_until_date
  });
}
