import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { secretChatChanges } from '../secretChat.js';
import type { IngestionResources } from '../../resources.js';

type SecretChatUpdate = UpdateByType<'updateSecretChat'>;

export async function handleUpdateSecretChat(
  update: SecretChatUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, secretChatChanges(update));
}
