import type { TelegramDatabase } from '../database.js';
import { telegramBasicGroups } from '../schema.js';
import {
  telegramWireId,
  telegramWireJsonObject,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireBasicGroup = TelegramWireUpdateByType<'updateBasicGroup'>['basic_group'];

export async function storeBasicGroup(
  database: TelegramDatabase,
  basicGroup: TelegramWireBasicGroup
): Promise<void> {
  const row = telegramBasicGroupRow(basicGroup);
  await database.insert(telegramBasicGroups).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBasicGroups.id
  });
}

function telegramBasicGroupRow(
  basicGroup: TelegramWireBasicGroup
): typeof telegramBasicGroups.$inferInsert {
  return {
    id: String(basicGroup.id),
    isActive: basicGroup.is_active,
    memberCount: basicGroup.member_count,
    status: telegramWireJsonObject(basicGroup.status),
    upgradedToSupergroupId: nullableZeroId(basicGroup.upgraded_to_supergroup_id)
  };
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = telegramWireId(value);
  return id === undefined || id === '0' ? null : id;
}
