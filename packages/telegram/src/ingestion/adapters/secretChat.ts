import type { DomainChange, SecretChatSavedChange } from '../../domain/changes.js';
import type { SecretChatState } from '../../domain/models/secretChat.js';
import { tdJsonObject, type UpdateByType } from '../../tdlib/shape.js';

type SecretChatUpdate = UpdateByType<'updateSecretChat'>;
type SecretChat = SecretChatUpdate['secret_chat'];

export function secretChatChanges(update: SecretChatUpdate): DomainChange[] {
  return [
    {
      kind: 'secretChat.saved',
      chat: secretChatState(update.secret_chat)
    } satisfies SecretChatSavedChange
  ];
}

function secretChatState(chat: SecretChat): SecretChatState {
  return {
    id: chat.id,
    isOutbound: chat.is_outbound,
    keyHash: chat.key_hash,
    layer: chat.layer,
    state: tdJsonObject(chat.state),
    userId: String(chat.user_id)
  };
}
