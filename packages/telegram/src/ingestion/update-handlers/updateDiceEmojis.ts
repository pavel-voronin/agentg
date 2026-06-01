import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type DiceEmojisUpdate = UpdateByType<'updateDiceEmojis'>;

export function handleUpdateDiceEmojis(
  update: DiceEmojisUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'dice_emojis', update.emojis);
}
