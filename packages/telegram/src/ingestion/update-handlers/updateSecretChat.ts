import type { UpdateByType } from '../types.js';
import { upsertSecretChat } from '../../store/secretChat.js';
import type { IngestionResources } from '../resources.js';

type SecretChatUpdate = UpdateByType<'updateSecretChat'>;

export function handleUpdateSecretChat(
  update: SecretChatUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertSecretChat(database, update.secret_chat);
}
