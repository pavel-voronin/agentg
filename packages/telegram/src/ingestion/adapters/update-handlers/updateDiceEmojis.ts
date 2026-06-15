import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type DiceEmojisUpdate = UpdateByType<'updateDiceEmojis'>;

export function handleUpdateDiceEmojis(
  update: DiceEmojisUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'dice_emojis', update.emojis);
}
