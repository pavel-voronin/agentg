import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database/client.js';
import { telegramSupergroups } from '../database/schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireSupergroupUpdate
} from '../tdlib/wire.js';

type TelegramWireSupergroup = TelegramWireSupergroupUpdate['supergroup'];

export async function storeSupergroup(
  database: TelegramDatabase,
  supergroup: TelegramWireSupergroup
): Promise<void> {
  const row = telegramSupergroupRow(supergroup);
  await database.insert(telegramSupergroups).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSupergroups.id
  });
}

function telegramSupergroupRow(
  supergroup: TelegramWireSupergroup
): typeof telegramSupergroups.$inferInsert {
  return {
    activeStoryState: telegramWireJsonValueOrNull(supergroup.active_story_state),
    boostLevel: supergroup.boost_level,
    date: new Date(supergroup.date * 1000),
    hasAutomaticTranslation: supergroup.has_automatic_translation,
    hasDirectMessagesGroup: supergroup.has_direct_messages_group,
    hasForumTabs: supergroup.has_forum_tabs,
    hasLinkedChat: supergroup.has_linked_chat,
    hasLocation: supergroup.has_location,
    id: String(supergroup.id),
    isAdministeredDirectMessagesGroup: supergroup.is_administered_direct_messages_group,
    isBroadcastGroup: supergroup.is_broadcast_group,
    isChannel: supergroup.is_channel,
    isDirectMessagesGroup: supergroup.is_direct_messages_group,
    isForum: supergroup.is_forum,
    isSlowModeEnabled: supergroup.is_slow_mode_enabled,
    joinByRequest: supergroup.join_by_request,
    joinToSendMessages: supergroup.join_to_send_messages,
    memberCount: supergroup.member_count,
    paidMessageStarCount: String(supergroup.paid_message_star_count),
    restrictionInfo: telegramWireJsonValueOrNull(supergroup.restriction_info),
    showMessageSender: supergroup.show_message_sender,
    signMessages: supergroup.sign_messages,
    status: telegramWireJsonObject(supergroup.status),
    usernames: telegramWireJsonValueOrNull(supergroup.usernames),
    verificationStatus: telegramWireJsonValueOrNull(supergroup.verification_status)
  };
}

function telegramWireJsonValueOrNull(value: unknown): JsonValue {
  return telegramWireJsonValue(value ?? null) ?? null;
}
